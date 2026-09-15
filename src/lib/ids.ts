import { randomBytes, randomUUID } from "node:crypto";

export const newId = (prefix: string) => `${prefix}_${randomBytes(9).toString("hex")}`;
export const newToken = () => randomUUID().replace(/-/g, "") + randomBytes(8).toString("hex");

const ARABIC_MAP: Record<string, string> = {
  ا: "a", أ: "a", إ: "i", آ: "a", ب: "b", ت: "t", ث: "th", ج: "j", ح: "h", خ: "kh",
  د: "d", ذ: "dh", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z",
  ع: "a", غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n", ه: "h", و: "w",
  ي: "y", ى: "a", ة: "h", ء: "", ئ: "e", ؤ: "o",
};

/** Slugify Latin or Arabic input into a URL-safe portfolio handle. */
export function slugify(input: string): string {
  const transliterated = [...input.trim().toLowerCase()]
    .map((ch) => ARABIC_MAP[ch] ?? ch)
    .join("");
  return transliterated
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
