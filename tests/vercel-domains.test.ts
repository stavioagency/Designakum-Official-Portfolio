import "./resolve-hooks.mjs";
import assert from "node:assert/strict";
import test, { describe } from "node:test";

const { readAttach } = await import("../src/lib/vercel-domains.ts");

describe("what the host's answer means", () => {
  test("created", () => {
    assert.deepEqual(readAttach(200, { name: "example.com" }), { ok: true, detail: "added" });
  });

  test("already on this project is a success, not a failure", () => {
    // The customer removed and re-added, or a member of staff attached it by
    // hand first. Either way the hostname is served, which is all we wanted.
    const result = readAttach(409, { error: { code: "domain_already_in_use_by_this_project" } });
    assert.equal(result.ok, true);
    assert.equal(result.detail, "already-there");
  });

  test("held by someone else is a failure the customer has to resolve", () => {
    const result = readAttach(409, { error: { code: "domain_already_in_use_by_different_project" } });
    assert.equal(result.ok, false);
    assert.equal(result.detail, "taken");
  });

  test("an unexpected refusal is not read as success", () => {
    assert.equal(readAttach(403, { error: { code: "forbidden" } }).ok, false);
    assert.equal(readAttach(500, null).ok, false);
    assert.equal(readAttach(400, { error: { code: "invalid_domain" } }).detail, "refused");
  });
});
