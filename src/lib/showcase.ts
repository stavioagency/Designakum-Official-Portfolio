/**
 * Which published pages the landing page shows, and in what order.
 *
 * The owner names them in console settings; everything else here is what
 * happens when that naming no longer matches reality. A named page can be
 * unpublished, suspended, renamed or deleted at any moment by the person who
 * owns it, and none of that may leave the marketing page with an empty space
 * where the product is meant to be — so a name that no longer resolves is
 * skipped, and the remaining slots are filled from whatever is published.
 *
 * Pure, so the rules can be tested without a database.
 */

export interface ShowcasePage {
  slug: string;
  locale: string;
}

export const SHOWCASE_SLOTS = 3;

export function pickShowcase<T extends ShowcasePage>(
  published: T[],
  /** The owner's chosen slugs, in order. Blanks and unknown names are ignored. */
  chosen: (string | null | undefined)[],
  /** The reader's language, preferred when filling the empty slots. */
  locale: string,
  limit = SHOWCASE_SLOTS,
): T[] {
  const picked: T[] = [];
  const taken = new Set<string>();

  const take = (page: T | undefined) => {
    if (!page || taken.has(page.slug) || picked.length >= limit) return;
    taken.add(page.slug);
    picked.push(page);
  };

  for (const slug of chosen) {
    const wanted = (slug ?? "").trim();
    if (wanted) take(published.find((page) => page.slug === wanted));
  }

  /**
   * The reader's own language first among the rest.
   *
   * This is the example of what they are buying, and an Arabic visitor shown an
   * English page learns the wrong thing about it. It does not reorder what the
   * owner named — that was a deliberate choice and outranks the guess.
   */
  const rest = published
    .filter((page) => !taken.has(page.slug))
    .sort((a, b) => Number(b.locale === locale) - Number(a.locale === locale));

  for (const page of rest) take(page);

  return picked;
}
