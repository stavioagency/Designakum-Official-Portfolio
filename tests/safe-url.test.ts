import { test } from "node:test";
import assert from "node:assert/strict";
import { safeUrl, isSafeUrl, socialHref } from "../src/lib/safe-url.ts";

test("rejects script-bearing schemes", () => {
  for (const hostile of [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "  javascript:alert(document.cookie)  ",
    "java\tscript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
  ]) {
    assert.equal(safeUrl(hostile), null, `expected ${hostile} to be rejected`);
    assert.equal(isSafeUrl(hostile), false);
  }
});

test("keeps ordinary links and assumes https for bare domains", () => {
  assert.equal(safeUrl("https://behance.net/me"), "https://behance.net/me");
  assert.equal(safeUrl("http://example.com/a?b=1"), "http://example.com/a?b=1");
  assert.equal(safeUrl("behance.net/me"), "https://behance.net/me");
});

test("treats empty input as no link", () => {
  assert.equal(safeUrl(""), null);
  assert.equal(safeUrl("   "), null);
  assert.equal(safeUrl(null), null);
  assert.equal(safeUrl(undefined), null);
});

test("builds mailto links only from real addresses", () => {
  assert.equal(socialHref("email", "hi@studio.com"), "mailto:hi@studio.com");
  assert.equal(socialHref("email", "not-an-address"), null);
  assert.equal(socialHref("email", "javascript:alert(1)"), null);
});

test("social links go through the same filter", () => {
  assert.equal(socialHref("instagram", "javascript:alert(1)"), null);
  assert.equal(socialHref("instagram", "instagram.com/me"), "https://instagram.com/me");
});
