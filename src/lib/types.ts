import type { ButtonKind } from "./buttons";

export type { ButtonKind };

export type Role = "owner" | "support" | "client";
export type UserStatus = "active" | "suspended";
export type Locale = "ar" | "en";

/** Subscription tiers. `free` means "no paid subscription", not a product. */
export type Plan = "free" | "monthly" | "yearly";
export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "expired"
  | "incomplete"
  /**
   * Replaced by a newer subscription for the same account, rather than ended.
   * Deliberately not "canceled" or "expired": nobody cancelled it and it did not
   * run out, and counting it as either would put a phantom loss into churn.
   */
  | "superseded";

export interface User {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: Role;
  status: UserStatus;
  plan: Plan;
  google_id: string | null;
  avatar_url: string;
  auth_provider: "password" | "google";
  locale: Locale;
  two_factor_secret: string;
  two_factor_enabled: number;
  last_seen_at: number | null;
  /** NULL until the customer has chosen their own portfolio link. */
  onboarded_at: number | null;
  /** NULL until they have been shown around the studio, or skipped the tour. */
  toured_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: Exclude<Plan, "free">;
  status: SubscriptionStatus;
  provider: string;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  amount: number;
  source: SubscriptionSource;
  started_at: number | null;
  canceled_at: number | null;
  current_period_end: number | null;
  cancel_at_period_end: number;
  created_at: number;
  updated_at: number;
}

export type SubscriptionSource = "paid" | "manual" | "invitation";

export interface Portfolio {
  id: string;
  user_id: string;
  slug: string;
  custom_domain: string | null;
  name: string;
  title: string;
  tagline: string;
  bio: string;
  avatar_url: string;
  monogram: string;
  whatsapp: string;
  whatsapp_label: string;
  theme: ThemeKey;
  /** A custom accent colour. Empty means the theme decides. */
  accent_hex: string;
  background_hex: string;
  works_label: string;
  hide_branding: number;
  seo_title: string;
  seo_description: string;
  og_image_url: string;
  favicon_url: string;
  locale: Locale;
  footer_note: string;
  published: number;
  suspended: number;
  suspended_reason: string;
  suspended_at: number | null;
  suspended_until: number | null;
  views: number;
  created_at: number;
  updated_at: number;
}

export interface Slide {
  id: string;
  portfolio_id: string;
  image_url: string;
  headline: string;
  subline: string;
  caption: string;
  position: number;
}

export interface Project {
  id: string;
  portfolio_id: string;
  title: string;
  category: string;
  description: string;
  image_url: string;
  link: string;
  position: number;
}

export interface Stat {
  id: string;
  portfolio_id: string;
  label: string;
  value: string;
  icon: string;
  position: number;
}

/**
 * A call to action: message, call, write, book. `kind` decides how `value`
 * becomes a link, and an empty `label` means the page writes the wording in its
 * own language rather than leaving a button with nothing on it.
 */
export interface PortfolioButton {
  id: string;
  portfolio_id: string;
  kind: ButtonKind;
  value: string;
  label: string;
  position: number;
}

export interface Social {
  id: string;
  portfolio_id: string;
  platform: SocialPlatform;
  url: string;
  position: number;
}

export type SocialPlatform =
  | "instagram"
  | "x"
  | "telegram"
  | "behance"
  | "dribbble"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "snapchat"
  | "website"
  | "email";

export interface PortfolioBundle {
  portfolio: Portfolio;
  slides: Slide[];
  projects: Project[];
  stats: Stat[];
  socials: Social[];
  buttons: PortfolioButton[];
  /** A project's own images, keyed by project id, in display order. */
  projectImages: Record<string, ProjectImageRow[]>;
}

export interface ProjectImageRow {
  id: string;
  project_id: string;
  url: string;
  /** Zero when the size could not be read; the page falls back to a plain box. */
  width: number;
  height: number;
  position: number;
}

export type ThemeKey =
  | "brand"
  | "violet"
  | "ocean"
  | "ember"
  | "emerald"
  | "rose"
  | "gold";

export const THEMES: Record<
  ThemeKey,
  { name: string; nameEn: string; from: string; to: string; ring: string }
> = {
  brand:   { name: "أزرق ديزاينكم", nameEn: "Designakum blue", from: "#2563c9", to: "#1b4d9b", ring: "#6aa3ff" },
  violet:  { name: "بنفسجي",  nameEn: "Violet",  from: "#8b7cf6", to: "#6d5ae0", ring: "#a595ff" },
  ocean:   { name: "سماوي",   nameEn: "Ocean",   from: "#22d3ee", to: "#0891b2", ring: "#67e8f9" },
  ember:   { name: "برتقالي", nameEn: "Ember",   from: "#fb923c", to: "#ea580c", ring: "#ffb27a" },
  emerald: { name: "أخضر",    nameEn: "Emerald", from: "#34d399", to: "#059669", ring: "#6ee7b7" },
  rose:    { name: "وردي",    nameEn: "Rose",    from: "#fb7185", to: "#e11d48", ring: "#fda4af" },
  gold:    { name: "ذهبي",    nameEn: "Gold",    from: "#fbbf24", to: "#d97706", ring: "#fcd34d" },
};

export const DEFAULT_THEME: ThemeKey = "brand";


/* ------------------------------------------------------------------ console */

export type ReportStatus = "pending" | "reviewing" | "resolved" | "dismissed";

export interface Report {
  id: string;
  portfolio_id: string;
  reporter_id: string | null;
  reporter_email: string;
  reason: string;
  description: string;
  evidence_url: string;
  status: ReportStatus;
  assignee_id: string | null;
  resolution: string;
  resolved_at: number | null;
  created_at: number;
  updated_at: number;
}

export const REPORT_REASONS: { value: string; label: string; labelEn: string }[] = [
  { value: "stolen_work", label: "أعمال منسوبة لغير صاحبها", labelEn: "Work credited to the wrong person" },
  { value: "offensive", label: "محتوى مسيء أو غير لائق", labelEn: "Offensive or inappropriate content" },
  { value: "misleading", label: "معلومات مضللة أو بيانات تواصل مزيفة", labelEn: "Misleading claims or fake contact details" },
  { value: "spam", label: "محتوى دعائي أو مكرر", labelEn: "Spam or duplicated content" },
  { value: "illegal", label: "مخالفة للأنظمة", labelEn: "Breaks the law" },
  { value: "other", label: "سبب آخر", labelEn: "Something else" },
];

export type TicketStatus = "open" | "in_progress" | "waiting_customer" | "resolved";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignee_id: string | null;
  last_reply_at: number;
  created_at: number;
  updated_at: number;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  author_id: string | null;
  author_name: string;
  author_side: "customer" | "staff";
  body: string;
  internal: number;
  created_at: number;
}

export interface Invitation {
  id: string;
  code: string;
  plan: Exclude<Plan, "free">;
  months: number;
  email: string;
  max_uses: number;
  used_count: number;
  expires_at: number | null;
  note: string;
  revoked: number;
  created_by: string | null;
  created_at: number;
}

export type AnnouncementSeverity = "info" | "success" | "warning" | "critical";

export interface Announcement {
  archived_at: number | null;
  id: string;
  title: string;
  body: string;
  /** Optional English pair; empty means "show the original". */
  title_en: string;
  body_en: string;
  severity: AnnouncementSeverity;
  active: number;
  starts_at: number | null;
  ends_at: number | null;
  created_by: string | null;
  created_at: number;
  updated_at: number;
}
