import { getPortfolioById } from "@/lib/portfolios";
import { EVENT_KINDS, recordPortfolioEvent, type EventKind } from "@/lib/analytics";
import { callerFingerprint, rateLimit } from "@/lib/rate-limit";
import { callerIsBot } from "@/lib/bots";

/**
 * Interaction pings from a public portfolio (WhatsApp, social and project clicks).
 * Views are counted server-side during render; this route only exists for the
 * things that happen after the page is on screen.
 */
export async function POST(request: Request) {
  const fingerprint = await callerFingerprint();
  const limit = await rateLimit(`track:${fingerprint}`, 60, 60_000);
  if (!limit.ok) return new Response(null, { status: 429 });

  let body: { portfolioId?: string; kind?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const kind = body.kind as EventKind;
  if (!body.portfolioId || !EVENT_KINDS.includes(kind) || kind === "view") {
    return new Response(null, { status: 400 });
  }
  if (!await getPortfolioById(body.portfolioId)) return new Response(null, { status: 404 });

  // A crawler cannot click a WhatsApp button, so anything claiming to have done
  // so is a bot running JavaScript. The request is still well-formed, so it is
  // accepted and simply not counted.
  if (!(await callerIsBot())) await recordPortfolioEvent(body.portfolioId, kind);
  return new Response(null, { status: 204 });
}
