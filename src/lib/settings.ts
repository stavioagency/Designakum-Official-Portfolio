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
  // Starter drafts so a fresh install is never legally blank. They are written to
  // be reviewed by a lawyer and edited in the console, not treated as final text.
  "policy.terms": `مسودة — تحتاج مراجعة قانونية قبل الاعتماد.

١. عن الخدمة
ديزاينكم منصة تتيح للمصممين والمستقلين إنشاء صفحة أعمال على رابط خاص بهم، وتعديلها ونشرها. تُقدَّم الخدمة عبر الإنترنت باشتراك شهري أو سنوي.

٢. الحساب
• أنت مسؤول عن صحة البيانات التي تسجّلها، وعن الحفاظ على سرية كلمة مرورك.
• الحساب شخصي، ولا يجوز مشاركته أو بيعه أو نقله لطرف آخر دون موافقتنا.
• يجب ألا يقل عمرك عن ١٨ عامًا، أو أن يكون لديك تفويض نظامي بالتعاقد.

٣. الاشتراك والدفع
• الأسعار معروضة في صفحة الأسعار بالريال السعودي، وقد تشمل ضريبة القيمة المضافة حسب النظام.
• يتجدد الاشتراك تلقائيًا في نهاية كل فترة ما لم توقف التجديد من لوحتك.
• إيقاف التجديد يبقي اشتراكك فعّالًا حتى نهاية الفترة المدفوعة.
• الاسترداد: يحق لك طلب استرداد خلال ١٤ يومًا من أول اشتراك إذا لم تستخدم الخدمة استخدامًا جوهريًا. بعد ذلك لا تُسترد المبالغ عن فترة جارية، ما لم يقضِ النظام بغير ذلك.

٤. المحتوى الذي تنشره
• تبقى ملكية أعمالك وصورك ونصوصك لك بالكامل.
• تمنحنا ترخيصًا محدودًا لعرض هذا المحتوى داخل المنصة لغرض تشغيل الخدمة فقط.
• أنت تقرّ بأنك تملك الحق في نشر ما ترفعه، وأنه لا ينتهك حقوق غيرك.

٥. الاستخدام المقبول
يُمنع نشر محتوى مخالف لأنظمة المملكة العربية السعودية، أو أعمال منسوبة لغير صاحبها، أو محتوى مسيء أو مضلل، أو بيانات تواصل مزيفة، أو أي محاولة لاختراق المنصة أو إساءة استخدامها.

٦. الإيقاف والإنهاء
• قد نوقف عرض صفحة مخالفة أو نوقف الحساب بعد مراجعة بلاغ، ونبلّغك بالسبب.
• يبقى محتواك محفوظًا أثناء الإيقاف، ويمكنك الاعتراض عبر الدعم الفني.
• يمكنك إنهاء اشتراكك في أي وقت من لوحتك.

٧. حدود المسؤولية
نبذل جهدًا معقولًا لإبقاء الخدمة متاحة، لكننا لا نضمن استمراريتها دون انقطاع. مسؤوليتنا في جميع الأحوال لا تتجاوز ما دفعته خلال الاثني عشر شهرًا السابقة للمطالبة.

٨. التعديلات
قد نحدّث هذه الشروط، ونخطرك بالتغييرات الجوهرية عبر البريد أو داخل لوحتك قبل سريانها.

٩. النظام الواجب التطبيق
تخضع هذه الشروط لأنظمة المملكة العربية السعودية، وتختص جهات القضاء السعودية بالنظر في أي نزاع.

١٠. التواصل
لأي استفسار بخصوص هذه الشروط، تواصل معنا عبر الدعم الفني داخل لوحتك أو على بريد الدعم المعلن في المنصة.`,
  "policy.privacy": `مسودة — تحتاج مراجعة قانونية قبل الاعتماد.

١. البيانات التي نجمعها
• بيانات الحساب: الاسم، البريد الإلكتروني، وكلمة المرور مشفّرة (لا نطّلع عليها).
• بيانات الملف: ما تدخله بنفسك من اسم ووصف وصور وأعمال وروابط ورقم تواصل.
• بيانات الاستخدام: عدد مشاهدات صفحتك، وعدد النقرات على أزرار التواصل، وبصمة تقنية غير معرّفة لعدّ الزوار المختلفين يوميًا.
• بيانات الدفع: تُعالَج لدى مزوّد الدفع مباشرة. لا نخزّن أرقام البطاقات على خوادمنا.

٢. لماذا نجمعها
لتشغيل حسابك وعرض صفحتك، ولحماية المنصة من الإساءة، ولإصدار الفواتير وإدارة الاشتراك، ولتحسين الخدمة.

٣. مع من تُشارَك
• مزوّد الدفع، لتنفيذ عمليات الاشتراك.
• مزوّد البريد، لإرسال رسائل تشغيلية مثل استعادة كلمة المرور.
• مزوّد الاستضافة الذي تعمل عليه المنصة.
لا نبيع بياناتك، ولا نشاركها لأغراض تسويقية مع أي طرف ثالث.

٤. ما يظهر للعامة
صفحتك العامة — ومحتواها الذي اخترت نشره — متاحة لأي شخص لديه الرابط، وقد تفهرسها محركات البحث. بريدك الإلكتروني وكلمة مرورك وبيانات اشتراكك لا تظهر أبدًا في الصفحة العامة.

٥. مدة الحفظ
نحتفظ ببيانات حسابك ما دام الحساب قائمًا. عند الحذف تُمحى بياناتك وصورك ومعارضك، مع الاحتفاظ بالحد الأدنى من سجلات الفوترة والإشراف الذي تفرضه الأنظمة.

٦. حقوقك
وفقًا لنظام حماية البيانات الشخصية في المملكة، لك الحق في الاطلاع على بياناتك، وتصحيحها، وطلب حذفها، وسحب موافقتك. تواصل معنا عبر الدعم لتنفيذ أي من ذلك.

٧. ملفات الارتباط
نستخدم ملف ارتباط واحدًا أساسيًا لإبقائك مسجّلًا للدخول، وملفًا لتذكّر لغة الواجهة. لا نستخدم ملفات تتبّع إعلانية.

٨. الأمان
كلمات المرور مخزّنة بتجزئة scrypt، والاتصال مشفّر، والوصول الإداري محصور بفريق المنصة ومسجّل في سجل تدقيق.

٩. التواصل
لأي سؤال عن خصوصيتك أو لممارسة حقوقك، تواصل معنا عبر الدعم الفني أو بريد الدعم المعلن في المنصة.`,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = { [K in SettingKey]: (typeof SETTING_DEFAULTS)[K] };

type StoredRow = { key: string; value: string };

/** Reads every setting, overlaying stored overrides on the defaults. */
export async function readSettings(): Promise<Settings>{
  const stored = await all<StoredRow>("SELECT key, value FROM settings");
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

export async function readSetting<K extends SettingKey>(key: K): Promise<Settings[K]>{
  return (await readSettings())[key];
}

export async function writeSetting<K extends SettingKey>(key: K, value: Settings[K], actorId: string) {
  await run(
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
