/**
 * How long an announcement runs, as a plain value both sides can read.
 *
 * Separate from announcements.ts because that module is `server-only` and the
 * console's form is a client component: importing the list from there took the
 * whole dev server down with "you're importing a component that needs
 * server-only". Nothing here touches the database, so nothing here needs to be
 * server-only. The same reason support-labels.ts exists beside support.ts.
 */

/**
 * Offered as a duration rather than an end date because that is how the
 * decision is actually made — "leave it up for a day" — and because a date
 * picker cannot express an hour at all. Zero runs until it is turned off.
 */
export const ANNOUNCEMENT_HOURS = [0, 1, 6, 12, 24, 72, 168, 336, 720] as const;

/** Clamped to thirty days: anything longer is an announcement nobody reads. */
export function endsAtFromHours(hours: number, from: number): number | null {
  if (!Number.isFinite(hours) || hours <= 0) return null;
  const capped = Math.min(Math.max(1, Math.round(hours)), 720);
  return from + capped * 60 * 60 * 1000;
}
