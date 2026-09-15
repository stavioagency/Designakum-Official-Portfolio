import "server-only";
import { run } from "./db";
import { newId } from "./ids";
import type { Portfolio } from "./types";

/** Give a brand-new portfolio something presentable to look at on first login. */
export async function seedStarterContent(portfolio: Portfolio) {
  const slide = async (headline: string, subline: string, position: number) =>
    await run(
      "INSERT INTO slides (id, portfolio_id, image_url, headline, subline, caption, position) VALUES (?, ?, '', ?, ?, '', ?)",
      newId("sld"),
      portfolio.id,
      headline,
      subline,
      position,
    );

  await slide("أهلاً وسهلاً بكم", portfolio.title || "مصمم جرافيك", 0);
  await slide("أعمال تليق بعلامتك", "خلّك دائمًا مميز مع تصميم يناسبك", 1);

  const stat = async (label: string, value: string, icon: string, position: number) =>
    await run(
      "INSERT INTO stats (id, portfolio_id, label, value, icon, position) VALUES (?, ?, ?, ?, ?, ?)",
      newId("stt"),
      portfolio.id,
      label,
      value,
      icon,
      position,
    );

  await stat("التقييم", "4.9", "star", 0);
  await stat("الأعمال", "+120", "briefcase", 1);
  await stat("العملاء", "+40", "users", 2);

  await run(
    "INSERT INTO socials (id, portfolio_id, platform, url, position) VALUES (?, ?, 'instagram', '', 0)",
    newId("soc"),
    portfolio.id,
  );

  await run(
    "UPDATE portfolios SET tagline = ?, bio = ? WHERE id = ?",
    "خلّك دائمًا مميز مع تصميم يناسبك",
    "مصمم يهتم بالتفاصيل الصغيرة قبل الكبيرة. أعمل على الهويات البصرية، تصاميم السوشال ميديا، والمطبوعات — بنتيجة نظيفة تخدم رسالتك وتوصلها بوضوح.",
    portfolio.id,
  );
}
