import "server-only";
import { run } from "./db";
import { newId } from "./ids";
import { DEFAULT_LOCALE } from "./i18n";
import type { Locale, Portfolio } from "./types";

/**
 * The words a brand-new portfolio opens with.
 *
 * In the language the person chose at the gate, not always Arabic: an English
 * sign-up used to land in a dashboard full of Arabic placeholder copy they then
 * had to delete line by line.
 */
const STARTER: Record<Locale, {
  title: string;
  tagline: string;
  bio: string;
  slides: [headline: string, subline: string][];
  stats: [label: string, value: string, icon: string][];
}> = {
  ar: {
    title: "مصمم جرافيك",
    tagline: "خلّك دائمًا مميز مع تصميم يناسبك",
    bio: "مصمم يهتم بالتفاصيل الصغيرة قبل الكبيرة. أعمل على الهويات البصرية، تصاميم السوشال ميديا، والمطبوعات — بنتيجة نظيفة تخدم رسالتك وتوصلها بوضوح.",
    slides: [
      ["أهلاً وسهلاً بكم", ""],
      ["أعمال تليق بعلامتك", "خلّك دائمًا مميز مع تصميم يناسبك"],
    ],
    stats: [
      ["التقييم", "4.9", "star"],
      ["الأعمال", "+120", "briefcase"],
      ["العملاء", "+40", "users"],
    ],
  },
  en: {
    title: "Graphic Designer",
    tagline: "Design that makes your brand impossible to ignore",
    bio: "A designer who sweats the small details before the big ones. I work on brand identities, social media design and print — clean results that carry your message and land it clearly.",
    slides: [
      ["Welcome", ""],
      ["Work worthy of your brand", "Design that makes your brand impossible to ignore"],
    ],
    stats: [
      ["Rating", "4.9", "star"],
      ["Projects", "120+", "briefcase"],
      ["Clients", "40+", "users"],
    ],
  },
};

/** The default job title a new account starts with, in their own language. */
export const starterTitle = (locale: Locale = DEFAULT_LOCALE) => STARTER[locale].title;

/** Give a brand-new portfolio something presentable to look at on first login. */
export async function seedStarterContent(portfolio: Portfolio, locale: Locale = DEFAULT_LOCALE) {
  const copy = STARTER[locale] ?? STARTER[DEFAULT_LOCALE];

  for (const [position, [headline, subline]] of copy.slides.entries()) {
    await run(
      `INSERT INTO slides (id, portfolio_id, image_url, headline, subline, caption, position)
       VALUES (?, ?, '', ?, ?, '', ?)`,
      newId("sld"),
      portfolio.id,
      headline,
      subline || portfolio.title || copy.title,
      position,
    );
  }

  for (const [position, [label, value, icon]] of copy.stats.entries()) {
    await run(
      "INSERT INTO stats (id, portfolio_id, label, value, icon, position) VALUES (?, ?, ?, ?, ?, ?)",
      newId("stt"),
      portfolio.id,
      label,
      value,
      icon,
      position,
    );
  }

  await run(
    "INSERT INTO socials (id, portfolio_id, platform, url, position) VALUES (?, ?, 'instagram', '', 0)",
    newId("soc"),
    portfolio.id,
  );

  await run(
    "UPDATE portfolios SET tagline = ?, bio = ?, locale = ? WHERE id = ?",
    copy.tagline,
    copy.bio,
    locale,
    portfolio.id,
  );
}
