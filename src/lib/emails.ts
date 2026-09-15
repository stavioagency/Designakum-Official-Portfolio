import "server-only";
import { DEFAULT_LOCALE } from "./i18n";
import type { Locale } from "./types";

/**
 * Every transactional message, in both languages.
 *
 * Written in the recipient's own language — the one they chose at the gate and
 * which is stored on their account — not the language of whoever or whatever
 * triggered the send. A webhook firing at 3am has no browser and no cookie, so
 * `users.locale` is the only thing that can answer this.
 *
 * Plain text on purpose: it renders everywhere, cannot leak a tracking pixel,
 * and is not worth the deliverability risk of HTML for five messages.
 */

export interface Composed {
  subject: string;
  body: string;
}

const lines = (...parts: (string | false | null | undefined)[]) =>
  parts.filter((part) => part !== false && part != null).join("\n");

type Template<T> = Record<Locale, (input: T) => Composed>;

const pick = <T>(template: Template<T>, locale: Locale | null | undefined, input: T): Composed =>
  (template[locale as Locale] ?? template[DEFAULT_LOCALE])(input);

/* ------------------------------------------------------------ password reset */

const passwordReset: Template<{ name: string; link: string }> = {
  ar: ({ name, link }) => ({
    subject: "إعادة تعيين كلمة المرور — ديزاينكم",
    body: lines(
      `مرحبًا ${name}`.trim(),
      "",
      "وصلنا طلب لإعادة تعيين كلمة مرور حسابك في ديزاينكم.",
      "افتح الرابط التالي خلال ساعة واحدة لتعيين كلمة مرور جديدة:",
      link,
      "",
      "إن لم تطلب ذلك فتجاهل هذه الرسالة، ولن يتغيّر شيء في حسابك.",
    ),
  }),
  en: ({ name, link }) => ({
    subject: "Reset your password — Designakum",
    body: lines(
      `Hi ${name}`.trim(),
      "",
      "We received a request to reset the password on your Designakum account.",
      "Open this link within one hour to set a new password:",
      link,
      "",
      "If you didn't ask for this, ignore this message — nothing about your account changes.",
    ),
  }),
};

/* -------------------------------------------------------------------- welcome */

const welcome: Template<{ name: string; portfolioUrl: string; dashboardUrl: string }> = {
  ar: ({ name, portfolioUrl, dashboardUrl }) => ({
    subject: "أهلاً بك في ديزاينكم",
    body: lines(
      `أهلاً ${name}`.trim(),
      "",
      "حسابك جاهز. صفحتك محجوزة على هذا الرابط:",
      portfolioUrl,
      "",
      "ابدأ من لوحة التحكم — أضف أعمالك وصورك وطرق التواصل معك:",
      dashboardUrl,
      "",
      "الصفحة تبقى خاصة بك إلى أن تنشرها. النشر يحتاج اشتراكًا فعّالًا، وكل ما عدا ذلك مجاني.",
    ),
  }),
  en: ({ name, portfolioUrl, dashboardUrl }) => ({
    subject: "Welcome to Designakum",
    body: lines(
      `Welcome, ${name}`.trim(),
      "",
      "Your account is ready. Your page is reserved at:",
      portfolioUrl,
      "",
      "Start in your dashboard — add your work, your images and how people reach you:",
      dashboardUrl,
      "",
      "The page stays private until you publish it. Publishing needs an active subscription; everything else is free.",
    ),
  }),
};

/* -------------------------------------------------------------- subscriptions */

const subscriptionActivated: Template<{
  name: string;
  plan: string;
  charged: string;
  renewsOn: string;
  portfolioUrl: string;
}> = {
  ar: ({ name, plan, charged, renewsOn, portfolioUrl }) => ({
    subject: "تم تفعيل اشتراكك — ديزاينكم",
    body: lines(
      `مرحبًا ${name}`.trim(),
      "",
      `تم تفعيل اشتراكك (${plan}) بمبلغ ${charged}.`,
      `التجديد القادم: ${renewsOn}.`,
      "",
      "يمكنك الآن نشر صفحتك:",
      portfolioUrl,
      "",
      "إيصال الدفع يصلك من PayPal مباشرة.",
    ),
  }),
  en: ({ name, plan, charged, renewsOn, portfolioUrl }) => ({
    subject: "Your subscription is active — Designakum",
    body: lines(
      `Hi ${name}`.trim(),
      "",
      `Your ${plan} subscription is active, charged ${charged}.`,
      `Next renewal: ${renewsOn}.`,
      "",
      "You can publish your page now:",
      portfolioUrl,
      "",
      "PayPal sends the payment receipt separately.",
    ),
  }),
};

const paymentFailed: Template<{ name: string; billingUrl: string }> = {
  ar: ({ name, billingUrl }) => ({
    subject: "تعذّر تحصيل اشتراكك — ديزاينكم",
    body: lines(
      `مرحبًا ${name}`.trim(),
      "",
      "حاولنا تحصيل اشتراكك ولم تنجح العملية لدى مزوّد الدفع.",
      "صفحتك ما زالت منشورة حاليًا، لكنها ستتوقف عن الظهور إن لم يُحصّل الاشتراك.",
      "",
      "راجع طريقة الدفع من هنا:",
      billingUrl,
      "",
      "محتواك وإعداداتك تبقى كما هي في كل الأحوال.",
    ),
  }),
  en: ({ name, billingUrl }) => ({
    subject: "We couldn't take your payment — Designakum",
    body: lines(
      `Hi ${name}`.trim(),
      "",
      "We tried to charge your subscription and your payment provider declined it.",
      "Your page is still published for now, but it will come down if the payment isn't collected.",
      "",
      "Check your payment method here:",
      billingUrl,
      "",
      "Your content and settings stay exactly as they are either way.",
    ),
  }),
};

const subscriptionEnded: Template<{ name: string; billingUrl: string }> = {
  ar: ({ name, billingUrl }) => ({
    subject: "انتهى اشتراكك — ديزاينكم",
    body: lines(
      `مرحبًا ${name}`.trim(),
      "",
      "انتهى اشتراكك، وصفحتك لم تعد ظاهرة للعامة.",
      "لم يُحذف أي شيء: أعمالك وصورك وإعداداتك محفوظة كما هي، وتعود الصفحة فور التجديد.",
      "",
      "للتجديد:",
      billingUrl,
    ),
  }),
  en: ({ name, billingUrl }) => ({
    subject: "Your subscription has ended — Designakum",
    body: lines(
      `Hi ${name}`.trim(),
      "",
      "Your subscription has ended and your page is no longer public.",
      "Nothing was deleted: your work, images and settings are exactly where you left them, and the page comes back the moment you resubscribe.",
      "",
      "To resubscribe:",
      billingUrl,
    ),
  }),
};

export const emailTemplate = {
  passwordReset: (locale: Locale | null | undefined, input: { name: string; link: string }) =>
    pick(passwordReset, locale, input),
  welcome: (
    locale: Locale | null | undefined,
    input: { name: string; portfolioUrl: string; dashboardUrl: string },
  ) => pick(welcome, locale, input),
  subscriptionActivated: (
    locale: Locale | null | undefined,
    input: {
      name: string;
      plan: string;
      charged: string;
      renewsOn: string;
      portfolioUrl: string;
    },
  ) => pick(subscriptionActivated, locale, input),
  paymentFailed: (
    locale: Locale | null | undefined,
    input: { name: string; billingUrl: string },
  ) => pick(paymentFailed, locale, input),
  subscriptionEnded: (
    locale: Locale | null | undefined,
    input: { name: string; billingUrl: string },
  ) => pick(subscriptionEnded, locale, input),
};
