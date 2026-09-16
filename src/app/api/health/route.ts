import { get } from "@/lib/db";

/**
 * Says why the platform is not working, without saying anything secret.
 *
 * A missing environment variable used to surface as a bare 500 from the hosting
 * platform, with the real reason only in a log the person deploying may not be
 * able to reach. This answers the same question over HTTP.
 *
 * It reports whether each variable is *present*, never its value, and the
 * database check is a `SELECT 1` — it proves the connection works without
 * reading a single row of anyone's data.
 */
export const dynamic = "force-dynamic";

const present = (name: string) => Boolean(process.env[name]?.trim());

export async function GET() {
  const config = {
    AUTH_SECRET: present("AUTH_SECRET") && (process.env.AUTH_SECRET?.length ?? 0) >= 32,
    DATABASE_URL: present("DATABASE_URL"),
    SITE_URL: present("SITE_URL"),
    STORAGE_DRIVER: process.env.STORAGE_DRIVER ?? "local",
    SUPABASE_URL: present("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: present("SUPABASE_SERVICE_ROLE_KEY"),
    EMAIL_API_KEY: present("EMAIL_API_KEY"),
    PAYPAL_CLIENT_ID: present("PAYPAL_CLIENT_ID"),
    PAYPAL_WEBHOOK_ID: present("PAYPAL_WEBHOOK_ID"),
  };

  let database: { ok: boolean; error?: string };
  try {
    await get("SELECT 1 AS ok");
    database = { ok: true };
  } catch (error) {
    // The driver's message names the host and the failure mode, which is what
    // makes this worth returning; it carries no credentials.
    database = { ok: false, error: error instanceof Error ? error.message : "unknown" };
  }

  const required = config.AUTH_SECRET && config.DATABASE_URL && database.ok;

  return Response.json(
    { ok: required, config, database },
    {
      status: required ? 200 : 503,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    },
  );
}
