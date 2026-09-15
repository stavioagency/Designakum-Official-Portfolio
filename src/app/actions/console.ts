"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { createUser, findUserByEmail, hashPassword, revokeSessionsFor } from "@/lib/auth";
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

function fail(error: unknown): ActionState {
  // A refused permission is an expected outcome, not an incident.
  if (error instanceof PermissionError) return { error: error.message };
  reportError(error, { area: "action" });
  return { error: error instanceof Error ? error.message : "تعذّر تنفيذ العملية" };
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

    if (userId === actor.id) return { error: "لا يمكنك تغيير حالة حسابك الخاص" };

    const target = await getCustomer(userId);
    if (!target) return { error: "الحساب غير موجود" };
    if (target.role !== "client" && actor.role !== "owner") {
      return { error: "لا يمكنك تعديل حساب موظف" };
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
    return { ok: status === "suspended" ? "تم إيقاف الحساب" : "تم تفعيل الحساب" };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteCustomerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("customers.delete");
    const userId = str(fd, "userId");
    if (userId === actor.id) return { error: "لا يمكنك حذف حسابك الخاص" };

    const target = await getCustomer(userId);
    if (!target) return { error: "الحساب غير موجود" };
    if (str(fd, "confirm") !== target.email) {
      return { error: "اكتب بريد العميل بالضبط لتأكيد الحذف" };
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
    return { ok: `تم حذف حساب ${target.email} نهائيًا` };
  } catch (error) {
    return fail(error);
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

    if (!plan) return { error: "باقة غير معروفة" };
    const target = await getCustomer(userId);
    if (!target) return { error: "الحساب غير موجود" };

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
    return { ok: `تم تفعيل الباقة ${plan === "monthly" ? "الشهرية" : "السنوية"} لمدة ${months} ${plan === "yearly" ? "سنة" : "شهرًا"}` };
  } catch (error) {
    return fail(error);
  }
}

export async function extendSubscriptionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("billing.manage");
    const userId = str(fd, "userId");
    const months = Math.min(60, Math.max(1, Number(str(fd, "months")) || 1));

    const subscription = await latestSubscription(userId);
    if (!subscription) return { error: "لا يوجد اشتراك لتمديده" };

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
      detail: `+${months} شهر`,
    });

    refreshCustomer(userId);
    return { ok: `تم التمديد ${months} شهرًا` };
  } catch (error) {
    return fail(error);
  }
}

export async function endSubscriptionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("billing.manage");
    const userId = str(fd, "userId");
    const immediately = str(fd, "immediately") === "1";

    const before = await latestSubscription(userId);
    if (!before) return { error: "لا يوجد اشتراك" };

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
    return { ok: immediately ? "تم إنهاء الاشتراك" : "سيتوقف التجديد في نهاية الفترة" };
  } catch (error) {
    return fail(error);
  }
}

export async function reactivateSubscriptionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("billing.manage");
    const userId = str(fd, "userId");

    const subscription = await latestSubscription(userId);
    if (!subscription) return { error: "لا يوجد اشتراك" };
    if (await activeSubscription(userId)) return { error: "الاشتراك نشط بالفعل" };

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
    return { ok: "تمت إعادة تفعيل الاشتراك" };
  } catch (error) {
    return fail(error);
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

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "البريد الإلكتروني غير صالح" };
    if (password.length < 12) return { error: "كلمة مرور الموظفين يجب أن تكون 12 حرفًا على الأقل" };
    if (!name) return { error: "الاسم مطلوب" };
    if (role !== "owner" && role !== "support") return { error: "دور غير معروف" };
    if (await findUserByEmail(email)) return { error: "هذا البريد مسجّل مسبقًا" };

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
    return { ok: `تم إنشاء حساب ${role === "owner" ? "مالك" : "دعم"} لـ ${email}` };
  } catch (error) {
    return fail(error);
  }
}

export async function setStaffRoleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("staff.manage");
    const userId = str(fd, "userId");
    const role = str(fd, "role") as Role;

    if (userId === actor.id) return { error: "لا يمكنك تغيير دورك الخاص" };
    if (!["owner", "support", "client"].includes(role)) return { error: "دور غير معروف" };

    const target = await getCustomer(userId);
    if (!target) return { error: "الحساب غير موجود" };

    // The platform must never end up with nobody who can administer it.
    if (target.role === "owner" && role !== "owner") {
      const owners = await ownerCount();
      if (owners <= 1) return { error: "لا يمكن إزالة آخر مالك للمنصة" };
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
    return { ok: "تم تحديث الدور" };
  } catch (error) {
    return fail(error);
  }
}

export async function resetCustomerPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("customers.suspend");
    const userId = str(fd, "userId");
    const password = String(fd.get("password") ?? "");
    if (password.length < 8) return { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" };

    const target = await getCustomer(userId);
    if (!target) return { error: "الحساب غير موجود" };
    if (target.role !== "client" && actor.role !== "owner") {
      return { error: "لا يمكنك تعديل حساب موظف" };
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
      detail: "كل الجلسات النشطة أُنهيت",
    });

    refreshCustomer(userId);
    return { ok: "تم تعيين كلمة مرور جديدة وإنهاء جلسات العميل" };
  } catch (error) {
    return fail(error);
  }
}

async function ownerCount(): Promise<number>{
  return (await get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'owner'"))?.n ?? 0;
}
