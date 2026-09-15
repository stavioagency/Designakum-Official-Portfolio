"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { currentUser, revokeSessionsFor } from "@/lib/auth";
import { getCustomer } from "@/lib/customers";
import { get, now, run } from "@/lib/db";
import { getPortfolioById } from "@/lib/portfolios";
import { PermissionError, requirePermission } from "@/lib/permissions";
import { callerFingerprint, rateLimit } from "@/lib/rate-limit";
import { readSettings } from "@/lib/settings";
import { isSafeUrl } from "@/lib/safe-url";
import {
  addReportNote,
  assignReport,
  createReport,
  getReport,
  hasRecentReport,
  restorePortfolio,
  setReportStatus,
  suspendPortfolio,
} from "@/lib/moderation";
import { REPORT_REASONS, type ReportStatus, type User } from "@/lib/types";
import type { ActionState } from "./console";
import { reportError } from "@/lib/observability";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function fail(error: unknown): ActionState {
  // A refused permission is an expected outcome, not an incident.
  if (error instanceof PermissionError) return { error: error.message };
  reportError(error, { area: "action" });
  return { error: error instanceof Error ? error.message : "تعذّر تنفيذ العملية" };
}

function refresh(reportId?: string) {
  revalidatePath("/console");
  revalidatePath("/console/moderation");
  if (reportId) revalidatePath(`/console/moderation/${reportId}`);
}

/* -------------------------------------------------------- public reporting */

/**
 * Filing a report is open to visitors, so it is rate limited by caller and
 * de-duplicated per reporter and portfolio — a complaint queue is only useful if
 * it cannot be flooded.
 */
export async function submitReportAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    if (!readSettings()["features.reports"]) {
      return { error: "استقبال البلاغات متوقف حاليًا" };
    }

    const fingerprint = await callerFingerprint();
    const limit = rateLimit(`report:${fingerprint}`, 5, 60 * 60 * 1000);
    if (!limit.ok) {
      return { error: `تجاوزت عدد البلاغات المسموح بها. حاول بعد ${Math.ceil(limit.retryAfterSeconds / 60)} دقيقة.` };
    }

    const portfolioId = str(fd, "portfolioId");
    const portfolio = getPortfolioById(portfolioId);
    if (!portfolio) return { error: "المعرض غير موجود" };

    const reason = str(fd, "reason");
    if (!REPORT_REASONS.some((r) => r.value === reason)) return { error: "اختر سبب البلاغ" };

    const description = str(fd, "description").slice(0, 2000);
    if (description.length < 10) return { error: "اكتب وصفًا واضحًا للمخالفة (10 أحرف على الأقل)" };

    const viewer = await currentUser();
    const email = (viewer?.email ?? str(fd, "email")).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { error: "أدخل بريدًا إلكترونيًا صحيحًا لنتمكن من الرد عليك" };
    }
    if (viewer && viewer.id === portfolio.user_id) {
      return { error: "لا يمكنك الإبلاغ عن معرضك الخاص" };
    }
    if (hasRecentReport(portfolioId, email)) {
      return { error: "لديك بلاغ مسجّل على هذا المعرض خلال آخر 24 ساعة" };
    }

    const evidenceUrl = str(fd, "evidenceUrl").slice(0, 500);
    if (evidenceUrl && !isSafeUrl(evidenceUrl)) {
      return { error: "رابط الدليل غير صالح — استخدم عنوانًا يبدأ بـ https://" };
    }

    createReport({
      portfolioId,
      reporterId: viewer?.id ?? null,
      reporterEmail: email,
      reason,
      description,
      evidenceUrl,
    });

    refresh();
    return { ok: "تم استلام بلاغك وسيراجعه فريق ديزاينكم." };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------ triage */

export async function assignReportAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("moderation.review");
    const reportId = str(fd, "reportId");
    const assigneeId = str(fd, "assigneeId") || null;

    const report = getReport(reportId);
    if (!report) return { error: "البلاغ غير موجود" };

    assignReport(reportId, assigneeId);
    audit({
      actor,
      action: "report.assigned",
      targetType: "report",
      targetId: reportId,
      targetLabel: report.portfolio_name,
      before: { assignee_id: report.assignee_id },
      after: { assignee_id: assigneeId },
    });

    refresh(reportId);
    return { ok: assigneeId ? "تم إسناد البلاغ" : "تم إلغاء الإسناد" };
  } catch (error) {
    return fail(error);
  }
}

export async function addReportNoteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("moderation.review");
    const reportId = str(fd, "reportId");
    const body = str(fd, "body");
    if (body.length < 2) return { error: "الملاحظة فارغة" };

    addReportNote(reportId, actor, body);
    audit({
      actor,
      action: "report.note_added",
      targetType: "report",
      targetId: reportId,
      detail: body.slice(0, 160),
    });

    refresh(reportId);
    return { ok: "تمت إضافة الملاحظة" };
  } catch (error) {
    return fail(error);
  }
}

export async function setReportStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("moderation.review");
    const reportId = str(fd, "reportId");
    const status = str(fd, "status") as ReportStatus;
    if (!["pending", "reviewing", "resolved", "dismissed"].includes(status)) {
      return { error: "حالة غير معروفة" };
    }

    const report = getReport(reportId);
    if (!report) return { error: "البلاغ غير موجود" };

    setReportStatus(reportId, status, str(fd, "resolution"));
    audit({
      actor,
      action: `report.${status}`,
      targetType: "report",
      targetId: reportId,
      targetLabel: report.portfolio_name,
      before: { status: report.status },
      after: { status },
      detail: str(fd, "resolution"),
    });

    refresh(reportId);
    return { ok: "تم تحديث حالة البلاغ" };
  } catch (error) {
    return fail(error);
  }
}

/* -------------------------------------------------------------- enforcement */

/** Warnings reach the customer as a support ticket, so there is a record both sides can see. */
export async function warnOwnerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("moderation.enforce");
    const reportId = str(fd, "reportId");
    const message = str(fd, "message");
    if (message.length < 10) return { error: "اكتب نص التحذير" };

    const report = getReport(reportId);
    if (!report) return { error: "البلاغ غير موجود" };

    const owner = getCustomer(report.owner_id);
    if (!owner) return { error: "صاحب المعرض غير موجود" };

    const { createTicket } = await import("@/lib/support");
    const ticket = createTicket({
      user: owner,
      subject: str(fd, "removal") === "1" ? "طلب تعديل محتوى مخالف" : "تنبيه بخصوص محتوى معرضك",
      category: "content",
      priority: "high",
      body: message,
    });
    run("UPDATE tickets SET status = 'waiting_customer', updated_at = ? WHERE id = ?", now(), ticket.id);

    audit({
      actor,
      action: str(fd, "removal") === "1" ? "moderation.removal_requested" : "moderation.warning_sent",
      targetType: "user",
      targetId: owner.id,
      targetLabel: owner.email,
      detail: message.slice(0, 200),
    });

    addReportNote(reportId, actor, `أُرسل تحذير للعميل (تذكرة ${ticket.id}).`);
    refresh(reportId);
    revalidatePath("/console/support");
    return { ok: "تم إرسال التحذير للعميل كتذكرة دعم" };
  } catch (error) {
    return fail(error);
  }
}

export async function suspendPortfolioAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("moderation.enforce");
    const portfolioId = str(fd, "portfolioId");
    const reason = str(fd, "reason");
    const days = Number(str(fd, "days")) || 0;

    if (reason.length < 5) return { error: "اكتب سبب الإيقاف" };

    const portfolio = getPortfolioById(portfolioId);
    if (!portfolio) return { error: "المعرض غير موجود" };

    const until = days > 0 ? now() + days * 86_400_000 : null;
    suspendPortfolio(portfolioId, reason, until);

    audit({
      actor,
      action: until ? "portfolio.suspended_temporary" : "portfolio.suspended",
      targetType: "portfolio",
      targetId: portfolioId,
      targetLabel: portfolio.slug,
      before: { suspended: portfolio.suspended },
      after: { suspended: 1, until },
      detail: reason,
    });

    refresh(str(fd, "reportId") || undefined);
    revalidatePath(`/p/${portfolio.slug}`);
    revalidatePath(`/console/customers/${portfolio.user_id}`);
    return { ok: until ? `تم إيقاف المعرض ${days} يومًا` : "تم إيقاف المعرض" };
  } catch (error) {
    return fail(error);
  }
}

export async function restorePortfolioAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("moderation.enforce");
    const portfolioId = str(fd, "portfolioId");

    const portfolio = getPortfolioById(portfolioId);
    if (!portfolio) return { error: "المعرض غير موجود" };

    restorePortfolio(portfolioId);
    audit({
      actor,
      action: "portfolio.restored",
      targetType: "portfolio",
      targetId: portfolioId,
      targetLabel: portfolio.slug,
      before: { suspended: 1, reason: portfolio.suspended_reason },
      after: { suspended: 0 },
    });

    refresh(str(fd, "reportId") || undefined);
    revalidatePath(`/p/${portfolio.slug}`);
    revalidatePath(`/console/customers/${portfolio.user_id}`);
    return { ok: "تمت إعادة نشر المعرض" };
  } catch (error) {
    return fail(error);
  }
}

export async function banAccountAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("moderation.enforce");
    const userId = str(fd, "userId");
    const reason = str(fd, "reason");
    if (reason.length < 5) return { error: "اكتب سبب الإيقاف الدائم" };

    const target: User | undefined = getCustomer(userId);
    if (!target) return { error: "الحساب غير موجود" };
    if (target.role !== "client") return { error: "لا يمكن إيقاف حساب موظف من هنا" };

    run("UPDATE users SET status = 'suspended', updated_at = ? WHERE id = ?", now(), userId);
    revokeSessionsFor(userId);

    const portfolio = get<{ id: string; slug: string }>(
      "SELECT id, slug FROM portfolios WHERE user_id = ?",
      userId,
    );
    if (portfolio) {
      suspendPortfolio(portfolio.id, reason, null);
      revalidatePath(`/p/${portfolio.slug}`);
    }

    audit({
      actor,
      action: "account.banned",
      targetType: "user",
      targetId: userId,
      targetLabel: target.email,
      before: { status: target.status },
      after: { status: "suspended", portfolio_suspended: Boolean(portfolio) },
      detail: reason,
    });

    refresh(str(fd, "reportId") || undefined);
    revalidatePath(`/console/customers/${userId}`);
    return { ok: "تم إيقاف الحساب والمعرض نهائيًا" };
  } catch (error) {
    return fail(error);
  }
}
