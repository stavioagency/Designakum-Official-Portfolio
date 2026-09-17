import test, { after, describe } from "node:test";
import assert from "node:assert/strict";
import { closePool, CONNECTION_STRING } from "./helpers.mjs";

process.env.DATABASE_URL ??= CONNECTION_STRING;

/**
 * Every query the console analytics page runs, actually run.
 *
 * The page died with a bare "This page couldn't be shown" because one of these
 * was invalid SQL: a GROUP BY that SQLite accepted and Postgres does not. It
 * had been broken since the move between the two, and nothing caught it,
 * because every other test exercises the numbers rather than the statements.
 * These do not assert on values; they assert that the database accepts the
 * query at all, which is the failure that takes a page down.
 */
const a = await import("../src/lib/analytics.ts");

after(async () => await closePool());

const queries = [
  ["eventSeries, 30 days", () => a.eventSeries("view", 30)],
  ["eventSeries, all time", () => a.eventSeries("view")],
  ["uniqueVisitorSeries", () => a.uniqueVisitorSeries(30)],
  ["registrationSeries", () => a.registrationSeries(30)],
  ["subscriptionSeries", () => a.subscriptionSeries(30)],
  ["eventTotal, windowed", () => a.eventTotal("whatsapp", 30)],
  ["eventTotal, all time", () => a.eventTotal("whatsapp")],
  ["uniqueVisitorTotal, windowed", () => a.uniqueVisitorTotal(30)],
  ["uniqueVisitorTotal, all time", () => a.uniqueVisitorTotal()],
  ["revenueSnapshot", () => a.revenueSnapshot()],
  ["churnRate", () => a.churnRate(30)],
  ["conversionRate", () => a.conversionRate()],
  // The one that was broken. Both branches: only the windowed one aggregates.
  ["topPortfolios, windowed", () => a.topPortfolios(8, 30)],
  ["topPortfolios, all time", () => a.topPortfolios(8)],
];

describe("the console analytics page's queries are valid SQL", () => {
  for (const [name, run] of queries) {
    test(name, async () => {
      await assert.doesNotReject(run, `Postgres refused the query behind ${name}`);
    });
  }
});
