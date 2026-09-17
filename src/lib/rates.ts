import "server-only";
import { CURRENCIES, type CurrencyCode } from "./currency";
import { readSettings, writeSetting } from "./settings";
import { now } from "./db";

/**
 * What a pound and an Australian dollar are worth today.
 *
 * The Gulf currencies are pegged by their central banks and have not moved in
 * decades, so they live in the code. Sterling and the Australian dollar float,
 * and the numbers that shipped with the platform were my own approximations:
 * fine for a page that says "approximately", wrong as a permanent answer.
 *
 * Rates come from the European Central Bank's daily reference set, published
 * through frankfurter.app. The ECB is a primary source rather than an
 * aggregator, it needs no account or key, and it updates once a working day,
 * which is the right resolution for a price shown beside the exact amount that
 * will actually be charged.
 *
 * Three things this must never do: block a page render, show nothing, or let a
 * bad response through. So the fetch happens after the response is sent, every
 * answer has a fallback behind it, and a number that has moved implausibly far
 * is refused rather than published as a price.
 */

/** Only the floating ones. A "live" peg would be a fetch that can only do harm. */
export const LIVE_CURRENCIES = ["GBP", "AUD"] as const;
export type LiveCurrency = (typeof LIVE_CURRENCIES)[number];

// The canonical host. The older frankfurter.app answers with a redirect.
const ENDPOINT = "https://api.frankfurter.dev/v1/latest";
/** One working day, with room for a weekend and a bank holiday. */
export const STALE_AFTER = 20 * 60 * 60 * 1000;

/**
 * The range each rate has actually lived in, generously drawn.
 *
 * A multiple of the built-in figure was the obvious rule and the wrong one: a
 * band wide enough for a decade of drift is also wide enough to admit the
 * response with the units the wrong way round, which is the single most likely
 * way a currency feed goes wrong, and prices the page from a number that is
 * arithmetically fine and completely false.
 *
 * These are the real historical bounds instead, with room on both sides:
 *  - Sterling has been worth more than a dollar for the whole floating era, so
 *    pounds-per-dollar has never reached 1. Its low was about 0.48 in 2007.
 *  - The Australian dollar ran from about 0.90 per dollar in 2011 to about 2.0
 *    in 2001.
 * Anything outside these is not a market move, it is a broken answer.
 */
const RANGE: Record<LiveCurrency, { min: number; max: number }> = {
  GBP: { min: 0.4, max: 0.99 },
  AUD: { min: 0.85, max: 2.2 },
};

export function plausible(code: LiveCurrency, value: unknown): value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return false;
  const band = RANGE[code];
  return value >= band.min && value <= band.max;
}

export function isStale(updatedAt: number, at = Date.now()): boolean {
  return !updatedAt || at - updatedAt > STALE_AFTER;
}

/**
 * The rate to price with, and where it came from.
 *
 * An owner's typed-in number outranks the feed. They may be matching what their
 * accountant uses, or holding a rate steady through a bad week, and a background
 * job silently overwriting that decision every night would be the platform
 * arguing with the person who runs it.
 */
export type RateSource = "manual" | "live" | "built-in";

export function pickRate(
  code: LiveCurrency,
  manual: number,
  live: number,
  liveUpdatedAt: number,
): { rate: number; source: RateSource } {
  if (manual > 0) return { rate: manual, source: "manual" };
  // A stale live rate still beats a guess written into the source code.
  if (plausible(code, live)) return { rate: live, source: liveUpdatedAt ? "live" : "built-in" };
  return { rate: CURRENCIES[code].perUsd, source: "built-in" };
}

export interface RateReading {
  rate: number;
  source: RateSource;
  /** When the feed last answered, in epoch milliseconds. Zero if it never has. */
  updatedAt: number;
  /** The ECB's own date for the figures, e.g. "2026-09-16". */
  asOf: string;
}

export async function currentRates(): Promise<Record<LiveCurrency, RateReading>> {
  const settings = await readSettings();
  const updatedAt = settings["rates.updated_at"];
  const asOf = settings["rates.as_of"];

  const read = (code: LiveCurrency, manual: number, live: number): RateReading => ({
    ...pickRate(code, manual, live, updatedAt),
    updatedAt,
    asOf,
  });

  return {
    GBP: read("GBP", settings["pricing.gbp_per_usd"], settings["rates.gbp_per_usd"]),
    AUD: read("AUD", settings["pricing.aud_per_usd"], settings["rates.aud_per_usd"]),
  };
}

/** Just the numbers, in the shape `fromUsd` takes. */
export async function rateOverrides(): Promise<Partial<Record<CurrencyCode, number>>> {
  const rates = await currentRates();
  return { GBP: rates.GBP.rate, AUD: rates.AUD.rate };
}

export function parseFeed(body: unknown): { rates: Record<string, number>; date: string } | null {
  if (!body || typeof body !== "object") return null;
  const payload = body as { base?: unknown; rates?: unknown; date?: unknown };
  // Anything but a dollar base would be a silently wrong price.
  if (payload.base !== "USD") return null;
  if (!payload.rates || typeof payload.rates !== "object") return null;
  return {
    rates: payload.rates as Record<string, number>,
    date: typeof payload.date === "string" ? payload.date : "",
  };
}

/**
 * Fetches and stores, if the stored figures are old enough to be worth it.
 *
 * Returns quietly on any failure. A rate feed that is down is not an incident:
 * the previous figures are still there, they are still marked approximate on the
 * page, and the exact charge beside them never came from here.
 */
export async function refreshRates(force = false): Promise<boolean> {
  try {
    const settings = await readSettings();
    if (!force && !isStale(settings["rates.updated_at"])) return false;

    const response = await fetch(`${ENDPOINT}?base=USD&symbols=${LIVE_CURRENCIES.join(",")}`, {
      // Our own cache is the settings row; Next's would hide staleness from it.
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;

    const feed = parseFeed(await response.json());
    if (!feed) return false;

    // Written one at a time, and only the ones that pass: a feed that answers
    // sensibly for sterling and nonsense for the Australian dollar should update
    // sterling rather than be thrown away whole.
    let wrote = false;
    for (const code of LIVE_CURRENCIES) {
      const value = feed.rates[code];
      if (!plausible(code, value)) continue;
      await writeSetting(
        code === "GBP" ? "rates.gbp_per_usd" : "rates.aud_per_usd",
        value,
        "system",
      );
      wrote = true;
    }

    if (!wrote) return false;
    await writeSetting("rates.as_of", feed.date, "system");
    await writeSetting("rates.updated_at", now(), "system");
    return true;
  } catch {
    return false;
  }
}
