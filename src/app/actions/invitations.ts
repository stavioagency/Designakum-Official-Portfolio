"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { activeSubscription } from "@/lib/billing";
import {
  checkInvitation,
  createInvitation,
  INVITATION_PROBLEM_LABEL,
  redeemInvitation,
  revokeInvitation,
} from "@/lib/invitations";
import { PermissionError, requirePermission } from "@/lib/permissions";
import { callerFingerprint, rateLimit } from "@/lib/rate-limit";
import type { ActionState } from "./console";
import type { Plan } from "@/lib/types";
import { reportError } from "@/lib/observability";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function fail(error: unknown): ActionState {
  // A refused permission is an expected outcome, not an incident.
  if (error instanceof PermissionError) return { error: error.message };
  reportError(error, { area: "action" });
  return { error: error instanceof Error ? error.message : "تعذّر تنفيذ العملية" };
}

export async function createInvitationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("invitations.manage");

    const plan = str(fd, "plan") as Exclude<Plan, "free">;
    if (plan !== "monthly" && plan !== "yearly") return { error: "باقة غير معروفة" };

    const months = Math.min(60, Math.max(1, Number(str(fd, "months")) || 1));
    const maxUses = Math.min(1000, Math.max(1, Number(str(fd, "maxUses")) || 1));
    const email = str(fd, "email").toLowerCase();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { error: "البريد الإلكتروني غير صالح" };
    }

    const expiresRaw = str(fd, "expiresAt");
    const expiresAt = expiresRaw ? new Date(`${expiresRaw}T23:59:59`).getTime() : null;
    if (expiresAt !== null && Number.isNaN(expiresAt)) return { error: "تاريخ الانتهاء غير صالح" };

    const invitation = createInvitation({
      plan,
      months,
      email,
      maxUses,
      expiresAt,
      note: str(fd, "note").slice(0, 300),
      createdBy: actor.id,
    });

    audit({
      actor,
      action: "invitation.created",
      targetType: "invitation",
      targetId: invitation.id,
      targetLabel: invitation.code,
      after: { plan, months, maxUses, email: email || null, expiresAt },
      detail: invitation.note,
    });

    revalidatePath("/console/invitations");
    return { ok: `تم إنشاء الدعوة ${invitation.code}` };
  } catch (error) {
    return fail(error);
  }
}

export async function revokeInvitationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("invitations.manage");
    const id = str(fd, "invitationId");
    const code = str(fd, "code");

    revokeInvitation(id);
    audit({
      actor,
      action: "invitation.revoked",
      targetType: "invitation",
      targetId: id,
      targetLabel: code,
    });

    revalidatePath("/console/invitations");
    return { ok: "تم إلغاء الدعوة" };
  } catch (error) {
    return fail(error);
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
    const limit = rateLimit(`redeem:${fingerprint}`, 10, 60 * 60 * 1000);
    if (!limit.ok) return { error: "محاولات كثيرة. حاول لاحقًا." };

    const code = str(fd, "code");
    if (!code) return { error: "أدخل رمز الدعوة" };

    if (activeSubscription(user.id)) {
      return { error: "لديك اشتراك نشط بالفعل" };
    }

    const result = checkInvitation(code, user.email);
    if ("problem" in result) return { error: INVITATION_PROBLEM_LABEL[result.problem] };

    redeemInvitation(result.invitation, user);

    audit({
      actor: user,
      action: "invitation.redeemed",
      targetType: "invitation",
      targetId: result.invitation.id,
      targetLabel: result.invitation.code,
      after: { plan: result.invitation.plan, months: result.invitation.months },
    });

    revalidatePath("/dashboard/billing");
    revalidatePath("/console/invitations");
    return {
      ok: `تم تفعيل اشتراكك لمدة ${result.invitation.months} ${result.invitation.plan === "yearly" ? "سنة" : "شهرًا"}`,
    };
  } catch (error) {
    return fail(error);
  }
}
