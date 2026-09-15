import type { TicketPriority, TicketStatus } from "./types";

/**
 * Label maps shared by server and client components. They live apart from
 * `support.ts` because that module reaches into the database and must stay off
 * the client bundle.
 */
export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "مفتوحة",
  in_progress: "قيد المعالجة",
  waiting_customer: "بانتظار العميل",
  resolved: "مغلقة",
};

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: "منخفضة",
  normal: "عادية",
  high: "عالية",
  urgent: "عاجلة",
};

export const TICKET_CATEGORY_LABEL: Record<string, string> = {
  general: "استفسار عام",
  billing: "الاشتراك والفوترة",
  technical: "مشكلة تقنية",
  content: "المحتوى والمعرض",
  account: "الحساب والدخول",
};

export const TICKET_CATEGORIES = Object.entries(TICKET_CATEGORY_LABEL).map(([value, label]) => ({
  value,
  label,
}));
