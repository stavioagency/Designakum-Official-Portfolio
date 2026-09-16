/**
 * Renders every transactional email, in both languages, to a folder of HTML
 * files. A dev aid, not part of the app or the suite: the only way to know an
 * email looks right is to open it.
 *
 *   node scripts/preview-emails.mts [outdir]
 *
 * Two things stand between plain node and these modules: `server-only`, a
 * specifier that exists only inside Next's build, and TypeScript's extensionless
 * relative imports. Both are patched in the resolver below so the *real*
 * templates can be rendered. A second copy of the samples would have avoided
 * this, and would have rotted the first time a template changed.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      return next(`${specifier}.ts`, context);
    }
    return next(specifier, context);
  },
});

const { emailTemplate } = await import("../src/lib/emails.ts");
const { toHtml } = await import("../src/lib/email-render.ts");

const out = process.argv[2] ?? "/tmp/mail";
mkdirSync(out, { recursive: true });

const origin = "https://designakum.com";
const name = { ar: "فيصل", en: "Faisal" };

const cases = (locale: "ar" | "en") => ({
  "password-reset": emailTemplate.passwordReset(locale, {
    name: name[locale],
    link: `${origin}/reset/9f3c1a7b4e8d2c6a5f0b`,
  }),
  "password-changed": emailTemplate.passwordChanged(locale, {
    name: name[locale],
    resetUrl: `${origin}/forgot`,
  }),
  invitation: emailTemplate.invitation(locale, {
    code: "DK-7QH2XM",
    signupUrl: `${origin}/signup?invite=DK-7QH2XM`,
    months: 3,
  }),
  welcome: emailTemplate.welcome(locale, {
    name: name[locale],
    portfolioUrl: `${origin}/p/faisal`,
    dashboardUrl: `${origin}/dashboard`,
  }),
  "subscription-active": emailTemplate.subscriptionActivated(locale, {
    name: name[locale],
    plan: locale === "ar" ? "الباقة السنوية" : "Yearly",
    charged: locale === "ar" ? "٣٤٩ ر.س" : "SAR 349",
    renewsOn: locale === "ar" ? "١٦ سبتمبر ٢٠٢٧" : "16 September 2027",
    portfolioUrl: `${origin}/p/faisal`,
  }),
  "payment-failed": emailTemplate.paymentFailed(locale, {
    name: name[locale],
    billingUrl: `${origin}/dashboard/billing`,
  }),
  "subscription-ended": emailTemplate.subscriptionEnded(locale, {
    name: name[locale],
    billingUrl: `${origin}/dashboard/billing`,
  }),
});

const index: string[] = [];
for (const locale of ["ar", "en"] as const) {
  for (const [key, composed] of Object.entries(cases(locale))) {
    const file = `${key}.${locale}.html`;
    writeFileSync(
      `${out}/${file}`,
      toHtml(composed.blocks, {
        locale: composed.locale,
        origin,
        preheader: composed.preheader,
        supportEmail: "support@designakum.com",
      }),
    );
    writeFileSync(`${out}/${key}.${locale}.txt`, `${composed.subject}\n\n${composed.body}\n`);
    index.push(file);
  }
}

writeFileSync(
  `${out}/index.html`,
  `<!doctype html><meta charset="utf-8"><title>Designakum email previews</title>
<body style="margin:0;background:#07080e;font:14px system-ui;color:#b9b9cc">
${index
  .map(
    (file) =>
      `<div style="padding:10px 16px 0"><code style="color:#7cb0ff">${file}</code></div>
<iframe src="${file}" style="width:100%;height:760px;border:0;border-bottom:1px solid #1c2030"></iframe>`,
  )
  .join("\n")}
</body>`,
);

console.log(`${index.length} emails → ${out}/index.html`);
