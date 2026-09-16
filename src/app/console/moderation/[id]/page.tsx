import Link from "next/link";
import { currentLocale } from "@/lib/locale";
import { dict, fill } from "@/lib/i18n";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getReport, reportNotes, reportStatusLabel } from "@/lib/moderation";
import { getPortfolioById } from "@/lib/portfolios";
import { staffMembers } from "@/lib/customers";
import { can, guardPage } from "@/lib/permissions";
import {
  Badge,
  EmptyState,
  KeyValue,
  PageHeader,
  SectionCard,
  formatDate,
  formatDateTime,
  timeAgo,
} from "@/components/console/ui";
import {
  AssignReport,
  BanAccountForm,
  ReportDecision,
  ReportNoteForm,
  WarnOwnerForm,
} from "@/components/console/moderation-actions";
import { PortfolioSuspensionControl } from "@/components/console/customer-actions";
import { ArrowLeft, ExternalLink } from "@/components/icons";
import { REPORT_REASONS, type ReportStatus } from "@/lib/types";
import { safeUrl } from "@/lib/safe-url";

export async function generateMetadata(): Promise<Metadata> {
  return { title: dict(await currentLocale()).console.report.metaTitle };
}
export const dynamic = "force-dynamic";

const REASON_LABEL = Object.fromEntries(REPORT_REASONS.map((r) => [r.value, r.label]));

const STATUS_TONE: Record<ReportStatus, "bad" | "warn" | "good" | "neutral"> = {
  pending: "bad",
  reviewing: "warn",
  resolved: "good",
  dismissed: "neutral",
};

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await guardPage("moderation.review");
  const { id } = await params;

  const report = await getReport(id);
  if (!report) notFound();

  const notes = await reportNotes(id);
  const portfolio = await getPortfolioById(report.portfolio_id);
  const members = (await staffMembers()).map((member) => ({
    id: member.id,
    label: member.display_name || member.email,
  }));
  const locale = await currentLocale();
  const t = dict(locale).console.report;
  const customerCopy = dict(locale).console.customer;
  const dialogChrome = {
    cancel: dict(locale).console.common.cancel,
    pending: dict(locale).console.common.saving,
    confirmParts: [dict(locale).console.common.confirmBefore, dict(locale).console.common.confirmAfter] as [string, string],
  };


  return (
    <>
      <Link
        href="/console/moderation"
        className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-mist-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.backToList}
      </Link>

      <PageHeader
        title={fill(t.title, { name: report.portfolio_name })}
        description={REASON_LABEL[report.reason] ?? report.reason}
        actions={
          <>
            <Badge tone={STATUS_TONE[report.status]}>{reportStatusLabel(report.status, locale)}</Badge>
            <Link href={`/p/${report.portfolio_slug}`} target="_blank" className="btn btn-ghost !py-2.5">
              <ExternalLink className="h-4 w-4" />
              {t.openPortfolio}
            </Link>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,340px)] xl:items-start">
        <div className="min-w-0 space-y-4">
          <SectionCard title={t.details}>
            <div className="space-y-4 p-5">
              <dl className="grid gap-3 sm:grid-cols-2">
                <KeyValue label={t.reporter}>
                  <span dir="ltr">{report.reporter_email}</span>
                </KeyValue>
                <KeyValue label={t.reporterKind}>
                  {report.reporter_id ? t.reporterClient : t.reporterVisitor}
                </KeyValue>
                <KeyValue label={t.filedOn}>{formatDateTime(report.created_at, locale)}</KeyValue>
                <KeyValue label={t.assignee}>
                  {report.assignee_email ?? t.unassigned}
                </KeyValue>
              </dl>

              <div className="panel p-4">
                <p className="mb-1.5 text-[11.5px] text-mist-500">{t.description}</p>
                <p className="whitespace-pre-wrap text-[13.5px] leading-[1.9] text-mist-200">
                  {report.description}
                </p>
              </div>

              {report.evidence_url &&
                (safeUrl(report.evidence_url) ? (
                  <a
                    href={safeUrl(report.evidence_url)!}
                    target="_blank"
                    rel="noreferrer noopener nofollow ugc"
                    className="btn btn-ghost !px-3.5 !py-2 !text-[13px]"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t.openEvidence}
                  </a>
                ) : (
                  <p className="panel px-3.5 py-2.5 text-[12px] text-mist-500">
                    {t.badEvidence}{" "}
                    <code dir="ltr" className="break-all text-mist-400">
                      {report.evidence_url}
                    </code>
                  </p>
                ))}

              {report.resolution && (
                <div className="panel border border-emerald-400/20 p-4">
                  <p className="mb-1.5 text-[11.5px] text-emerald-300">{t.resolution}</p>
                  <p className="text-[13px] leading-relaxed text-mist-200">{report.resolution}</p>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title={t.notes} description={t.notesHint}>
            <div className="space-y-4 p-5">
              {notes.length === 0 ? (
                <EmptyState title={t.noNotes} body={t.noNotesBody} />
              ) : (
                <ul className="space-y-3">
                  {notes.map((note) => (
                    <li key={note.id} className="panel p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-semibold">{note.author_name}</span>
                        <span className="text-[11px] text-mist-600">{timeAgo(note.created_at, locale)}</span>
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-mist-300">
                        {note.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <ReportNoteForm copy={t} reportId={report.id} />
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title={t.assignment}>
            <div className="p-5">
              <AssignReport copy={t} reportId={report.id} assigneeId={report.assignee_id} staff={members} />
            </div>
          </SectionCard>

          <SectionCard title={t.decision}>
            <div className="p-5">
              <ReportDecision copy={t} reportId={report.id} status={report.status} />
            </div>
          </SectionCard>

          {can(staff, "moderation.enforce") ? (
            <>
              <SectionCard title={t.warnCustomer}>
                <div className="p-5">
                  <WarnOwnerForm copy={t} reportId={report.id} />
                </div>
              </SectionCard>

              {portfolio && (
                <SectionCard title={t.suspendPortfolio}>
                  <div className="p-5">
                    <PortfolioSuspensionControl
                      copy={customerCopy}
                      dialog={dialogChrome}
                      pending={dict(locale).console.common.saving}
                      portfolioId={portfolio.id}
                      slug={portfolio.slug}
                      suspended={portfolio.suspended === 1}
                      reason={portfolio.suspended_reason}
                    />
                  </div>
                </SectionCard>
              )}

              <SectionCard title={t.suspendAccount} className="border-rose-500/20">
                <div className="p-5">
                  <BanAccountForm copy={t} dialog={dialogChrome}
                    userId={report.owner_id}
                    email={report.owner_email}
                    reportId={report.id}
                  />
                  <Link
                    href={`/console/customers/${report.owner_id}`}
                    className="mt-3 block text-[12px] text-mist-500 underline decoration-white/20 underline-offset-4 hover:text-white"
                  >
                    {t.openCustomer}
                  </Link>
                </div>
              </SectionCard>
            </>
          ) : (
            <SectionCard title={t.enforcement}>
              <p className="p-5 text-[12.5px] leading-relaxed text-mist-500">
                {t.enforcementDenied}
              </p>
            </SectionCard>
          )}
        </div>
      </div>
    </>
  );
}
