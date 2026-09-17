import "server-only";

/**
 * Production failures have to be visible somewhere other than a terminal nobody is
 * watching. This always writes a structured line to stderr (which every host
 * collects) and, when `ERROR_WEBHOOK_URL` is set, forwards the same payload to a
 * collector — Sentry's tunnel, a Slack webhook, or anything that accepts JSON.
 * Nothing here pretends to be a monitoring service; without the variable it is
 * simply structured logging.
 */
export function reportError(
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  const payload = {
    level: "error",
    time: new Date().toISOString(),
    service: "designakum",
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  };

  console.error(JSON.stringify(payload));

  /**
   * Recorded and, when it is worth it, emailed to the owners.
   *
   * Fired and forgotten: this function is called from request paths that have
   * already failed, and making them wait on a database write and an email would
   * turn one broken response into a slow broken response. The import is dynamic
   * so nothing on the happy path pays for a module it never uses.
   *
   * `level: "info"` is how a caller records something notable that is not a
   * fault — an account deletion, say — which belongs in the log without waking
   * anyone at three in the morning.
   */
  if (context.level !== "info") {
    void import("./error-alert")
      .then((m) =>
        m.alertOwners({
          area: String(context.area ?? "unknown"),
          message: payload.message,
          stack: payload.stack,
          context,
        }),
      )
      .catch(() => {});
  }

  const endpoint = process.env.ERROR_WEBHOOK_URL;
  if (!endpoint) return;

  // Never let reporting failures surface as application failures.
  void fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}
