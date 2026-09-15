import "server-only";
import { randomBytes } from "node:crypto";
import { all, get, now, run } from "./db";
import { newId } from "./ids";
import { periodEnd, recordSubscription } from "./billing";
import type { Invitation, Plan, User } from "./types";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no look-alike characters

function generateCode(): string {
  const bytes = randomBytes(10);
  let code = "";
  for (let i = 0; i < 10; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
    if (i === 4) code += "-";
  }
  return code;
}

export function createInvitation(input: {
  plan: Exclude<Plan, "free">;
  months: number;
  email?: string;
  maxUses: number;
  expiresAt?: number | null;
  note?: string;
  createdBy: string;
}): Invitation {
  let code = generateCode();
  while (get("SELECT id FROM invitations WHERE code = ?", code)) code = generateCode();

  const id = newId("inv");
  run(
    `INSERT INTO invitations (id, code, plan, months, email, max_uses, used_count, expires_at, note, revoked, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 0, ?, ?)`,
    id,
    code,
    input.plan,
    Math.max(1, input.months),
    (input.email ?? "").trim().toLowerCase(),
    Math.max(1, input.maxUses),
    input.expiresAt ?? null,
    input.note ?? "",
    input.createdBy,
    now(),
  );
  return get<Invitation>("SELECT * FROM invitations WHERE id = ?", id)!;
}

export function findInvitationByCode(code: string) {
  return get<Invitation>(
    "SELECT * FROM invitations WHERE code = ?",
    code.trim().toUpperCase(),
  );
}

export type InvitationProblem = "not_found" | "revoked" | "expired" | "used_up" | "wrong_email";

/** One place decides whether a code may be used, so signup and redemption agree. */
export function checkInvitation(
  code: string,
  email?: string,
): { invitation: Invitation } | { problem: InvitationProblem } {
  const invitation = findInvitationByCode(code);
  if (!invitation) return { problem: "not_found" };
  if (invitation.revoked === 1) return { problem: "revoked" };
  if (invitation.expires_at && invitation.expires_at < now()) return { problem: "expired" };
  if (invitation.used_count >= invitation.max_uses) return { problem: "used_up" };
  if (invitation.email && email && invitation.email !== email.trim().toLowerCase()) {
    return { problem: "wrong_email" };
  }
  return { invitation };
}

export const INVITATION_PROBLEM_LABEL: Record<InvitationProblem, string> = {
  not_found: "رمز الدعوة غير صحيح",
  revoked: "تم إلغاء هذه الدعوة",
  expired: "انتهت صلاحية هذه الدعوة",
  used_up: "استُخدمت هذه الدعوة بالكامل",
  wrong_email: "هذه الدعوة مخصصة لبريد إلكتروني آخر",
};

/**
 * Turns a valid code into a real subscription row, recorded with the `invitation`
 * source so comped accounts never inflate revenue.
 */
export function redeemInvitation(invitation: Invitation, user: User) {
  const end = new Date();
  end.setMonth(end.getMonth() + invitation.months);

  recordSubscription({
    userId: user.id,
    plan: invitation.plan,
    status: "active",
    provider: "invitation",
    source: "invitation",
    amount: 0,
    currentPeriodEnd:
      invitation.months === 1 ? periodEnd(invitation.plan) : end.getTime(),
  });

  run(
    "INSERT INTO invitation_redemptions (id, invitation_id, user_id, created_at) VALUES (?, ?, ?, ?)",
    newId("red"),
    invitation.id,
    user.id,
    now(),
  );
  run("UPDATE invitations SET used_count = used_count + 1 WHERE id = ?", invitation.id);
}

export interface InvitationRow extends Invitation {
  creator_email: string | null;
  redeemed_by: string;
}

export function listInvitations() {
  return all<InvitationRow>(
    `SELECT i.*, c.email AS creator_email,
            COALESCE((SELECT GROUP_CONCAT(u.email, ', ')
                        FROM invitation_redemptions r JOIN users u ON u.id = r.user_id
                       WHERE r.invitation_id = i.id), '') AS redeemed_by
       FROM invitations i
       LEFT JOIN users c ON c.id = i.created_by
      ORDER BY i.created_at DESC`,
  );
}

export function revokeInvitation(id: string) {
  run("UPDATE invitations SET revoked = 1 WHERE id = ?", id);
}

export function invitationStats() {
  const row = get<{ total: number; redeemed: number; live: number }>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(used_count), 0) AS redeemed,
            SUM(CASE WHEN revoked = 0 AND used_count < max_uses
                      AND (expires_at IS NULL OR expires_at > ?) THEN 1 ELSE 0 END) AS live
       FROM invitations`,
    now(),
  );
  return { total: row?.total ?? 0, redeemed: row?.redeemed ?? 0, live: row?.live ?? 0 };
}
