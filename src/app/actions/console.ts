"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { messages } from "@/lib/locale";
import { fill } from "@/lib/i18n";
import { audit } from "@/lib/audit";
import { verifyCredentials } from "@/lib/paypal";
import { createUser, findUserByEmail, hashPassword, revokeSessionsFor } from "@/lib/auth";
import { PASSWORD_STAFF_MIN, passwordAcceptable } from "@/lib/password-policy";
import {
  activeSubscription,
  addMonths,
  cancelSubscription,
  latestSubscription,
  periodEnd,
  planDefinitions,
  recordSubscription,
  setSubscriptionStatus,
} from "@/lib/billing";
import { getCustomer, portfolioOf } from "@/lib/customers";
import { get, now, run } from "@/lib/db";
import { PermissionError, requirePermission } from "@/lib/permissions";
import type { Plan, Role } from "@/lib/types";
import { reportError } from "@/lib/observability";

export type ActionState = { ok?: string; error?: string } | null;

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

async function fail(error: unknown): Promise<ActionState> {
  // A refused permission is an expected outcome, not an incident.
  if (error instanceof PermissionError) return { error: error.message };
  reportError(error, { area: "action" });
  return { error: error instanceof Error ? error.message : (await messages()).failed };
}

function paidPlan(value: string): Exclude<Plan, "free"> | null {
  return value === "monthly" || value === "yearly" ? value : null;
}

function refreshCustomer(userId: string) {
  revalidatePath("/console");
  revalidatePath("/console/customers");
  revalidatePath(`/console/customers/${userId}`);
}

/* --------------------------------------------------------------- accounts */

export async function setAccountStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("customers.suspend");
    const userId = str(fd, "userId");
    const status = str(fd, "status") === "suspended" ? "suspended" : "active";
    const reason = str(fd, "reason");

    if (userId === actor.id) return { error: (await messages()).cannotChangeOwnStatus };

    const target = await getCustomer(userId);
    if (!target) return { error: (await messages()).accountMissing };
    if (target.role !== "client" && actor.role !== "owner") {
      return { error: (await messages()).cannotEditStaff };
    }

    await run("UPDATE users SET status = ?, updated_at = ? WHERE id = ?", status, now(), userId);
    if (status === "suspended") await revokeSessionsFor(userId);

    await audit({
      actor,
      action: status === "suspended" ? "customer.suspended" : "customer.reactivated",
      targetType: "user",
      targetId: userId,
      targetLabel: target.email,
      before: { status: target.status },
      after: { status },
      detail: reason,
    });

    refreshCustomer(userId);
    const m = await messages();
    return { ok: status === "suspended" ? m.accountSuspended : m.accountActivated };
  } catch (error) {
    return await fail(error);
  }
}

export async function deleteCustomerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let deleted = "";
  try {
    const actor = await requirePermission("customers.delete");
    const userId = str(fd, "userId");
    if (userId === actor.id) return { error: (await messages()).cannotDeleteSelf };

    const target = await getCustomer(userId);
    if (!target) return { error: (await messages()).accountMissing };
    if (str(fd, "confirm") !== target.email) {
      return { error: (await messages()).typeEmailToConfirm };
    }

    const portfolio = await portfolioOf(userId);
    await audit({
      actor,
      action: "customer.deleted",
      targetType: "user",
      targetId: userId,
      targetLabel: target.email,
      before: { email: target.email, plan: target.plan, portfolio: portfolio?.slug ?? null },
      detail: str(fd, "reason"),
    });

    // ON DELETE CASCADE clears the portfolio and everything hanging off it.
    await run("DELETE FROM users WHERE id = ?", userId);

    revalidatePath("/console/customers");
    revalidatePath("/console");
    deleted = target.email;
  } catch (error) {
    return await fail(error);
  }

  /**
   * Out of the try, because `redirect` works by throwing.
   *
   * Caught by the block above it would be reported as a failure and swallowed,
   * and the page would stay put. Which is how this ended in a 404: the delete
   * runs from the customer's own page, revalidating it re-renders a page for
   * somebody who no longer exists, and that page calls notFound(). The list is
   * where a person expects to land after removing a row from it.
   */
  redirect(`/console/customers?deleted=${encodeURIComponent(deleted)}`);
}

/**
 * Asks PayPal whether the configured keys are a working pair.
 *
 * Staff only, and it returns a sentence rather than the response: the point is
 * to find a mismatched key pair here rather than in a customer's checkout, not
 * to expose anything about the credentials themselves.
 */
export async function checkPaypalAction(): Promise<{ ok: boolean; message: string } | null> {
  try {
    await requirePermission("billing.manage");
    const m = await messages();
    const result = await verifyCredentials();
    const mode = result.live ? "live" : "sandbox";

    if (result.ok) return { ok: true, message: fill(m.paypalOk, { mode }) };
    if (result.detail.startsWith("missing")) return { ok: false, message: m.paypalMissing };
    if (result.detail === "unreachable") return { ok: false, message: m.paypalUnreachable };
    return { ok: false, message: fill(m.paypalRejected, { mode, status: String(result.status) }) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "failed" };
  }
}

/* ---------------------------------------------------------- subscriptions */

export async function grantSubscriptionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("billing.manage");
    const userId = str(fd, "userId");
    const plan = paidPlan(str(fd, "plan"));
    const months = Math.min(60, Math.max(1, Number(str(fd, "months")) || 1));
    const comped = str(fd, "comped") === "1";

    if (!plan) return { error: (await messages()).unknownPlan };
    const target = await getCustomer(userId);
    if (!target) return { error: (await messages()).accountMissing };

    const before = await latestSubscription(userId);
    await recordSubscription({
      userId,
      plan,
      status: "active",
      provider: "manual",
      source: comped ? "manual" : "paid",
      amount: comped ? 0 : (await planDefinitions())[plan].amount * (plan === "monthly" ? months : 1),
      currentPeriodEnd: addMonths(now(), plan === "yearly" ? months * 12 : months),
    });

    await audit({
      actor,
      action: comped ? "subscription.granted_free" : "subscription.granted",
      targetType: "user",
      targetId: userId,
      targetLabel: target.email,
      before: before ? { plan: before.plan, status: before.status } : null,
      after: { plan, months, comped },
      detail: str(fd, "note"),
    });

    refreshCustomer(userId);
    const m = await messages();
    return {
      ok: fill(m.planGranted, {
        plan: plan === "monthly" ? m.planMonthlyName : m.planYearlyName,
        months,
        unit: plan === "yearly" ? m.unitYears : m.unitMonths,
      }),
    };
  } catch (error) {
    return await fail(error);
  }
}

export async function extendSubscriptionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("billing.manage");
    const userId = str(fd, "userId");
    const months = Math.min(60, Math.max(1, Number(str(fd, "months")) || 1));

    const subscription = await latestSubscription(userId);
    if (!subscription) return { error: (await messages()).noSubscriptionToExtend };

    const target = await getCustomer(userId);
    const from = Math.max(subscription.current_period_end ?? now(), now());
    const extended = await addMonths(from, months);

    await run(
      "UPDATE subscriptions SET current_period_end = ?, status = 'active', cancel_at_period_end = 0, updated_at = ? WHERE id = ?",
      extended,
      now(),
      subscription.id,
    );
    await run("UPDATE users SET plan = ?, updated_at = ? WHERE id = ?", subscription.plan, now(), userId);

    await audit({
      actor,
      action: "subscription.extended",
      targetType: "user",
      targetId: userId,
      targetLabel: target?.email ?? userId,
      before: { current_period_end: subscription.current_period_end },
      after: { current_period_end: extended },
      detail: fill((await messages()).extendDetail, { months }),
    });

    refreshCustomer(userId);
    return { ok: fill((await messages()).extended, { months }) };
  } catch (error) {
    return await fail(error);
  }
}

export async function endSubscriptionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("billing.manage");
    const userId = str(fd, "userId");
    const immediately = str(fd, "immediately") === "1";

    const before = await latestSubscription(userId);
    if (!before) return { error: (await messages()).noSubscription };

    await cancelSubscription(userId, immediately);
    const target = await getCustomer(userId);

    await audit({
      actor,
      action: immediately ? "subscription.canceled" : "subscription.cancel_scheduled",
      targetType: "user",
      targetId: userId,
      targetLabel: target?.email ?? userId,
      before: { status: before.status, plan: before.plan },
      after: { status: immediately ? "canceled" : before.status, cancel_at_period_end: !immediately },
      detail: str(fd, "reason"),
    });

    refreshCustomer(userId);
    const m = await messages();
    return { ok: immediately ? m.subscriptionEnded : m.renewalStopsAtPeriodEnd };
  } catch (error) {
    return await fail(error);
  }
}

export async function reactivateSubscriptionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("billing.manage");
    const userId = str(fd, "userId");

    const subscription = await latestSubscription(userId);
    if (!subscription) return { error: (await messages()).noSubscription };
    if (await activeSubscription(userId)) return { error: (await messages()).alreadyActive };

    const end = Math.max(subscription.current_period_end ?? 0, await periodEnd(subscription.plan));
    await setSubscriptionStatus(subscription.id, "active");
    await run(
      "UPDATE subscriptions SET current_period_end = ?, cancel_at_period_end = 0, canceled_at = NULL, updated_at = ? WHERE id = ?",
      end,
      now(),
      subscription.id,
    );
    await run("UPDATE users SET plan = ?, updated_at = ? WHERE id = ?", subscription.plan, now(), userId);

    const target = await getCustomer(userId);
    await audit({
      actor,
      action: "subscription.reactivated",
      targetType: "user",
      targetId: userId,
      targetLabel: target?.email ?? userId,
      before: { status: subscription.status },
      after: { status: "active", current_period_end: end },
    });

    refreshCustomer(userId);
    return { ok: (await messages()).subscriptionRestored };
  } catch (error) {
    return await fail(error);
  }
}

/* ---------------------------------------------------------------- staff */

export async function createStaffAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("staff.manage");
    const email = str(fd, "email").toLowerCase();
    const password = String(fd.get("password") ?? "");
    const name = str(fd, "name");
    const role = str(fd, "role") as Role;

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: (await messages()).badEmail };
    // Staff hold the console, so they carry the longer minimum.
    if (!passwordAcceptable(password, PASSWORD_STAFF_MIN)) {
      return { error: (await messages()).staffPasswordShort };
    }
    if (!name) return { error: (await messages()).nameRequired };
    if (role !== "owner" && role !== "support") return { error: (await messages()).unknownRole };
    if (await findUserByEmail(email)) return { error: (await messages()).emailTaken };

    const created = await createUser({ email, password, displayName: name, role });

    await audit({
      actor,
      action: "staff.created",
      targetType: "user",
      targetId: created.id,
      targetLabel: email,
      after: { role },
    });

    revalidatePath("/console/settings");
    const m = await messages();
    return {
      ok: fill(m.staffCreated, {
        role: role === "owner" ? m.roleOwnerShort : m.roleSupportShort,
        email,
      }),
    };
  } catch (error) {
    return await fail(error);
  }
}

export async function setStaffRoleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("staff.manage");
    const userId = str(fd, "userId");
    const role = str(fd, "role") as Role;

    if (userId === actor.id) return { error: (await messages()).cannotChangeOwnRole };
    if (!["owner", "support", "client"].includes(role)) return { error: (await messages()).unknownRole };

    const target = await getCustomer(userId);
    if (!target) return { error: (await messages()).accountMissing };

    // The platform must never end up with nobody who can administer it.
    if (target.role === "owner" && role !== "owner") {
      const owners = await ownerCount();
      if (owners <= 1) return { error: (await messages()).lastOwner };
    }

    await run("UPDATE users SET role = ?, updated_at = ? WHERE id = ?", role, now(), userId);
    await revokeSessionsFor(userId);

    await audit({
      actor,
      action: "staff.role_changed",
      targetType: "user",
      targetId: userId,
      targetLabel: target.email,
      before: { role: target.role },
      after: { role },
    });

    revalidatePath("/console/settings");
    return { ok: (await messages()).roleUpdated };
  } catch (error) {
    return await fail(error);
  }
}

export async function resetCustomerPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("customers.suspend");
    const userId = str(fd, "userId");
    const password = String(fd.get("password") ?? "");
    if (!passwordAcceptable(password)) return { error: (await messages()).passwordShort };

    const target = await getCustomer(userId);
    if (!target) return { error: (await messages()).accountMissing };
    if (target.role !== "client" && actor.role !== "owner") {
      return { error: (await messages()).cannotEditStaff };
    }

    await run(
      "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
      hashPassword(password),
      now(),
      userId,
    );
    await revokeSessionsFor(userId);

    await audit({
      actor,
      action: "customer.password_reset",
      targetType: "user",
      targetId: userId,
      targetLabel: target.email,
      detail: (await messages()).allSessionsEnded,
    });

    refreshCustomer(userId);
    return { ok: (await messages()).customerPasswordSet };
  } catch (error) {
    return await fail(error);
  }
}

async function ownerCount(): Promise<number>{
  return (await get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'owner'"))?.n ?? 0;
}
