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

export async function createInvitation(input: {
  plan: Exclude<Plan, "free">;
  months: number;
  email?: string;
  maxUses: number;
  expiresAt?: number | null;
  note?: string;
  createdBy: string;
}): Promise<Invitation>{
  let code = await generateCode();
  while (await get("SELECT id FROM invitations WHERE code = ?", code)) code = await generateCode();

  const id = newId("inv");
  await run(
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
  return (await get<Invitation>("SELECT * FROM invitations WHERE id = ?", id))!;
}

export async function findInvitationByCode(code: string) {
  return await get<Invitation>(
    "SELECT * FROM invitations WHERE code = ?",
    code.trim().toUpperCase(),
  );
}

export type InvitationProblem = "not_found" | "revoked" | "expired" | "used_up" | "wrong_email";

/** One place decides whether a code may be used, so signup and redemption agree. */
export async function checkInvitation(
  code: string,
  email?: string,
): Promise<{ invitation: Invitation } | { problem: InvitationProblem }> {
  const invitation = await findInvitationByCode(code);
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
export async function redeemInvitation(invitation: Invitation, user: User) {
  const end = new Date();
  end.setMonth(end.getMonth() + invitation.months);

  await recordSubscription({
    userId: user.id,
    plan: invitation.plan,
    status: "active",
    provider: "invitation",
    source: "invitation",
    amount: 0,
    currentPeriodEnd:
      invitation.months === 1 ? await periodEnd(invitation.plan) : end.getTime(),
  });

  await run(
    "INSERT INTO invitation_redemptions (id, invitation_id, user_id, created_at) VALUES (?, ?, ?, ?)",
    newId("red"),
    invitation.id,
    user.id,
    now(),
  );
  await run("UPDATE invitations SET used_count = used_count + 1 WHERE id = ?", invitation.id);
}

export interface InvitationRow extends Invitation {
  creator_email: string | null;
  redeemed_by: string;
}

/**
 * Paged. Invitation codes accumulate and are never cleaned up, so an unbounded
 * SELECT here is a page that gets slower every month and eventually times out.
 */
export async function listInvitations({ limit = 25, offset = 0 } = {}) {
  const rows = await all<InvitationRow>(
    `SELECT i.*, c.email AS creator_email,
            COALESCE((SELECT string_agg(u.email, ', ')
                        FROM invitation_redemptions r JOIN users u ON u.id = r.user_id
                       WHERE r.invitation_id = i.id), '') AS redeemed_by
       FROM invitations i
       LEFT JOIN users c ON c.id = i.created_by
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?`,
    Math.min(Math.max(1, limit), 100),
    Math.max(0, offset),
  );

  const total = (await get<{ n: number }>("SELECT COUNT(*) AS n FROM invitations"))?.n ?? 0;
  return { rows, total };
}

export async function revokeInvitation(id: string) {
  await run("UPDATE invitations SET revoked = 1 WHERE id = ?", id);
}

export async function invitationStats() {
  const row = await get<{ total: number; redeemed: number; live: number }>(
    `SELECT COUNT(*)::int AS total,
            COALESCE(SUM(used_count), 0)::int AS redeemed,
            SUM(CASE WHEN revoked = 0 AND used_count < max_uses
                      AND (expires_at IS NULL OR expires_at > ?) THEN 1 ELSE 0 END)::int AS live
       FROM invitations`,
    now(),
  );
  return { total: row?.total ?? 0, redeemed: row?.redeemed ?? 0, live: row?.live ?? 0 };
}
