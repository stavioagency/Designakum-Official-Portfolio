import { getPortfolioById } from "@/lib/portfolios";
import { EVENT_KINDS, recordPortfolioEvent, type EventKind } from "@/lib/analytics";
import { callerFingerprint, rateLimit } from "@/lib/rate-limit";

/**
 * Interaction pings from a public portfolio (WhatsApp, social and project clicks).
 * Views are counted server-side during render; this route only exists for the
 * things that happen after the page is on screen.
 */
export async function POST(request: Request) {
  const fingerprint = await callerFingerprint();
  const limit = rateLimit(`track:${fingerprint}`, 60, 60_000);
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
  if (!getPortfolioById(body.portfolioId)) return new Response(null, { status: 404 });

  recordPortfolioEvent(body.portfolioId, kind);
  return new Response(null, { status: 204 });
}
