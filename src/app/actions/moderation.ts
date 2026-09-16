"use server";

import { revalidatePath } from "next/cache";
import { messages } from "@/lib/locale";
import { dict, fill } from "@/lib/i18n";
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

async function fail(error: unknown): Promise<ActionState> {
  // A refused permission is an expected outcome, not an incident.
  if (error instanceof PermissionError) return { error: error.message };
  reportError(error, { area: "action" });
  return { error: error instanceof Error ? error.message : (await messages()).failed };
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
    // Keys, not sentences: a public visitor files this in whichever language
    // they chose, and the action cannot know which that is.
    if (!(await readSettings())["features.reports"]) {
      return { error: "closed" };
    }

    const fingerprint = await callerFingerprint();
    const limit = await rateLimit(`report:${fingerprint}`, 5, 60 * 60 * 1000);
    if (!limit.ok) {
      return { error: `rateLimited:${Math.ceil(limit.retryAfterSeconds / 60)}` };
    }

    const portfolioId = str(fd, "portfolioId");
    const portfolio = await getPortfolioById(portfolioId);
    if (!portfolio) return { error: "missingPortfolio" };

    const reason = str(fd, "reason");
    if (!REPORT_REASONS.some((r) => r.value === reason)) return { error: "badReason" };

    const description = str(fd, "description").slice(0, 2000);
    if (description.length < 10) return { error: "shortDescription" };

    const viewer = await currentUser();
    const email = (viewer?.email ?? str(fd, "email")).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { error: "badEmail" };
    }
    if (viewer && viewer.id === portfolio.user_id) {
      return { error: "ownPortfolio" };
    }
    if (await hasRecentReport(portfolioId, email)) {
      return { error: "duplicate" };
    }

    const evidenceUrl = str(fd, "evidenceUrl").slice(0, 500);
    if (evidenceUrl && !isSafeUrl(evidenceUrl)) {
      return { error: "badEvidence" };
    }

    await createReport({
      portfolioId,
      reporterId: viewer?.id ?? null,
      reporterEmail: email,
      reason,
      description,
      evidenceUrl,
    });

    refresh();
    return { ok: "sent" };
  } catch (error) {
    return await fail(error);
  }
}

/* ------------------------------------------------------------ triage */

export async function assignReportAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("moderation.review");
    const reportId = str(fd, "reportId");
    const assigneeId = str(fd, "assigneeId") || null;

    const report = await getReport(reportId);
    if (!report) return { error: (await messages()).reportMissing };

    await assignReport(reportId, assigneeId);
    await audit({
      actor,
      action: "report.assigned",
      targetType: "report",
      targetId: reportId,
      targetLabel: report.portfolio_name,
      before: { assignee_id: report.assignee_id },
      after: { assignee_id: assigneeId },
    });

    refresh(reportId);
    const m = await messages();
    return { ok: assigneeId ? m.reportAssigned : m.reportUnassigned };
  } catch (error) {
    return await fail(error);
  }
}

export async function addReportNoteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("moderation.review");
    const reportId = str(fd, "reportId");
    const body = str(fd, "body");
    if (body.length < 2) return { error: (await messages()).emptyNote };

    await addReportNote(reportId, actor, body);
    await audit({
      actor,
      action: "report.note_added",
      targetType: "report",
      targetId: reportId,
      detail: body.slice(0, 160),
    });

    refresh(reportId);
    return { ok: (await messages()).noteAdded };
  } catch (error) {
    return await fail(error);
  }
}

export async function setReportStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("moderation.review");
    const reportId = str(fd, "reportId");
    const status = str(fd, "status") as ReportStatus;
    if (!["pending", "reviewing", "resolved", "dismissed"].includes(status)) {
      return { error: (await messages()).unknownStatus };
    }

    const report = await getReport(reportId);
    if (!report) return { error: (await messages()).reportMissing };

    await setReportStatus(reportId, status, str(fd, "resolution"));
    await audit({
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
    return { ok: (await messages()).reportStatusUpdated };
  } catch (error) {
    return await fail(error);
  }
}

/* -------------------------------------------------------------- enforcement */

/** Warnings reach the customer as a support ticket, so there is a record both sides can see. */
export async function warnOwnerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("moderation.enforce");
    const reportId = str(fd, "reportId");
    const message = str(fd, "message");
    if (message.length < 10) return { error: (await messages()).writeWarning };

    const report = await getReport(reportId);
    if (!report) return { error: (await messages()).reportMissing };

    const owner = await getCustomer(report.owner_id);
    if (!owner) return { error: (await messages()).portfolioOwnerMissing };

    // The ticket is read by the customer, not by the staff member filing it, so
    // its subject is written in the customer's language.
    const warnCopy = dict(owner.locale === "en" ? "en" : "ar").messages;

    const { createTicket } = await import("@/lib/support");
    const ticket = await createTicket({
      user: owner,
      subject:
        str(fd, "removal") === "1" ? warnCopy.removalRequestSubject : warnCopy.warningSubject,
      category: "content",
      priority: "high",
      body: message,
    });
    await run("UPDATE tickets SET status = 'waiting_customer', updated_at = ? WHERE id = ?", now(), ticket.id);

    await audit({
      actor,
      action: str(fd, "removal") === "1" ? "moderation.removal_requested" : "moderation.warning_sent",
      targetType: "user",
      targetId: owner.id,
      targetLabel: owner.email,
      detail: message.slice(0, 200),
    });

    await addReportNote(reportId, actor, fill((await messages()).warningSentDetail, { id: ticket.id }));
    refresh(reportId);
    revalidatePath("/console/support");
    return { ok: (await messages()).warningSent };
  } catch (error) {
    return await fail(error);
  }
}

export async function suspendPortfolioAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("moderation.enforce");
    const portfolioId = str(fd, "portfolioId");
    const reason = str(fd, "reason");
    const days = Number(str(fd, "days")) || 0;

    if (reason.length < 5) return { error: (await messages()).writeSuspendReason };

    const portfolio = await getPortfolioById(portfolioId);
    if (!portfolio) return { error: (await messages()).portfolioMissing };

    const until = days > 0 ? now() + days * 86_400_000 : null;
    await suspendPortfolio(portfolioId, reason, until);

    await audit({
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
    const m = await messages();
    return {
      ok: until ? fill(m.portfolioSuspendedDays, { days }) : m.portfolioSuspended,
    };
  } catch (error) {
    return await fail(error);
  }
}

export async function restorePortfolioAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("moderation.enforce");
    const portfolioId = str(fd, "portfolioId");

    const portfolio = await getPortfolioById(portfolioId);
    if (!portfolio) return { error: (await messages()).portfolioMissing };

    await restorePortfolio(portfolioId);
    await audit({
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
    return { ok: (await messages()).portfolioRestored };
  } catch (error) {
    return await fail(error);
  }
}

export async function banAccountAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("moderation.enforce");
    const userId = str(fd, "userId");
    const reason = str(fd, "reason");
    if (reason.length < 5) return { error: (await messages()).writePermanentReason };

    const target: User | undefined = await getCustomer(userId);
    if (!target) return { error: (await messages()).accountMissing };
    if (target.role !== "client") return { error: (await messages()).cannotBanStaff };

    await run("UPDATE users SET status = 'suspended', updated_at = ? WHERE id = ?", now(), userId);
    await revokeSessionsFor(userId);

    const portfolio = await get<{ id: string; slug: string }>(
      "SELECT id, slug FROM portfolios WHERE user_id = ?",
      userId,
    );
    if (portfolio) {
      await suspendPortfolio(portfolio.id, reason, null);
      revalidatePath(`/p/${portfolio.slug}`);
    }

    await audit({
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
    return { ok: (await messages()).accountBanned };
  } catch (error) {
    return await fail(error);
  }
}
