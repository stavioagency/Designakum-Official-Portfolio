import "server-only";
import { all, now, run } from "./db";

/**
 * Anything an owner might reasonably want to change lives here rather than in the
 * code. Defaults are the source of truth for shape and fallback value; the
 * `settings` table only ever holds overrides.
 */
export const SETTING_DEFAULTS = {
  "brand.name_ar": "ديزاينكم",
  "brand.name_en": "Designakum",
  "brand.tagline_ar": "منصة معارض الأعمال",
  "brand.tagline_en": "The portfolio platform",
  "brand.support_email": "support@designakum.sa",

  "pricing.monthly_halalas": 1200,
  "pricing.yearly_halalas": 12000,

  "limits.free_projects": 6,
  "limits.free_slides": 2,

  "platform.maintenance": false,
  "platform.maintenance_includes_portfolios": true,
  "platform.maintenance_message":
    "المنصة تحت الصيانة حاليًا، وسنعود خلال وقت قصير. شكرًا لصبركم.",
  "platform.signups_open": true,
  "platform.invite_only": false,

  "features.google_signin": true,
  "features.public_showcase": true,
  "features.reports": true,
  "features.support": true,

  "support.hours": "الأحد إلى الخميس، 9 صباحًا حتى 5 مساءً",
  "support.intro": "اكتب مشكلتك بالتفصيل وسنرد عليك في أقرب وقت.",

  "rules.portfolio":
    "يمنع نشر محتوى مخالف للأنظمة السعودية، أو أعمال منسوبة لغير صاحبها، أو محتوى مسيء أو مضلل، أو بيانات تواصل مزيفة.",
  "policy.terms": "",
  "policy.privacy": "",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = { [K in SettingKey]: (typeof SETTING_DEFAULTS)[K] };

type StoredRow = { key: string; value: string };

/** Reads every setting, overlaying stored overrides on the defaults. */
export function readSettings(): Settings {
  const stored = all<StoredRow>("SELECT key, value FROM settings");
  const merged = { ...SETTING_DEFAULTS } as Record<string, unknown>;

  for (const row of stored) {
    if (!(row.key in SETTING_DEFAULTS)) continue;
    try {
      merged[row.key] = JSON.parse(row.value);
    } catch {
      /* a corrupt row falls back to the default rather than breaking the page */
    }
  }
  return merged as Settings;
}

export function readSetting<K extends SettingKey>(key: K): Settings[K] {
  return readSettings()[key];
}

export function writeSetting<K extends SettingKey>(key: K, value: Settings[K], actorId: string) {
  run(
    `INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`,
    key,
    JSON.stringify(value),
    now(),
    actorId,
  );
}

/** Coerces a form value to the type its default declares. */
export function coerceSetting<K extends SettingKey>(key: K, raw: string): Settings[K] {
  const fallback = SETTING_DEFAULTS[key];
  if (typeof fallback === "boolean") return (raw === "1" || raw === "true") as Settings[K];
  if (typeof fallback === "number") {
    const parsed = Number(raw);
    return (Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback) as Settings[K];
  }
  return raw as Settings[K];
}
