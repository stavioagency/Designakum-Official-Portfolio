import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Defaults, deliberately.
 *
 * The incremental cache, tag cache and queue all have Cloudflare-backed
 * implementations (R2, D1, Durable Objects), but this app renders everything
 * per request — `force-dynamic` on every page that reads the database — so
 * there is nothing for them to hold. Adding them now would be three more
 * bindings to configure, pay attention to and get wrong.
 */
export default defineCloudflareConfig();
