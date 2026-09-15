import type { Locale, TicketPriority, TicketStatus } from "./types";

/**
 * Label maps shared by server and client components. They live apart from
 * `support.ts` because that module reaches into the database and must stay off
 * the client bundle.
 *
 * Bilingual because a ticket is a conversation between a customer and staff who
 * may not share a language: the customer reads "Waiting on you" in English while
 * the agent reads "بانتظار العميل", and it is the same ticket in the same state.
 */
type Bilingual = Record<Locale, string>;

const pick = (map: Bilingual, locale: Locale) => map[locale] ?? map.ar;

export const TICKET_STATUS: Record<TicketStatus, Bilingual> = {
  open: { ar: "مفتوحة", en: "Open" },
  in_progress: { ar: "قيد المعالجة", en: "In progress" },
  waiting_customer: { ar: "بانتظار العميل", en: "Waiting on you" },
  resolved: { ar: "مغلقة", en: "Closed" },
};

export const TICKET_PRIORITY: Record<TicketPriority, Bilingual> = {
  low: { ar: "منخفضة", en: "Low" },
  normal: { ar: "عادية", en: "Normal" },
  high: { ar: "عالية", en: "High" },
  urgent: { ar: "عاجلة", en: "Urgent" },
};

export const TICKET_CATEGORY: Record<string, Bilingual> = {
  general: { ar: "استفسار عام", en: "General question" },
  billing: { ar: "الاشتراك والفوترة", en: "Subscription & billing" },
  technical: { ar: "مشكلة تقنية", en: "Technical problem" },
  content: { ar: "المحتوى والمعرض", en: "Content & portfolio" },
  account: { ar: "الحساب والدخول", en: "Account & sign-in" },
};

export const ticketStatusLabel = (status: TicketStatus, locale: Locale) =>
  pick(TICKET_STATUS[status] ?? TICKET_STATUS.open, locale);

export const ticketPriorityLabel = (priority: TicketPriority, locale: Locale) =>
  pick(TICKET_PRIORITY[priority] ?? TICKET_PRIORITY.normal, locale);

export const ticketCategoryLabel = (category: string, locale: Locale) =>
  TICKET_CATEGORY[category] ? pick(TICKET_CATEGORY[category], locale) : category;

export const ticketCategories = (locale: Locale) =>
  Object.entries(TICKET_CATEGORY).map(([value, label]) => ({ value, label: pick(label, locale) }));

/* Arabic-only views (the console, for now) keep the old flat maps. */
export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = Object.fromEntries(
  Object.entries(TICKET_STATUS).map(([key, value]) => [key, value.ar]),
) as Record<TicketStatus, string>;

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = Object.fromEntries(
  Object.entries(TICKET_PRIORITY).map(([key, value]) => [key, value.ar]),
) as Record<TicketPriority, string>;

export const TICKET_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(TICKET_CATEGORY).map(([key, value]) => [key, value.ar]),
);

export const TICKET_CATEGORIES = Object.entries(TICKET_CATEGORY_LABEL).map(([value, label]) => ({
  value,
  label,
}));
