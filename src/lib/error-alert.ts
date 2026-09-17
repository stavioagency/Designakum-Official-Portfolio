import "server-only";
import { all } from "./db";
import { claimSlot } from "./rate-limit";
import { markNotified, recordError } from "./error-log";
import { sendMail } from "./mailer";
import { siteUrl } from "./site";
import { toText, type Block } from "./email-render";

/**
 * Tells the owners when something breaks.
 *
 * Deliberately plain rather than a template: this is the one message that has
 * to arrive when the platform is unwell, and it should not depend on settings
 * lookups, brand assets or anything else that might be part of what is broken.
 *
 * Like everything else on this path, it cannot throw and cannot call
 * `reportError` — a reporter that reports its own failures is a loop.
 */
export async function alertOwners(input: {
  area: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}) {
  try {
    const recorded = await recordError(input);
    if (!recorded || !recorded.shouldNotify) return;

    /**
     * A ceiling across all faults, not just each one.
     *
     * The per-fault hour stops one repeating problem from shouting, and does
     * nothing about the case that actually matters: an outage is a burst of
     * *different* failures, and each one being new would send its own message.
     * Six an hour, and past that the console is still the complete record —
     * which it has to be anyway, because nobody diagnoses anything from an
     * inbox with two hundred alerts in it.
     */
    // Atomic: these arrive at once during an outage, and a read-then-write
    // counter lets twenty of them all believe they are the first.
    const withinBudget = await claimSlot("error-alert:all", 6, 60 * 60 * 1000);
    if (!withinBudget) {
      // Marked as told about, so the suppressed ones do not arrive in a delayed
      // burst the moment the hour rolls over.
      await markNotified(recorded.fingerprint);
      return;
    }

    const owners = await all<{ email: string; locale: string }>(
      "SELECT email, locale FROM users WHERE role = 'owner' AND status = 'active'",
    );
    if (!owners.length) return;

    const origin = await siteUrl().catch(() => "https://designakum.com");
    const where = input.area || "unknown";

    const blocks: Block[] = [
      { type: "h", text: "Something failed on Designakum" },
      { type: "p", text: `Area: ${where}` },
      { type: "p", text: input.message.slice(0, 400) },
      { type: "cta", label: "Open the error log", url: `${origin}/console/errors` },
      {
        type: "note",
        text: "You will not get another message about this fault for an hour, however often it happens.",
      },
    ];

    for (const owner of owners) {
      await sendMail({
        to: owner.email,
        kind: "error_alert",
        subject: `Designakum: failure in ${where}`,
        body: toText(blocks),
        blocks,
        locale: owner.locale === "en" ? "en" : "ar",
        preheader: input.message.slice(0, 90),
      });
    }

    await markNotified(recorded.fingerprint);
  } catch {
    /* the alerting path stays silent about its own failures, by design */
  }
}
