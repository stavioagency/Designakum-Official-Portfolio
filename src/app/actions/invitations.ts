"use server";

import { revalidatePath } from "next/cache";
import { messages } from "@/lib/locale";
import { fill } from "@/lib/i18n";
import { audit } from "@/lib/audit";
import { currentLocale } from "@/lib/locale";
import { sendMail } from "@/lib/mailer";
import { emailTemplate } from "@/lib/emails";
import { requestOrigin } from "@/lib/origin";
import { requireUser } from "@/lib/auth";
import { activeSubscription } from "@/lib/billing";
import {
  checkInvitation,
  createInvitation,
  invitationProblemLabel,
  redeemInvitation,
  revokeInvitation,
} from "@/lib/invitations";
import { PermissionError, requirePermission } from "@/lib/permissions";
import { callerFingerprint, rateLimit } from "@/lib/rate-limit";
import type { ActionState } from "./console";
import type { Plan } from "@/lib/types";
import { reportError } from "@/lib/observability";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

async function fail(error: unknown): Promise<ActionState> {
  // A refused permission is an expected outcome, not an incident.
  if (error instanceof PermissionError) return { error: error.message };
  reportError(error, { area: "action" });
  return { error: error instanceof Error ? error.message : (await messages()).failed };
}

export async function createInvitationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("invitations.manage");

    const plan = str(fd, "plan") as Exclude<Plan, "free">;
    if (plan !== "monthly" && plan !== "yearly") return { error: (await messages()).unknownPlan };

    const months = Math.min(60, Math.max(1, Number(str(fd, "months")) || 1));
    const maxUses = Math.min(1000, Math.max(1, Number(str(fd, "maxUses")) || 1));
    const email = str(fd, "email").toLowerCase();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { error: (await messages()).badEmail };
    }

    const expiresRaw = str(fd, "expiresAt");
    const expiresAt = expiresRaw ? new Date(`${expiresRaw}T23:59:59`).getTime() : null;
    if (expiresAt !== null && Number.isNaN(expiresAt)) return { error: (await messages()).badExpiry };

    const invitation = await createInvitation({
      plan,
      months,
      email,
      maxUses,
      expiresAt,
      note: str(fd, "note").slice(0, 300),
      createdBy: actor.id,
    });

    await audit({
      actor,
      action: "invitation.created",
      targetType: "invitation",
      targetId: invitation.id,
      targetLabel: invitation.code,
      after: { plan, months, maxUses, email: email || null, expiresAt },
      detail: invitation.note,
    });

    // An invitation addressed to someone should reach them. Without this the
    // code existed in the console and nowhere else, so every invite had to be
    // copied and pasted by hand into some other channel.
    let mailed = false;
    if (email) {
      try {
        const origin = await requestOrigin();
        const composed = emailTemplate.invitation(await currentLocale(), {
          code: invitation.code,
          months,
          signupUrl: `${origin}/signup?invite=${encodeURIComponent(invitation.code)}`,
        });
        const result = await sendMail({
          to: email,
          subject: composed.subject,
          kind: "invitation",
          body: composed.body,
        });
        mailed = result.delivered;
      } catch (error) {
        // The invitation exists and its code is on screen either way.
        reportError(error, { area: "invitation-email", code: invitation.code });
      }
    }

    revalidatePath("/console/invitations");
    const m = await messages();
    return {
      ok: mailed
        ? fill(m.invitationSent, { code: invitation.code, email })
        : fill(m.invitationCreated, { code: invitation.code }),
    };
  } catch (error) {
    return await fail(error);
  }
}

export async function revokeInvitationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("invitations.manage");
    const id = str(fd, "invitationId");
    const code = str(fd, "code");

    await revokeInvitation(id);
    await audit({
      actor,
      action: "invitation.revoked",
      targetType: "invitation",
      targetId: id,
      targetLabel: code,
    });

    revalidatePath("/console/invitations");
    return { ok: (await messages()).invitationRevoked };
  } catch (error) {
    return await fail(error);
  }
}

/**
 * Redeeming happens as the customer, not as staff: the code is validated against
 * their own account, and a customer who already has an active subscription is
 * told so rather than silently stacking another one.
 */
export async function redeemInvitationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();

    const fingerprint = await callerFingerprint();
    const limit = await rateLimit(`redeem:${fingerprint}`, 10, 60 * 60 * 1000);
    if (!limit.ok) return { error: (await messages()).tooManyAttempts };

    const code = str(fd, "code");
    if (!code) return { error: (await messages()).enterInviteCode };

    if (await activeSubscription(user.id)) {
      return { error: (await messages()).alreadySubscribed };
    }

    const result = await checkInvitation(code, user.email);
    if ("problem" in result) return { error: await invitationProblemLabel(result.problem) };

    await redeemInvitation(result.invitation, user);

    await audit({
      actor: user,
      action: "invitation.redeemed",
      targetType: "invitation",
      targetId: result.invitation.id,
      targetLabel: result.invitation.code,
      after: { plan: result.invitation.plan, months: result.invitation.months },
    });

    revalidatePath("/dashboard/billing");
    revalidatePath("/console/invitations");
    const m = await messages();
    return {
      ok: fill(m.invitationRedeemed, {
        months: result.invitation.months,
        unit: result.invitation.plan === "yearly" ? m.unitYears : m.unitMonths,
      }),
    };
  } catch (error) {
    return await fail(error);
  }
}
