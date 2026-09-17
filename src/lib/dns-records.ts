/**
 * Which DNS record a customer's domain needs, and what goes in its name column.
 *
 * Its own module because it is pure and because the panel used to ask every
 * customer for `CNAME @`, which is illegal DNS: the zone apex carries its own
 * SOA and NS records and a CNAME may not sit beside anything at the same name,
 * so registrars refuse to create it. Nobody with a root domain could follow the
 * instructions. Rules with that failure mode belong somewhere a test can reach.
 */

/**
 * A heuristic rather than the public suffix list, which is a fifteen thousand
 * line file this does not need to ship. Being wrong costs one wrong row in a
 * table of three, and verification accepts either record regardless.
 */
const SECOND_LEVEL = new Set(["co", "com", "net", "org", "gov", "edu", "ac", "sch", "med"]);

/**
 * The second-to-last label decides it, not the second.
 *
 * Written the other way round first, which read the right label only for a
 * three-label name: portfolio.example.co.uk came out with a root of
 * "co.uk" missing its middle, and the customer was told to create a record
 * named "portfolio.example". The test found it before anybody typed it in.
 */
const rootLabelCount = (labels: string[]) =>
  labels.length >= 3 && SECOND_LEVEL.has(labels[labels.length - 2]) ? 3 : 2;

/** True for example.com and example.co.uk, false for www.example.com. */
export function isApex(hostname: string): boolean {
  const labels = hostname.split(".");
  return labels.length <= rootLabelCount(labels);
}

/** What goes in the Name column for a subdomain: the part in front of the root. */
export function subdomainLabel(hostname: string): string {
  const labels = hostname.split(".");
  return labels.slice(0, labels.length - rootLabelCount(labels)).join(".") || "@";
}
