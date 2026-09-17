import "./resolve-hooks.mjs";
import assert from "node:assert/strict";
import test, { describe } from "node:test";

const { pointsHere } = await import("../src/lib/domains.ts");
const { isApex, subdomainLabel } = await import("../src/lib/dns-records.ts");

/**
 * The bug these exist for: the panel asked every customer for `CNAME @`, which
 * is illegal DNS. The zone apex carries its own SOA and NS records and a CNAME
 * cannot sit beside anything, so registrars refuse to create it. Nobody with a
 * root domain could follow the instructions, and the verifier would have
 * rejected the correct records if they had.
 */
describe("which record a domain needs", () => {
  test("a root domain is a root domain", () => {
    assert.equal(isApex("designakum.site"), true);
    assert.equal(isApex("example.com"), true);
  });

  test("a country second level is still a root domain", () => {
    assert.equal(isApex("example.co.uk"), true);
    assert.equal(isApex("example.com.sa"), true);
  });

  test("anything under one is a subdomain", () => {
    assert.equal(isApex("www.example.com"), false);
    assert.equal(isApex("portfolio.example.co.uk"), false);
  });

  test("the name column shows the label, not the whole host", () => {
    assert.equal(subdomainLabel("www.example.com"), "www");
    assert.equal(subdomainLabel("portfolio.example.co.uk"), "portfolio");
    assert.equal(subdomainLabel("a.b.example.com"), "a.b");
  });
});

describe("accepting either way of pointing here", () => {
  const target = "designakum.com";
  const ours = ["216.198.79.1"];

  test("a subdomain with a CNAME", () => {
    assert.equal(pointsHere(["designakum.com"], [], target, ours), true);
  });

  test("a root domain with an A record", () => {
    assert.equal(pointsHere([], ["216.198.79.1"], target, ours), true);
  });

  test("a root domain pointed somewhere else entirely", () => {
    assert.equal(pointsHere([], ["203.0.113.9"], target, ours), false);
  });

  test("nothing configured", () => {
    assert.equal(pointsHere([], [], target, ours), false);
  });

  test("one of several addresses matching is enough", () => {
    // A host may answer on more than one address, and a customer may have been
    // given a different one from the one we resolve at check time.
    assert.equal(pointsHere([], ["203.0.113.9", "216.198.79.1"], target, ours), true);
  });

  test("a platform whose own lookup failed never passes a domain", () => {
    assert.equal(pointsHere([], ["216.198.79.1"], target, []), false);
  });
});
