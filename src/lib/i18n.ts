import type { Locale } from "./types";

export const LOCALES: Locale[] = ["ar", "en"];
export const DEFAULT_LOCALE: Locale = "ar";
export const DIR: Record<Locale, "rtl" | "ltr"> = { ar: "rtl", en: "ltr" };
export const LOCALE_LABEL: Record<Locale, string> = { ar: "العربية", en: "English" };

export function isLocale(value: unknown): value is Locale {
  return value === "ar" || value === "en";
}

const ar = {
  brandTagline: "منصة معارض الأعمال",

  nav: { login: "دخول", start: "ابدأ الآن", dashboard: "لوحة التحكم", pricing: "الأسعار" },

  landing: {
    badge: "منصة عربية لصفحات الأعمال",
    headline1: "معرض أعمالك الشخصي،",
    headline2: "برابط واحد أنيق",
    sub: "للمصممين والمستقلين وصنّاع المحتوى: صفحة واحدة تجمع هويتك، أعمالك، أرقامك وطرق التواصل معك — تحدّثها بنفسك في أي وقت.",
    ctaPrimary: "أنشئ معرضك الآن",
    ctaSecondary: "شاهد نموذجًا حيًا",
    featuresTitle: "كل ما تحتاجه في مكان واحد",
    showcaseTitle: "معارض منشورة على المنصة",
    showcaseSub: "كل صفحة برابط مستقل وهوية لونية خاصة بصاحبها.",
    finalTitle: "جاهز لتطلق صفحتك؟",
    finalSub: "أنشئ حسابك، ارفع صورك وأعمالك، ثم انشر — كل ذلك خلال دقائق.",
    finalCta: "ابدأ الآن",
  },

  features: [
    { title: "محرر بلا تعقيد", body: "غيّر اسمك، صورك، أعمالك وأرقامك من لوحة واضحة — بدون كود ولا مصمم." },
    { title: "صورك أنت", body: "ارفع صورك واقصصها كما تريد، ورتّبها بالترتيب الذي يعجبك. لا صور مولّدة ولا قوالب جاهزة." },
    { title: "معرض أعمال كامل", body: "شرائح مميزة، بطاقات مشاريع، إحصائيات، وروابط تواصل — كلها قابلة للترتيب." },
    { title: "عزل كامل بين الحسابات", body: "كل عميل يرى ويعدّل معرضه فقط، ولا يصل إلى بيانات غيره أبدًا." },
    { title: "معاينة قبل النشر", body: "جرّب صفحتك على شاشة جوال حقيقية، وانشرها حين تقتنع بالنتيجة." },
    { title: "عربي وإنجليزي", body: "واجهة تعمل من اليمين لليسار ومن اليسار لليمين بنفس الجودة." },
  ],

  pricing: {
    title: "اشتراك واحد، كل المزايا",
    sub: "ابنِ معرضك مجانًا بالكامل. الاشتراك يفتح النشر للعامة فقط.",
    monthly: "شهري",
    yearly: "سنوي",
    perMonth: "شهريًا",
    perYear: "سنويًا",
    recommended: "الأوفر",
    savePrefix: "وفّر",
    savePercent: (percent: string) => `(${percent}%)`,
    yearlyNote: (monthly: string, total: string) =>
      `بدل ${total} ريال لو دفعت ${monthly} ريال كل شهر على مدار السنة.`,
    monthlyNote: "ادفع شهرًا بشهر، وألغِ متى شئت.",
    cta: "ابدأ الآن",
    currentPlan: "باقتك الحالية",
    features: [
      "نشر معرضك على رابطك الخاص",
      "صفحتك مرئية للجميع ولمحركات البحث",
      "زر واتساب وروابط تواصل تعمل مع زوارك",
      "إحصائيات المشاهدات والنقرات",
      "تعديلات فورية تظهر مباشرة",
      "إلغاء في أي وقت — يبقى عملك كما هو",
    ],
    freeTitle: "بدون اشتراك",
    freeBody:
      "المحرّر مفتوح بالكامل ومجانًا: أعمال وشرائح وصور بلا حدود، ومعاينة كاملة لصفحتك. الاشتراك يفتح شيئًا واحدًا — نشرها للعامة.",
  },

  auth: {
    loginTitle: "أهلاً بعودتك",
    loginSub: "سجّل دخولك لإدارة معرض أعمالك.",
    signupTitle: "ابدأ معرضك خلال دقيقة",
    signupSub: "صفحة أعمال جاهزة برابط خاص بك، تعدّلها متى شئت.",
    name: "الاسم المعروض",
    title: "التخصص",
    slug: "رابط معرضك",
    slugHint: "اتركه فارغًا وسنولّده من اسمك تلقائيًا.",
    invite: "رمز الدعوة",
    inviteHint: "اختياري — يمنحك اشتراكًا مجانيًا فور التسجيل.",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    submitLogin: "تسجيل الدخول",
    submitSignup: "أنشئ معرضي",
    pending: "لحظة…",
    google: "المتابعة عبر جوجل",
    googleDisabled: "تسجيل الدخول عبر جوجل غير مُعد بعد",
    or: "أو",
    haveAccount: "لديك حساب بالفعل؟",
    noAccount: "ليس لديك حساب؟",
    toLogin: "تسجيل الدخول",
    toSignup: "أنشئ حسابًا",
  },

  portfolio: {
    about: "نبذة عني",
    works: "أعمالي",
    worksCount: (n: number) => `${n} عمل`,
    whatsapp: "تواصل معي عبر واتساب",
    share: "مشاركة الصفحة",
    copied: "تم نسخ الرابط",
    edit: "تعديل هذه الصفحة",
    poweredBy: "أُنشئت عبر ديزاينكم",
    soonBadge: "قريبًا",
    soonTitle: "هذا المعرض قيد التجهيز",
    soonBody: "صاحب الصفحة لم ينشرها بعد. عُد لاحقًا لمشاهدة الأعمال.",
    home: "العودة للرئيسية",
    rights: "جميع الحقوق محفوظة",
  },


  authErrors: {
    invalid_email: "البريد الإلكتروني غير صالح",
    weak_password: "كلمة المرور يجب أن تكون 8 أحرف على الأقل",
    short_name: "الاسم قصير جدًا",
    bad_slug: "الرابط غير صالح، استخدم حروفًا أو أرقامًا",
    email_taken: "هذا البريد مسجّل مسبقًا",
    bad_credentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
    suspended: "تم إيقاف هذا الحساب مؤقتًا، تواصل مع إدارة المنصة",
    google_unavailable: "تسجيل الدخول عبر جوجل غير مُعد على هذا الخادم",
    google_denied: "تم إلغاء تسجيل الدخول عبر جوجل",
    google_invalid: "طلب غير صالح من جوجل، حاول مرة أخرى",
    google_expired: "انتهت صلاحية الطلب، حاول مرة أخرى",
    google_failed: "تعذّر إكمال تسجيل الدخول عبر جوجل",
    google_unverified: "بريد حساب جوجل غير موثّق",
    too_many_attempts: "محاولات دخول كثيرة. انتظر قليلاً ثم أعد المحاولة.",
    too_many_signups: "تم إنشاء عدة حسابات من هذا الجهاز مؤخرًا. حاول بعد قليل.",
    signups_closed: "التسجيل مغلق حاليًا. تحتاج إلى دعوة لإنشاء حساب.",
    invite_required: "التسجيل بدعوة فقط. أدخل رمز الدعوة للمتابعة.",
    invite_not_found: "رمز الدعوة غير صحيح",
    invite_revoked: "تم إلغاء هذه الدعوة",
    invite_expired: "انتهت صلاحية هذه الدعوة",
    invite_used_up: "استُخدمت هذه الدعوة بالكامل",
    invite_wrong_email: "هذه الدعوة مخصصة لبريد إلكتروني آخر",
  },
  notFound: { title: "لم نجد هذه الصفحة", body: "ربما تغيّر الرابط أو تم حذف المعرض.", cta: "الصفحة الرئيسية" },

  cookies: {
    body: "نستخدم ملفَّي ارتباط أساسيين فقط: واحد لإبقائك مسجّلًا للدخول، وآخر لتذكّر لغة الواجهة. لا نستخدم ملفات تتبّع إعلانية ولا نشارك بياناتك مع معلنين.",
    policy: "سياسة الخصوصية",
    dismiss: "فهمت",
  },
};

const en: typeof ar = {
  brandTagline: "The portfolio platform",

  nav: { login: "Log in", start: "Get started", dashboard: "Dashboard", pricing: "Pricing" },

  landing: {
    badge: "A portfolio platform built for Arabic",
    headline1: "Your work, your page,",
    headline2: "one elegant link",
    sub: "For designers, freelancers and creators: a single page holding your identity, your work, your numbers and every way to reach you — edited by you, whenever you like.",
    ctaPrimary: "Create your portfolio",
    ctaSecondary: "See a live example",
    featuresTitle: "Everything in one place",
    showcaseTitle: "Published on Designakum",
    showcaseSub: "Every page gets its own link and its own accent colour.",
    finalTitle: "Ready to publish?",
    finalSub: "Create an account, upload your images and work, then publish — minutes, not weeks.",
    finalCta: "Get started",
  },

  features: [
    { title: "An editor without the learning curve", body: "Change your name, images, projects and numbers from one clear panel — no code, no designer." },
    { title: "Your own images", body: "Upload, crop and reorder your visuals exactly how you want them. Nothing generated, nothing borrowed." },
    { title: "A complete portfolio", body: "Hero slides, project cards, statistics and social links — all reorderable." },
    { title: "Accounts fully isolated", body: "Every client sees and edits only their own portfolio, never anyone else's data." },
    { title: "Preview before you publish", body: "Try your page on a real phone frame, and publish once you're happy with it." },
    { title: "Arabic and English", body: "Right-to-left and left-to-right, both treated as first class." },
  ],

  pricing: {
    title: "One subscription, everything included",
    sub: "Build your whole portfolio free. The subscription unlocks publishing.",
    monthly: "Monthly",
    yearly: "Yearly",
    perMonth: "per month",
    perYear: "per year",
    recommended: "Best value",
    savePrefix: "Save",
    savePercent: (percent: string) => `(${percent}%)`,
    yearlyNote: (monthly: string, total: string) =>
      `Instead of ${total} SAR, which is what ${monthly} SAR a month adds up to over a year.`,
    monthlyNote: "Pay month to month, cancel whenever you like.",
    cta: "Get started",
    currentPlan: "Your current plan",
    features: [
      "Publish your portfolio on your own link",
      "Visible to everyone, and to search engines",
      "WhatsApp button and social links that reach you",
      "View and click statistics",
      "Edits go live the moment you save",
      "Cancel any time — your work stays yours",
    ],
    freeTitle: "Without a subscription",
    freeBody:
      "The editor is free and uncapped: unlimited projects, slides and images, and a full preview of your page. The subscription unlocks one thing — making it public.",
  },

  auth: {
    loginTitle: "Welcome back",
    loginSub: "Log in to manage your portfolio.",
    signupTitle: "Your portfolio, in about a minute",
    signupSub: "A ready page on your own link, yours to edit any time.",
    name: "Display name",
    title: "What you do",
    slug: "Your portfolio link",
    slugHint: "Leave it empty and we'll build one from your name.",
    invite: "Invitation code",
    inviteHint: "Optional — unlocks a free subscription the moment you sign up.",
    email: "Email",
    password: "Password",
    submitLogin: "Log in",
    submitSignup: "Create my portfolio",
    pending: "One moment…",
    google: "Continue with Google",
    googleDisabled: "Google sign-in isn't configured yet",
    or: "or",
    haveAccount: "Already have an account?",
    noAccount: "No account yet?",
    toLogin: "Log in",
    toSignup: "Create one",
  },

  portfolio: {
    about: "About",
    works: "Selected work",
    worksCount: (n: number) => `${n} projects`,
    whatsapp: "Message me on WhatsApp",
    share: "Share this page",
    copied: "Link copied",
    edit: "Edit this page",
    poweredBy: "Made with Designakum",
    soonBadge: "Coming soon",
    soonTitle: "This portfolio is still being prepared",
    soonBody: "The owner hasn't published it yet. Check back a little later.",
    home: "Back to home",
    rights: "All rights reserved",
  },


  authErrors: {
    invalid_email: "That email address isn't valid",
    weak_password: "Passwords need at least 8 characters",
    short_name: "That name is too short",
    bad_slug: "That link isn't valid — use letters or numbers",
    email_taken: "That email is already registered",
    bad_credentials: "Wrong email or password",
    suspended: "This account is suspended — please contact the platform owner",
    google_unavailable: "Google sign-in isn't configured on this server",
    google_denied: "Google sign-in was cancelled",
    google_invalid: "Google sent an invalid request — please try again",
    google_expired: "That request expired — please try again",
    google_failed: "We couldn't finish signing you in with Google",
    google_unverified: "That Google account's email isn't verified",
    too_many_attempts: "Too many sign-in attempts. Wait a moment and try again.",
    too_many_signups: "Several accounts were created from this device recently. Please try again later.",
    signups_closed: "Sign-ups are closed right now — you'll need an invitation.",
    invite_required: "This platform is invite-only. Enter your invitation code to continue.",
    invite_not_found: "That invitation code isn't valid",
    invite_revoked: "That invitation was revoked",
    invite_expired: "That invitation has expired",
    invite_used_up: "That invitation has already been fully used",
    invite_wrong_email: "That invitation is for a different email address",
  },
  notFound: { title: "We couldn't find that page", body: "The link may have changed, or the portfolio was removed.", cta: "Go home" },

  cookies: {
    body: "We use two essential cookies only: one keeps you signed in, the other remembers your language. No advertising trackers, and nothing shared with advertisers.",
    policy: "Privacy policy",
    dismiss: "Got it",
  },
};

const DICT = { ar, en } as const;

export type Dictionary = typeof ar;

export function dict(locale: Locale): Dictionary {
  return DICT[locale] ?? DICT.ar;
}
