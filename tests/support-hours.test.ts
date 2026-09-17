import "./resolve-hooks.mjs";
import test, { describe } from "node:test";
import assert from "node:assert/strict";

const { DAYS, TIMES, clockLabel, formatHours, isDay, isTime } = await import(
  "../src/lib/support-hours.ts"
);

describe("writing the opening hours", () => {
  test("both languages come from the same four values", () => {
    const input = { from: "sun", to: "thu", open: "09:00", close: "17:00" };
    assert.equal(formatHours(input, "en"), "Sunday to Thursday, 9am to 5pm");
    assert.equal(formatHours(input, "ar"), "الأحد إلى الخميس، 9 صباحًا حتى 5 مساءً");
  });

  test("a single day does not read as a range", () => {
    const input = { from: "fri", to: "fri", open: "10:00", close: "14:00" };
    assert.equal(formatHours(input, "en"), "Friday, 10am to 2pm");
    assert.ok(!formatHours(input, "en").includes(" to Friday"));
  });

  test("half hours survive, and noon and midnight get their own words", () => {
    assert.equal(clockLabel("09:30", "en"), "9:30am");
    assert.equal(clockLabel("12:00", "en"), "12pm");
    assert.equal(clockLabel("12:00", "ar"), "12 ظهرًا");
    assert.equal(clockLabel("00:00", "ar"), "منتصف الليل");
    assert.equal(clockLabel("23:30", "en"), "11:30pm");
  });

  /**
   * These end up in a select whose values a browser will happily post back
   * altered, so anything unrecognised falls to the default rather than being
   * written into a sentence customers read.
   */
  test("nonsense falls back instead of reaching the page", () => {
    const out = formatHours({ from: "xx", to: "yy", open: "99:99", close: "" }, "en");
    assert.equal(out, "Sunday to Thursday, 9am to 5pm");
  });

  test("the pickers offer whole days and half hours", () => {
    assert.equal(DAYS.length, 7);
    assert.equal(TIMES.length, 48, "24 hours at half-hour steps");
    assert.equal(TIMES[0], "00:00");
    assert.equal(TIMES.at(-1), "23:30");
    for (const time of TIMES) assert.equal(isTime(time), true, time);
    for (const day of DAYS) assert.equal(isDay(day), true, day);
  });

  test("Latin digits in Arabic, like everywhere else", () => {
    const arabic = formatHours({ from: "sun", to: "thu", open: "09:00", close: "17:00" }, "ar");
    assert.ok(!/[٠-٩]/.test(arabic));
  });
});
