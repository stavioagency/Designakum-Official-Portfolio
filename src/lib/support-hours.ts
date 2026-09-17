/**
 * When support is open, chosen from lists rather than typed out.
 *
 * It used to be two free-text fields, one per language, which meant writing the
 * same fact twice and keeping the two in step by hand — and the English one
 * quietly showing Arabic to English readers whenever somebody updated only one.
 * Four values now describe it, and each language is written from them.
 *
 * Pure, so the console can preview the sentence as the dropdowns change.
 */

export const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Day = (typeof DAYS)[number];

const DAY_NAMES: Record<Day, { ar: string; en: string }> = {
  sun: { ar: "الأحد", en: "Sunday" },
  mon: { ar: "الاثنين", en: "Monday" },
  tue: { ar: "الثلاثاء", en: "Tuesday" },
  wed: { ar: "الأربعاء", en: "Wednesday" },
  thu: { ar: "الخميس", en: "Thursday" },
  fri: { ar: "الجمعة", en: "Friday" },
  sat: { ar: "السبت", en: "Saturday" },
};

export const isDay = (value: string): value is Day => DAYS.includes(value as Day);

/** Every half hour. Finer than that is a level of precision nobody schedules to. */
export const TIMES: string[] = Array.from({ length: 48 }, (_, i) => {
  const hour = String(Math.floor(i / 2)).padStart(2, "0");
  return `${hour}:${i % 2 ? "30" : "00"}`;
});

export const isTime = (value: string) => /^([01]\d|2[0-3]):(00|30)$/.test(value);

/**
 * 24-hour input, 12-hour output. People set hours on a clock and read them in
 * words, and "17:00" in a sentence reads like a train timetable.
 */
export function clockLabel(value: string, locale: "ar" | "en"): string {
  const [h, m] = value.split(":").map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const minutes = m ? `:${String(m).padStart(2, "0")}` : "";

  if (locale === "ar") {
    // Noon and midnight have their own words; the rest take morning or evening.
    const suffix = h === 12 && m === 0 ? "ظهرًا" : h === 0 && m === 0 ? "منتصف الليل" : h < 12 ? "صباحًا" : "مساءً";
    return h === 0 && m === 0 ? suffix : `${hour12}${minutes} ${suffix}`;
  }
  return `${hour12}${minutes}${h < 12 ? "am" : "pm"}`;
}

export function dayLabel(day: Day, locale: "ar" | "en"): string {
  return DAY_NAMES[day][locale];
}

/** The whole sentence, in one language, from the four stored values. */
export function formatHours(
  input: { from: string; to: string; open: string; close: string },
  locale: "ar" | "en",
): string {
  const from = isDay(input.from) ? input.from : "sun";
  const to = isDay(input.to) ? input.to : "thu";
  const open = isTime(input.open) ? input.open : "09:00";
  const close = isTime(input.close) ? input.close : "17:00";

  const days =
    from === to
      ? dayLabel(from, locale)
      : locale === "ar"
        ? `${dayLabel(from, locale)} إلى ${dayLabel(to, locale)}`
        : `${dayLabel(from, locale)} to ${dayLabel(to, locale)}`;

  const hours =
    locale === "ar"
      ? `${clockLabel(open, locale)} حتى ${clockLabel(close, locale)}`
      : `${clockLabel(open, locale)} to ${clockLabel(close, locale)}`;

  return `${days}، ${hours}`.replace("، ", locale === "ar" ? "، " : ", ");
}
