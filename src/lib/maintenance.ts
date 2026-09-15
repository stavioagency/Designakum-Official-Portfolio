import "server-only";
import { currentUser } from "./auth";
import { isStaff } from "./permissions";
import { readSettings } from "./settings";

/**
 * Maintenance mode always closes the platform's own surfaces — landing, sign-in
 * and the client dashboard. Whether it also takes customer portfolios offline is a
 * setting, because those pages have an audience of their own: a designer's client
 * visiting `/p/name` sees the outage as the designer's, not ours. Staff keep full
 * access throughout so the problem can be worked on.
 */
export async function maintenanceState({ portfolio = false } = {}) {
  const settings = readSettings();
  if (!settings["platform.maintenance"]) return { blocked: false, message: "", staff: false };

  if (portfolio && !settings["platform.maintenance_includes_portfolios"]) {
    return { blocked: false, message: "", staff: false };
  }

  const user = await currentUser();
  const staff = isStaff(user);
  return {
    blocked: !staff,
    staff,
    message: settings["platform.maintenance_message"],
  };
}
