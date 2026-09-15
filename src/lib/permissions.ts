import "server-only";
import { redirect } from "next/navigation";
import { currentUser } from "./auth";
import type { Role, User } from "./types";

/**
 * Capability names, not role checks, are what the console guards on — so adding a
 * role later is a change to one table here rather than a hunt through the routes.
 */
export type Permission =
  | "console.access"
  | "customers.view"
  | "customers.suspend"
  | "customers.delete"
  | "portfolio.edit"
  | "moderation.review"
  | "moderation.enforce"
  | "support.manage"
  | "billing.manage"
  | "invitations.manage"
  | "analytics.view"
  | "announcements.manage"
  | "settings.manage"
  | "audit.view"
  | "staff.manage";

const OWNER: Permission[] = [
  "console.access",
  "customers.view",
  "customers.suspend",
  "customers.delete",
  "portfolio.edit",
  "moderation.review",
  "moderation.enforce",
  "support.manage",
  "billing.manage",
  "invitations.manage",
  "analytics.view",
  "announcements.manage",
  "settings.manage",
  "audit.view",
  "staff.manage",
];

/**
 * A support agent can work the queues but is deliberately kept away from billing,
 * invitations, platform settings, the audit trail and staff management.
 */
const SUPPORT: Permission[] = [
  "console.access",
  "customers.view",
  "moderation.review",
  "support.manage",
  "analytics.view",
];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: OWNER,
  support: SUPPORT,
  client: [],
};

export const STAFF_ROLES: Role[] = ["owner", "support"];

export const ROLE_LABEL: Record<Role, string> = {
  owner: "مالك المنصة",
  support: "فريق الدعم",
  client: "عميل",
};

export function isStaff(user: User | null | undefined): boolean {
  return !!user && STAFF_ROLES.includes(user.role);
}

export function can(user: User | null | undefined, permission: Permission): boolean {
  if (!user || user.status === "suspended") return false;
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}

export function permissionsFor(user: User): Permission[] {
  return ROLE_PERMISSIONS[user.role] ?? [];
}

export class PermissionError extends Error {
  constructor(public permission: Permission) {
    super(`ليست لديك صلاحية تنفيذ هذا الإجراء (${permission})`);
  }
}

/** Every console route and console action funnels through this. */
export async function requirePermission(permission: Permission): Promise<User> {
  const user = await currentUser();
  if (!user) throw new PermissionError(permission);
  if (!can(user, permission)) throw new PermissionError(permission);
  return user;
}

/**
 * Page-level guard. A missing permission is a normal outcome for a support agent
 * who typed a URL, not an application error — so it redirects to the console with
 * a notice rather than throwing into the error boundary. Actions keep throwing,
 * since a blocked mutation really is exceptional.
 */
export async function guardPage(permission: Permission): Promise<User> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=/console`);
  if (!can(user, permission)) redirect(`/console?denied=${permission}`);
  return user;
}

export async function staffUser(): Promise<User | null> {
  const user = await currentUser();
  return isStaff(user) ? user : null;
}
