/**
 * Seeds a demo platform: one owner account, two client portfolios with content.
 * Safe to re-run — it clears and rebuilds only the demo rows it owns.
 */
import pg from "pg";
import { randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * This script DELETES the demo accounts by email before recreating them. Run
 * against a live database it would destroy real customers, so it refuses unless
 * the environment is clearly a development one.
 */
if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "yes-destroy-my-data") {
  console.error(
    "\nRefusing to seed: NODE_ENV=production.\n" +
      "This script deletes accounts. If you genuinely want demo data in production,\n" +
      "set ALLOW_PRODUCTION_SEED=yes-destroy-my-data and take a backup first.\n",
  );
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("\nDATABASE_URL is not set. Point it at your Postgres database first.\n");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes("supabase") ? { rejectUnauthorized: false } : undefined,
});

/** The app writes `?` placeholders; Postgres wants $1, $2, … */
const positional = (sql) => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};

const run = async (sql, ...args) => {
  await pool.query(positional(sql), args);
};
const one = async (sql, ...args) => (await pool.query(positional(sql), args)).rows[0];

// Demo data belongs in development. A remote database is assumed to be real.
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(connectionString) ||
  connectionString.includes("host=/") || connectionString.startsWith("postgresql:///");
if (!isLocal && process.env.ALLOW_PRODUCTION_SEED !== "yes-destroy-my-data") {
  console.error(
    "\nRefusing to seed a non-local database. This creates fake designers and\n" +
      "portfolios that would show up on your public showcase.\n" +
      "For a real deployment use: npm run bootstrap\n",
  );
  await pool.end();
  process.exit(1);
}

// This script DELETES the demo accounts before recreating them, so it refuses to
// touch a database that holds anyone real.
if (process.env.ALLOW_PRODUCTION_SEED !== "yes-destroy-my-data") {
  const real = await one(
    "SELECT COUNT(*)::int AS n FROM users WHERE email NOT LIKE '%@designakum.sa' AND role = 'client'",
  );
  if (real && real.n > 0) {
    console.error(
      `\nRefusing to seed: this database already holds ${real.n} real customer account(s).\n` +
        "Point DATABASE_URL at a scratch database, or set ALLOW_PRODUCTION_SEED=yes-destroy-my-data.\n",
    );
    await pool.end();
    process.exit(1);
  }
}

const now = () => Date.now();
const id = (p) => `${p}_${randomBytes(9).toString("hex")}`;
const hash = (pw) => {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(pw, salt, 64).toString("hex")}`;
};

/* ------------------------------------------------------------ demo artwork */

const svg = (body) => `data:image/svg+xml;utf8,${encodeURIComponent(body)}`;

function poster({ from, to, title, sub }) {
  return svg(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>
<pattern id="p" width="70" height="70" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
<path d="M12 12h26M12 12v26" stroke="#ffffff" stroke-opacity="0.13" stroke-width="5" stroke-linecap="round" fill="none"/>
<circle cx="52" cy="50" r="4" fill="#ffffff" fill-opacity="0.12"/>
</pattern>
</defs>
<rect width="1200" height="750" fill="url(#g)"/>
<rect width="1200" height="750" fill="url(#p)"/>
<text x="600" y="330" text-anchor="middle" font-family="Tajawal, sans-serif" font-size="128" font-weight="800" fill="#ffffff">${title}</text>
<text x="600" y="430" text-anchor="middle" font-family="Tajawal, sans-serif" font-size="46" fill="#ffffff" fill-opacity="0.9">${sub}</text>
</svg>`);
}

function tile({ from, to, glyph }) {
  return svg(`<svg xmlns="http://www.w3.org/2000/svg" width="700" height="700" viewBox="0 0 700 700">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
<rect width="700" height="700" fill="#101019"/>
<circle cx="350" cy="300" r="210" fill="url(#g)" opacity="0.9"/>
<circle cx="350" cy="300" r="210" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-width="3"/>
<text x="350" y="360" text-anchor="middle" font-family="Tajawal, sans-serif" font-size="160" font-weight="800" fill="#ffffff">${glyph}</text>
</svg>`);
}

/* ------------------------------------------------------------------- reset */

for (const email of [
  "admin@designakum.sa",
  "owner2@designakum.sa",
  "support@designakum.sa",
  "faisal@designakum.sa",
  "noura@designakum.sa",
]) {
  const row = await one("SELECT id FROM users WHERE email = ?", email);
  if (row) await run("DELETE FROM users WHERE id = ?", row.id);
}

// Rows whose creator is only SET NULL on delete outlive the users above, so a
// re-run would collide on the fixed invitation code. Clear them explicitly.
for (const statement of [
  "DELETE FROM invitations WHERE code = 'DZKM1-WELCM'",
  "DELETE FROM announcements WHERE title = 'أصبح بإمكانك قصّ صورك داخل المحرر'",
]) {
  await run(statement);
}

/* ------------------------------------------------------------------ owner */

const ownerId = id("usr");
await run(
  `INSERT INTO users (id, email, password_hash, display_name, role, status, plan, created_at, updated_at)
   VALUES (?, 'admin@designakum.sa', ?, 'مالك المنصة', 'owner', 'active', 'yearly', ?, ?)`,
  ownerId, hash("Admin#2026"), now(), now(),
);

const ownerTwoId = id("usr");
await run(
  `INSERT INTO users (id, email, password_hash, display_name, role, status, plan, created_at, updated_at)
   VALUES (?, 'owner2@designakum.sa', ?, 'الشريك المؤسس', 'owner', 'active', 'yearly', ?, ?)`,
  ownerTwoId, hash("Owner2#2026"), now(), now(),
);

const supportId = id("usr");
await run(
  `INSERT INTO users (id, email, password_hash, display_name, role, status, plan, created_at, updated_at)
   VALUES (?, 'support@designakum.sa', ?, 'موظف الدعم', 'support', 'active', 'free', ?, ?)`,
  supportId, hash("Support#2026x"), now(), now(),
);

/* ---------------------------------------------------------------- clients */

async function createClient(c) {
  const userId = id("usr");
  await run(
    `INSERT INTO users (id, email, password_hash, display_name, role, status, plan, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'client', 'active', ?, ?, ?)`,
    userId, c.email, hash(c.password), c.name, c.plan, now(), now(),
  );

  const pfId = id("pf");
  await run(
    `INSERT INTO portfolios (id, user_id, slug, name, title, tagline, bio, avatar_url, monogram,
       whatsapp, whatsapp_label, theme, locale, footer_note, published, views, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?, 'تواصل معي عبر واتساب', ?, 'ar', ?, 1, ?, ?, ?)`,
    pfId, userId, c.slug, c.name, c.title, c.tagline, c.bio, c.monogram,
    c.whatsapp, c.theme, c.footer, c.views, now(), now(),
  );

  for (const [i, s] of c.slides.entries())
    await run(
      "INSERT INTO slides (id, portfolio_id, image_url, headline, subline, caption, position) VALUES (?, ?, ?, ?, ?, '', ?)",
      id("sld"), pfId, s.image, s.headline, s.subline, i,
    );
  for (const [i, p] of c.projects.entries())
    await run(
      "INSERT INTO projects (id, portfolio_id, title, category, description, image_url, link, position) VALUES (?, ?, ?, ?, ?, ?, '', ?)",
      id("prj"), pfId, p.title, p.category, p.description, p.image, i,
    );
  for (const [i, s] of c.stats.entries())
    await run(
      "INSERT INTO stats (id, portfolio_id, label, value, icon, position) VALUES (?, ?, ?, ?, ?, ?)",
      id("stt"), pfId, s.label, s.value, s.icon, i,
    );
  for (const [i, s] of c.socials.entries())
    await run(
      "INSERT INTO socials (id, portfolio_id, platform, url, position) VALUES (?, ?, ?, ?, ?)",
      id("soc"), pfId, s.platform, s.url, i,
    );

  if (c.subscription) {
    const end = new Date();
    end.setMonth(end.getMonth() + (c.subscription === "yearly" ? 12 : 1));
    // A real paid subscription, so the console's revenue figures have something honest to add up.
    await run(
      `INSERT INTO subscriptions (id, user_id, plan, status, provider, amount, source,
         started_at, current_period_end, cancel_at_period_end, created_at, updated_at)
       VALUES (?, ?, ?, 'active', 'manual', ?, 'paid', ?, ?, 0, ?, ?)`,
      id("sub"), userId, c.subscription,
      c.subscription === "yearly" ? 12000 : 1200,
      now(), end.getTime(), now(), now(),
    );
  }

  const today = new Date();
  for (let d = 13; d >= 0; d--) {
    const day = new Date(today.getTime() - d * 86400000).toISOString().slice(0, 10);
    await run(
      "INSERT INTO page_views (id, portfolio_id, day, count) VALUES (?, ?, ?, ?)",
      id("pv"), pfId, day, Math.floor(Math.random() * 40) + 6,
    );
  }
  return { userId, pfId };
}

await createClient({
  email: "faisal@designakum.sa",
  password: "Faisal#2026",
  name: "فيصل فهد",
  slug: "faisal",
  title: "مصمم جرافيك | F9 Designer",
  tagline: "خلّك دائمًا مميز مع تصميم يناسبك",
  bio: "مصمم جرافيك سعودي، أشتغل على الهويات البصرية وتصاميم السوشال ميديا والمطبوعات. أهتم بالتفاصيل الصغيرة قبل الكبيرة، وأحب أن يخرج العمل نظيفًا يوصل رسالتك من أول نظرة.",
  monogram: "F",
  whatsapp: "966500000000",
  theme: "brand",
  footer: "جميع الحقوق محفوظة لـ فيصل ديزاينر",
  views: 1284,
  plan: "yearly",
  subscription: "yearly",
  slides: [
    { image: poster({ from: "#2563c9", to: "#1b4d9b", title: "أهلاً وسهلاً بكم", sub: "خلّك دائمًا مميز مع تصميم يناسبك" }), headline: "", subline: "" },
    { image: poster({ from: "#3b82f6", to: "#17417f", title: "هويات بصرية", sub: "من الفكرة إلى دليل الاستخدام" }), headline: "", subline: "" },
    { image: poster({ from: "#6aa3ff", to: "#2563c9", title: "سوشال ميديا", sub: "محتوى بصري يرفع تفاعل حسابك" }), headline: "", subline: "" },
  ],
  projects: [
    { title: "هوية مقهى نُزل", category: "هوية بصرية", description: "شعار ونظام ألوان وتطبيقات كاملة.", image: tile({ from: "#2563c9", to: "#1b4d9b", glyph: "نُزل" }) },
    { title: "حملة رمضان", category: "سوشال ميديا", description: "سلسلة تصاميم لحملة موسمية.", image: tile({ from: "#3b82f6", to: "#123566", glyph: "رمضان" }) },
    { title: "غلاف كتاب", category: "مطبوعات", description: "غلاف وتنسيق داخلي لكتاب أدبي.", image: tile({ from: "#1b4d9b", to: "#0d2450", glyph: "كتاب" }) },
    { title: "شعار متجر لمّة", category: "شعارات", description: "شعار عربي بخط مخصص.", image: tile({ from: "#7cb0ff", to: "#2563c9", glyph: "لمّة" }) },
    { title: "بروفايل شركة", category: "مطبوعات", description: "ملف تعريفي من 24 صفحة.", image: tile({ from: "#3b82f6", to: "#17417f", glyph: "بروفايل" }) },
    { title: "واجهة تطبيق", category: "واجهات", description: "تصميم شاشات تطبيق توصيل.", image: tile({ from: "#6aa3ff", to: "#1b4d9b", glyph: "تطبيق" }) },
  ],
  stats: [
    { label: "التقييم", value: "4.9", icon: "star" },
    { label: "الأعمال", value: "+300", icon: "briefcase" },
    { label: "متفرغ", value: "لا", icon: "clock" },
  ],
  socials: [
    { platform: "instagram", url: "https://instagram.com/f9designer" },
    { platform: "x", url: "https://x.com/f9designer" },
    { platform: "telegram", url: "https://t.me/f9designer" },
    { platform: "behance", url: "https://behance.net/f9designer" },
  ],
});

await createClient({
  email: "noura@designakum.sa",
  password: "Noura#2026",
  name: "نورة العتيبي",
  slug: "noura",
  title: "مصممة هوية بصرية",
  tagline: "تفاصيل صغيرة تصنع فرقًا كبيرًا",
  bio: "أصمّم هويات بصرية للمشاريع الناشئة، وأحب المشاريع التي تبدأ من سؤال بسيط: ما الذي يجعل هذه العلامة مختلفة؟",
  monogram: "ن",
  whatsapp: "966510000000",
  theme: "rose",
  footer: "جميع الحقوق محفوظة لـ نورة العتيبي",
  views: 742,
  plan: "free",
  subscription: null,
  slides: [
    { image: poster({ from: "#fb7185", to: "#e11d48", title: "هوية تُحكى", sub: "تصميم يبدأ من قصة علامتك" }), headline: "", subline: "" },
    { image: poster({ from: "#f472b6", to: "#be123c", title: "مشاريع ناشئة", sub: "انطلاقة بصرية واثقة" }), headline: "", subline: "" },
  ],
  projects: [
    { title: "هوية عيادة صفا", category: "هوية بصرية", description: "هوية هادئة لعيادة أسنان.", image: tile({ from: "#fb7185", to: "#e11d48", glyph: "صفا" }) },
    { title: "علامة عطور", category: "تغليف", description: "تصميم عبوة وهوية متجر.", image: tile({ from: "#f9a8d4", to: "#be185d", glyph: "عطر" }) },
    { title: "منتجع سُحب", category: "هوية بصرية", description: "هوية سياحية بخط عربي حديث.", image: tile({ from: "#fda4af", to: "#9f1239", glyph: "سُحب" }) },
  ],
  stats: [
    { label: "التقييم", value: "5.0", icon: "star" },
    { label: "الأعمال", value: "+90", icon: "briefcase" },
    { label: "العملاء", value: "+35", icon: "users" },
  ],
  socials: [
    { platform: "instagram", url: "https://instagram.com/noura.design" },
    { platform: "behance", url: "https://behance.net/noura" },
    { platform: "linkedin", url: "https://linkedin.com/in/noura" },
  ],
});

/* ------------------------------------------------- sample console workload */

const faisal = await one("SELECT id FROM users WHERE email = 'faisal@designakum.sa'");
const noura = await one("SELECT id FROM users WHERE email = 'noura@designakum.sa'");
const nouraPortfolio = await one("SELECT id FROM portfolios WHERE user_id = ?", noura.id);

// An open support ticket with one customer message.
const ticketId = id("tkt");
await run(
  `INSERT INTO tickets (id, user_id, subject, category, priority, status, last_reply_at, created_at, updated_at)
   VALUES (?, ?, 'لا تظهر صورة الغلاف على الجوال', 'technical', 'high', 'open', ?, ?, ?)`,
  ticketId, faisal.id, now(), now(), now(),
);
await run(
  `INSERT INTO ticket_messages (id, ticket_id, author_id, author_name, author_side, body, internal, created_at)
   VALUES (?, ?, ?, 'فيصل فهد', 'customer', ?, 0, ?)`,
  id("msg"), ticketId, faisal.id,
  "رفعت صورة جديدة للشريحة الأولى وتظهر على الكمبيوتر لكنها لا تظهر على جوالي. جربت متصفحين.",
  now(),
);

// A pending report waiting in the moderation queue.
await run(
  `INSERT INTO reports (id, portfolio_id, reporter_id, reporter_email, reason, description,
     evidence_url, status, created_at, updated_at)
   VALUES (?, ?, NULL, 'visitor@example.com', 'stolen_work', ?, '', 'pending', ?, ?)`,
  id("rep"), nouraPortfolio.id,
  "أحد الأعمال المعروضة في هذا المعرض يعود لمصمم آخر، وقد نُشر أصلاً على بيهانس قبل عام.",
  now(), now(),
);

// A live announcement for client dashboards.
await run(
  `INSERT INTO announcements (id, title, body, severity, active, starts_at, ends_at, created_by, created_at, updated_at)
   VALUES (?, 'أصبح بإمكانك قصّ صورك داخل المحرر', ?, 'success', 1, NULL, NULL, ?, ?, ?)`,
  id("ann"),
  "حدّثنا رفع الصور: اسحب الصورة لتحديد الإطار واستخدم الشريط للتكبير قبل الحفظ.",
  ownerId, now(), now(),
);

// One unused invitation the owner can hand out.
await run(
  `INSERT INTO invitations (id, code, plan, months, email, max_uses, used_count, expires_at, note, revoked, created_by, created_at)
   VALUES (?, 'DZKM1-WELCM', 'yearly', 1, '', 5, 0, NULL, 'دعوات الإطلاق', 0, ?, ?)`,
  id("inv"), ownerId, now(),
);

await pool.end();

console.log(`
تم تجهيز البيانات التجريبية:
(أعد تشغيل خادم التطوير بعد إعادة التهيئة ليقرأ الملف الجديد)

  مالك المنصة   admin@designakum.sa    Admin#2026       →  /console
  مالك ثانٍ     owner2@designakum.sa   Owner2#2026      →  /console
  موظف دعم      support@designakum.sa  Support#2026x    →  /console
  عميل          faisal@designakum.sa   Faisal#2026      →  /p/faisal
  عميلة         noura@designakum.sa    Noura#2026       →  /p/noura

  رمز دعوة تجريبي: DZKM1-WELCM
`);
