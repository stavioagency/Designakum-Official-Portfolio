import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { exportAccount } from "@/lib/account-data";
import { callerFingerprint, rateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/observability";

export const dynamic = "force-dynamic";

/**
 * A copy of everything we hold, as a file.
 *
 * A download rather than a page: this is the customer's record to keep, and a
 * page they have to select and copy is not a copy of their data, it is a
 * picture of it.
 *
 * Rate limited because it reads the whole account — several tables and every
 * ticket — and nothing else on the site invites a signed-in visitor to do that
 * repeatedly.
 */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const limit = await rateLimit(`export:${user.id}`, 5, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  try {
    const data = await exportAccount(user);
    const day = new Date().toISOString().slice(0, 10);

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="designakum-${user.id}-${day}.json"`,
        // Never stored by a proxy or the browser: it is one person's whole
        // account in one file.
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    reportError(error, { area: "account-export", userId: user.id });
    return NextResponse.json({ error: "export_failed" }, { status: 500 });
  }
}
