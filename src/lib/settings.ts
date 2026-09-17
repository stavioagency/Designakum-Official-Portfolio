import "server-only";
import { cache } from "react";
import type { Locale } from "./types";
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
  // designakum.com, not .sa: the .sa domain has never existed — no nameservers,
  // no MX — so this default put a guaranteed bounce on the support page and in
  // the reply_to of every email the platform sent.
  /**
   * Which published page the landing page shows. Empty falls back to whichever
   * one sorts first, which is how the marketing page came to be demonstrating a
   * portfolio with one link and one project on it.
   */
  "landing.showcase_slug": "",

  "brand.support_email": "support@designakum.com",

  "pricing.monthly_halalas": 1200,
  "pricing.yearly_halalas": 12000,
  // PayPal cannot charge in SAR, so the card is billed in dollars. The riyal is
  // pegged at 3.75/USD, which makes 12 SAR exactly $3.20 — but the rate lives
  // here rather than in the code in case that ever changes.
  "pricing.sar_per_usd": 3.75,
  "pricing.charge_currency": "USD",
  // Floating rates, unlike the Gulf pegs, so they are correctable without a
  // deploy. Zero means "use the value compiled into currency.ts".
  "pricing.gbp_per_usd": 0,
  "pricing.aud_per_usd": 0,

  // Written by the app, not by hand: PayPal's product and plan ids, kept so the
  // catalogue is created once. A plan id is stored as "CUR:amount|id" so a price
  // change produces a new plan instead of silently charging the old one.
  "paypal.product_id": "" as string,
  "paypal.plan_monthly": "" as string,
  "paypal.plan_yearly": "" as string,


  /**
   * English versions of the customer-facing text above.
   *
   * A separate key per language rather than a translation at render time: these
   * are written by the platform owner, and the legal ones by a lawyer. An empty
   * value falls back to the Arabic, so an owner who only writes one language
   * still has a working site in both.
   */
  "platform.maintenance_message_en":
    "The platform is under maintenance and will be back shortly. Thanks for your patience.",
  "support.hours_en": "Sunday to Thursday, 9am to 5pm",

  /**
   * Opening hours, chosen from lists rather than typed. Both languages are
   * written from these four values, so the two can no longer drift apart —
   * which is what happened whenever somebody updated one and not the other.
   */
  "support.day_from": "sun",
  "support.day_to": "thu",
  "support.open_at": "09:00",
  "support.close_at": "17:00",
  "support.intro_en": "Describe the problem in as much detail as you can and we'll get back to you.",
  "rules.portfolio_en":
    "No content that breaks Saudi law, no work credited to someone other than its author, nothing abusive or misleading, and no fake contact details.",
  "policy.terms_en": `Draft — needs legal review before it is adopted.

1. About the service
Designakum is a platform that lets designers and freelancers build a portfolio page on their own link, edit it and publish it. The service is delivered online on a monthly or yearly subscription.

2. Your account
• You are responsible for the accuracy of the details you register, and for keeping your password private.
• The account is personal. It may not be shared, sold or transferred to anyone else without our agreement.
• You must be at least 18, or otherwise legally authorised to enter into this agreement.

3. Subscription and payment
• Prices are shown on the pricing page in Saudi riyals and may include VAT as the law requires.
• The subscription renews automatically at the end of each period unless you stop renewal from your dashboard.
• Stopping renewal keeps your subscription active until the end of the period you have already paid for.
• Refunds: you may request a refund within 14 days of your first subscription if you have not made substantial use of the service. After that, amounts for a period already under way are not refunded unless the law requires otherwise.

4. The content you publish
• Your work, images and words remain entirely yours.
• You grant us a limited licence to display that content inside the platform, for the sole purpose of operating the service.
• You confirm that you have the right to publish what you upload, and that it does not infringe anyone else's rights.

5. Acceptable use
You may not publish content that breaks the laws of the Kingdom of Saudi Arabia, work credited to someone other than its author, abusive or misleading content, or fake contact details — nor make any attempt to break into the platform or abuse it.

6. Suspension and termination
• We may take a non-compliant page down, or suspend an account, after reviewing a report — and we will tell you why.
• Your content is kept while an account is suspended, and you can appeal through support.
• You may end your subscription at any time from your dashboard.

7. Limits of liability
We make reasonable efforts to keep the service available, but we do not guarantee uninterrupted service. Our liability in any case does not exceed what you paid in the twelve months before the claim.

8. Changes
We may update these terms, and we will tell you about material changes by email or in your dashboard before they take effect.

9. Governing law
These terms are governed by the laws of the Kingdom of Saudi Arabia, and the Saudi courts have jurisdiction over any dispute.

10. Contact
For any question about these terms, reach us through support in your dashboard or at the support address published on the platform.`,
  "policy.privacy_en": `Draft — needs legal review before it is adopted.

1. What we collect
• Account details: your name, email address, and your password stored as a hash (we never see it).
• Portfolio content: whatever you enter yourself — name, description, images, work, links and contact number.
• Usage data: how many times your page was viewed, how many times contact buttons were clicked, and a non-identifying technical fingerprint used to count distinct visitors per day.
• Payment data: handled directly by the payment provider. We do not store card numbers on our servers.

2. Why we collect it
To run your account and show your page, to protect the platform from abuse, to issue invoices and manage your subscription, and to improve the service.

3. Who it is shared with
• The payment provider, to process subscriptions.
• The email provider, to send operational messages such as password resets.
• The hosting provider the platform runs on.
We do not sell your data, and we do not share it with any third party for marketing.

4. What is public
Your public page — and the content you chose to publish on it — is available to anyone with the link, and search engines may index it. Your email address, your password and your subscription details never appear on the public page.

5. How long we keep it
We keep your account data for as long as the account exists. On deletion your data, images and portfolios are erased, except for the minimum billing and moderation records the law requires us to retain.

6. Your rights
Under the Personal Data Protection Law of the Kingdom, you have the right to access your data, correct it, request its deletion, and withdraw your consent. Contact us through support to exercise any of these.

7. Cookies
We use one essential cookie to keep you signed in, and one to remember your interface language. We use no advertising trackers.

8. Security
Passwords are stored as scrypt hashes, the connection is encrypted, and administrative access is limited to the platform team and recorded in an audit log.

9. Contact
For any question about your privacy, or to exercise your rights, reach us through support or at the support address published on the platform.`,

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

1. عن الخدمة
ديزاينكم منصة تتيح للمصممين والمستقلين إنشاء صفحة أعمال على رابط خاص بهم، وتعديلها ونشرها. تُقدَّم الخدمة عبر الإنترنت باشتراك شهري أو سنوي.

2. الحساب
• أنت مسؤول عن صحة البيانات التي تسجّلها، وعن الحفاظ على سرية كلمة مرورك.
• الحساب شخصي، ولا يجوز مشاركته أو بيعه أو نقله لطرف آخر دون موافقتنا.
• يجب ألا يقل عمرك عن 18 عامًا، أو أن يكون لديك تفويض نظامي بالتعاقد.

3. الاشتراك والدفع
• الأسعار معروضة في صفحة الأسعار بالريال السعودي، وقد تشمل ضريبة القيمة المضافة حسب النظام.
• يتجدد الاشتراك تلقائيًا في نهاية كل فترة ما لم توقف التجديد من لوحتك.
• إيقاف التجديد يبقي اشتراكك فعّالًا حتى نهاية الفترة المدفوعة.
• الاسترداد: يحق لك طلب استرداد خلال 14 يومًا من أول اشتراك إذا لم تستخدم الخدمة استخدامًا جوهريًا. بعد ذلك لا تُسترد المبالغ عن فترة جارية، ما لم يقضِ النظام بغير ذلك.

4. المحتوى الذي تنشره
• تبقى ملكية أعمالك وصورك ونصوصك لك بالكامل.
• تمنحنا ترخيصًا محدودًا لعرض هذا المحتوى داخل المنصة لغرض تشغيل الخدمة فقط.
• أنت تقرّ بأنك تملك الحق في نشر ما ترفعه، وأنه لا ينتهك حقوق غيرك.

5. الاستخدام المقبول
يُمنع نشر محتوى مخالف لأنظمة المملكة العربية السعودية، أو أعمال منسوبة لغير صاحبها، أو محتوى مسيء أو مضلل، أو بيانات تواصل مزيفة، أو أي محاولة لاختراق المنصة أو إساءة استخدامها.

6. الإيقاف والإنهاء
• قد نوقف عرض صفحة مخالفة أو نوقف الحساب بعد مراجعة بلاغ، ونبلّغك بالسبب.
• يبقى محتواك محفوظًا أثناء الإيقاف، ويمكنك الاعتراض عبر الدعم الفني.
• يمكنك إنهاء اشتراكك في أي وقت من لوحتك.

7. حدود المسؤولية
نبذل جهدًا معقولًا لإبقاء الخدمة متاحة، لكننا لا نضمن استمراريتها دون انقطاع. مسؤوليتنا في جميع الأحوال لا تتجاوز ما دفعته خلال الاثني عشر شهرًا السابقة للمطالبة.

8. التعديلات
قد نحدّث هذه الشروط، ونخطرك بالتغييرات الجوهرية عبر البريد أو داخل لوحتك قبل سريانها.

9. النظام الواجب التطبيق
تخضع هذه الشروط لأنظمة المملكة العربية السعودية، وتختص جهات القضاء السعودية بالنظر في أي نزاع.

10. التواصل
لأي استفسار بخصوص هذه الشروط، تواصل معنا عبر الدعم الفني داخل لوحتك أو على بريد الدعم المعلن في المنصة.`,
  "policy.privacy": `مسودة — تحتاج مراجعة قانونية قبل الاعتماد.

1. البيانات التي نجمعها
• بيانات الحساب: الاسم، البريد الإلكتروني، وكلمة المرور مشفّرة (لا نطّلع عليها).
• بيانات الملف: ما تدخله بنفسك من اسم ووصف وصور وأعمال وروابط ورقم تواصل.
• بيانات الاستخدام: عدد مشاهدات صفحتك، وعدد النقرات على أزرار التواصل، وبصمة تقنية غير معرّفة لعدّ الزوار المختلفين يوميًا.
• بيانات الدفع: تُعالَج لدى مزوّد الدفع مباشرة. لا نخزّن أرقام البطاقات على خوادمنا.

2. لماذا نجمعها
لتشغيل حسابك وعرض صفحتك، ولحماية المنصة من الإساءة، ولإصدار الفواتير وإدارة الاشتراك، ولتحسين الخدمة.

3. مع من تُشارَك
• مزوّد الدفع، لتنفيذ عمليات الاشتراك.
• مزوّد البريد، لإرسال رسائل تشغيلية مثل استعادة كلمة المرور.
• مزوّد الاستضافة الذي تعمل عليه المنصة.
لا نبيع بياناتك، ولا نشاركها لأغراض تسويقية مع أي طرف ثالث.

4. ما يظهر للعامة
صفحتك العامة — ومحتواها الذي اخترت نشره — متاحة لأي شخص لديه الرابط، وقد تفهرسها محركات البحث. بريدك الإلكتروني وكلمة مرورك وبيانات اشتراكك لا تظهر أبدًا في الصفحة العامة.

5. مدة الحفظ
نحتفظ ببيانات حسابك ما دام الحساب قائمًا. عند الحذف تُمحى بياناتك وصورك ومعارضك، مع الاحتفاظ بالحد الأدنى من سجلات الفوترة والإشراف الذي تفرضه الأنظمة.

6. حقوقك
وفقًا لنظام حماية البيانات الشخصية في المملكة، لك الحق في الاطلاع على بياناتك، وتصحيحها، وطلب حذفها، وسحب موافقتك. تواصل معنا عبر الدعم لتنفيذ أي من ذلك.

7. ملفات الارتباط
نستخدم ملف ارتباط واحدًا أساسيًا لإبقائك مسجّلًا للدخول، وملفًا لتذكّر لغة الواجهة. لا نستخدم ملفات تتبّع إعلانية.

8. الأمان
كلمات المرور مخزّنة بتجزئة scrypt، والاتصال مشفّر، والوصول الإداري محصور بفريق المنصة ومسجّل في سجل تدقيق.

9. التواصل
لأي سؤال عن خصوصيتك أو لممارسة حقوقك، تواصل معنا عبر الدعم الفني أو بريد الدعم المعلن في المنصة.`,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = { [K in SettingKey]: (typeof SETTING_DEFAULTS)[K] };

type StoredRow = { key: string; value: string };


/**
 * A setting in the reader's language, falling back to the Arabic original.
 *
 * Falling back rather than showing an empty page is the point: the owner writes
 * Arabic first, and an English visitor should get the Arabic terms of service
 * rather than a blank one.
 */
export function localized<K extends SettingKey & string>(
  settings: Settings,
  key: K,
  locale: Locale,
): string {
  if (locale === "ar") return String(settings[key] ?? "");
  const english = String((settings as Record<string, unknown>)[`${key}_en`] ?? "").trim();
  return english || String(settings[key] ?? "");
}

/** Reads every setting, overlaying stored overrides on the defaults. */
async function uncachedReadSettings(): Promise<Settings>{
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

/**
 * Deduplicated per request.
 *
 * This is read from several independent places while one page renders — a layout,
 * a guard and the page itself all ask — and each ask was its own round trip. With
 * the database in Frankfurt and the functions in Ohio, every one of those cost
 * about a tenth of a second for an answer we already had.
 *
 * React's cache() scopes to a single request, so nothing goes stale: two renders
 * still read the database twice, one render reads it once.
 */
export const readSettings = cache(uncachedReadSettings);

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
