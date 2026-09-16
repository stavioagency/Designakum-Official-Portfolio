import "server-only";
import { DEFAULT_LOCALE } from "./i18n";
import { toText, type Block } from "./email-render";
import type { Locale } from "./types";

/**
 * Every transactional message, in both languages.
 *
 * Written in the recipient's own language — the one they chose at the gate and
 * which is stored on their account — not the language of whoever or whatever
 * triggered the send. A webhook firing at 3am has no browser and no cookie, so
 * `users.locale` is the only thing that can answer this.
 *
 * A template says what a message contains, never how it looks: it returns blocks,
 * and `email-render.ts` turns those into the plain-text and HTML bodies. Both
 * bodies go out on every send, so nothing here needs writing twice and the two
 * cannot fall out of step.
 */

export interface Composed {
  subject: string;
  /** Plain-text body. Derived from the blocks — never written by hand. */
  body: string;
  blocks: Block[];
  locale: Locale;
  /** The grey line a client previews beside the subject. */
  preheader?: string;
}

type Draft = { subject: string; preheader?: string; blocks: Block[] };
type Template<T> = Record<Locale, (input: T) => Draft>;

const pick = <T>(template: Template<T>, locale: Locale | null | undefined, input: T): Composed => {
  const resolved: Locale = template[locale as Locale] ? (locale as Locale) : DEFAULT_LOCALE;
  const draft = template[resolved](input);
  return {
    subject: draft.subject,
    preheader: draft.preheader,
    blocks: draft.blocks,
    body: toText(draft.blocks),
    locale: resolved,
  };
};

const hi = (greeting: string, name: string): Block => ({ type: "h", text: `${greeting} ${name}`.trim() });

/* ------------------------------------------------------------ password reset */

const passwordReset: Template<{ name: string; link: string }> = {
  ar: ({ name, link }) => ({
    subject: "إعادة تعيين كلمة المرور — ديزاينكم",
    preheader: "الرابط صالح لمدة ساعة واحدة.",
    blocks: [
      hi("مرحبًا", name),
      { type: "p", text: "وصلنا طلب لإعادة تعيين كلمة مرور حسابك في ديزاينكم." },
      { type: "cta", label: "تعيين كلمة مرور جديدة", url: link },
      {
        type: "note",
        text: "الرابط صالح لمدة ساعة واحدة. إن لم تطلب ذلك فتجاهل هذه الرسالة، ولن يتغيّر شيء في حسابك.",
      },
    ],
  }),
  en: ({ name, link }) => ({
    subject: "Reset your password — Designakum",
    preheader: "The link works for one hour.",
    blocks: [
      hi("Hi", name),
      { type: "p", text: "We received a request to reset the password on your Designakum account." },
      { type: "cta", label: "Set a new password", url: link },
      {
        type: "note",
        text: "The link works for one hour. If you didn't ask for this, ignore this message — nothing about your account changes.",
      },
    ],
  }),
};

/* ------------------------------------------------------ password changed */

/**
 * Sent after a password is changed, to the address it was changed on.
 *
 * Not a courtesy: this is the message that tells someone their account has been
 * taken over. It goes out on every change, including the ones the owner made
 * themselves, because a notice that only appears when something is wrong tells
 * an attacker exactly what to suppress.
 */
const passwordChanged: Template<{ name: string; resetUrl: string }> = {
  ar: ({ name, resetUrl }) => ({
    subject: "تم تغيير كلمة مرور حسابك",
    preheader: "إن لم تكن أنت، أعد التعيين فورًا.",
    blocks: [
      hi("مرحبًا", name),
      {
        type: "p",
        text: "تم تغيير كلمة مرور حسابك في ديزاينكم للتو، وأُنهيت جميع الجلسات الأخرى.",
      },
      { type: "p", text: "إن كنت أنت من غيّرها فلا حاجة لأي إجراء." },
      { type: "p", text: "إن لم تكن أنت، أعد تعيين كلمة المرور فورًا:" },
      { type: "cta", label: "إعادة تعيين كلمة المرور", url: resetUrl },
    ],
  }),
  en: ({ name, resetUrl }) => ({
    subject: "Your password was changed",
    preheader: "If this wasn't you, reset it now.",
    blocks: [
      hi("Hi", name),
      {
        type: "p",
        text: "The password on your Designakum account was just changed, and every other session was signed out.",
      },
      { type: "p", text: "If that was you, there is nothing to do." },
      { type: "p", text: "If it was not, reset your password immediately:" },
      { type: "cta", label: "Reset my password", url: resetUrl },
    ],
  }),
};

/* ------------------------------------------------------------- invitation */

const invitation: Template<{ code: string; signupUrl: string; months: number }> = {
  ar: ({ code, signupUrl, months }) => ({
    subject: "دعوة إلى ديزاينكم",
    preheader: `اشتراك مجاني لمدة ${months} شهر.`,
    blocks: [
      { type: "h", text: "وصلتك دعوة إلى ديزاينكم" },
      { type: "p", text: "أنشئ صفحتك، واجمع حساباتك وأعمالك وروابطك في رابط واحد تشاركه." },
      { type: "code", label: "رمز الدعوة", value: code },
      { type: "p", text: `يمنحك الرمز اشتراكًا مجانيًا لمدة ${months} شهر.` },
      { type: "cta", label: "أنشئ حسابك", url: signupUrl },
      { type: "note", text: "الرمز مُدرج في الرابط، فلا حاجة لكتابته بنفسك." },
    ],
  }),
  en: ({ code, signupUrl, months }) => ({
    subject: "You have been invited to Designakum",
    preheader: `${months} month${months === 1 ? "" : "s"} of subscription, free.`,
    blocks: [
      { type: "h", text: "You've been invited to Designakum" },
      {
        type: "p",
        text: "Create your page, and gather your accounts, your work and your links into one link you can share.",
      },
      { type: "code", label: "Invitation code", value: code },
      {
        type: "p",
        text: `It gives you ${months} month${months === 1 ? "" : "s"} of subscription, free.`,
      },
      { type: "cta", label: "Create my account", url: signupUrl },
      { type: "note", text: "The code is already in the link — you don't need to type it." },
    ],
  }),
};

/* -------------------------------------------------------------------- welcome */

const welcome: Template<{ name: string; portfolioUrl: string; dashboardUrl: string }> = {
  ar: ({ name, portfolioUrl, dashboardUrl }) => ({
    subject: "أهلاً بك في ديزاينكم",
    preheader: "حسابك جاهز وصفحتك محجوزة.",
    blocks: [
      hi("أهلاً", name),
      { type: "p", text: "حسابك جاهز، وصفحتك محجوزة على هذا الرابط:" },
      { type: "link", label: "رابط صفحتك", url: portfolioUrl },
      { type: "p", text: "ابدأ من لوحة التحكم — أضف أعمالك وصورك وطرق التواصل معك." },
      { type: "cta", label: "افتح لوحة التحكم", url: dashboardUrl },
      {
        type: "note",
        text: "الصفحة تبقى خاصة بك إلى أن تنشرها. النشر يحتاج اشتراكًا فعّالًا، وكل ما عدا ذلك مجاني.",
      },
    ],
  }),
  en: ({ name, portfolioUrl, dashboardUrl }) => ({
    subject: "Welcome to Designakum",
    preheader: "Your account is ready and your page is reserved.",
    blocks: [
      hi("Welcome,", name),
      { type: "p", text: "Your account is ready, and your page is reserved at:" },
      { type: "link", label: "Your page", url: portfolioUrl },
      {
        type: "p",
        text: "Start in your dashboard — add your work, your images and how people reach you.",
      },
      { type: "cta", label: "Open my dashboard", url: dashboardUrl },
      {
        type: "note",
        text: "The page stays private until you publish it. Publishing needs an active subscription; everything else is free.",
      },
    ],
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
    preheader: "يمكنك نشر صفحتك الآن.",
    blocks: [
      hi("مرحبًا", name),
      { type: "p", text: "تم تفعيل اشتراكك، ويمكنك نشر صفحتك الآن." },
      {
        type: "facts",
        rows: [
          ["الباقة", plan],
          ["المبلغ", charged],
          ["التجديد القادم", renewsOn],
        ],
      },
      { type: "cta", label: "انشر صفحتك", url: portfolioUrl },
      { type: "note", text: "إيصال الدفع يصلك من PayPal مباشرة." },
    ],
  }),
  en: ({ name, plan, charged, renewsOn, portfolioUrl }) => ({
    subject: "Your subscription is active — Designakum",
    preheader: "You can publish your page now.",
    blocks: [
      hi("Hi", name),
      { type: "p", text: "Your subscription is active, and you can publish your page now." },
      {
        type: "facts",
        rows: [
          ["Plan", plan],
          ["Charged", charged],
          ["Next renewal", renewsOn],
        ],
      },
      { type: "cta", label: "Publish my page", url: portfolioUrl },
      { type: "note", text: "PayPal sends the payment receipt separately." },
    ],
  }),
};

const paymentFailed: Template<{ name: string; billingUrl: string }> = {
  ar: ({ name, billingUrl }) => ({
    subject: "تعذّر تحصيل اشتراكك — ديزاينكم",
    preheader: "صفحتك ما زالت منشورة، لكن ليس لوقت طويل.",
    blocks: [
      hi("مرحبًا", name),
      { type: "p", text: "حاولنا تحصيل اشتراكك ولم تنجح العملية لدى مزوّد الدفع." },
      {
        type: "p",
        text: "صفحتك ما زالت منشورة حاليًا، لكنها ستتوقف عن الظهور إن لم يُحصّل الاشتراك.",
      },
      { type: "cta", label: "راجع طريقة الدفع", url: billingUrl },
      { type: "note", text: "محتواك وإعداداتك تبقى كما هي في كل الأحوال." },
    ],
  }),
  en: ({ name, billingUrl }) => ({
    subject: "We couldn't take your payment — Designakum",
    preheader: "Your page is still up, but not for long.",
    blocks: [
      hi("Hi", name),
      { type: "p", text: "We tried to charge your subscription and your payment provider declined it." },
      {
        type: "p",
        text: "Your page is still published for now, but it will come down if the payment isn't collected.",
      },
      { type: "cta", label: "Check my payment method", url: billingUrl },
      { type: "note", text: "Your content and settings stay exactly as they are either way." },
    ],
  }),
};

const subscriptionEnded: Template<{ name: string; billingUrl: string }> = {
  ar: ({ name, billingUrl }) => ({
    subject: "انتهى اشتراكك — ديزاينكم",
    preheader: "لم يُحذف أي شيء، والصفحة تعود فور التجديد.",
    blocks: [
      hi("مرحبًا", name),
      { type: "p", text: "انتهى اشتراكك، وصفحتك لم تعد ظاهرة للعامة." },
      {
        type: "p",
        text: "لم يُحذف أي شيء: أعمالك وصورك وإعداداتك محفوظة كما هي، وتعود الصفحة فور التجديد.",
      },
      { type: "cta", label: "جدّد اشتراكك", url: billingUrl },
    ],
  }),
  en: ({ name, billingUrl }) => ({
    subject: "Your subscription has ended — Designakum",
    preheader: "Nothing was deleted; the page comes back on renewal.",
    blocks: [
      hi("Hi", name),
      { type: "p", text: "Your subscription has ended and your page is no longer public." },
      {
        type: "p",
        text: "Nothing was deleted: your work, images and settings are exactly where you left them, and the page comes back the moment you resubscribe.",
      },
      { type: "cta", label: "Resubscribe", url: billingUrl },
    ],
  }),
};

export const emailTemplate = {
  passwordReset: (locale: Locale | null | undefined, input: { name: string; link: string }) =>
    pick(passwordReset, locale, input),
  passwordChanged: (
    locale: Locale | null | undefined,
    input: { name: string; resetUrl: string },
  ) => pick(passwordChanged, locale, input),
  invitation: (
    locale: Locale | null | undefined,
    input: { code: string; signupUrl: string; months: number },
  ) => pick(invitation, locale, input),
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
