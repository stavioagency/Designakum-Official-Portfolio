import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getReport, reportNotes, REPORT_STATUS_LABEL } from "@/lib/moderation";
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

export const metadata: Metadata = { title: "بلاغ" };
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

  return (
    <>
      <Link
        href="/console/moderation"
        className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-mist-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        قائمة البلاغات
      </Link>

      <PageHeader
        title={`بلاغ عن ${report.portfolio_name}`}
        description={REASON_LABEL[report.reason] ?? report.reason}
        actions={
          <>
            <Badge tone={STATUS_TONE[report.status]}>{REPORT_STATUS_LABEL[report.status]}</Badge>
            <Link href={`/p/${report.portfolio_slug}`} target="_blank" className="btn btn-ghost !py-2.5">
              <ExternalLink className="h-4 w-4" />
              فتح المعرض
            </Link>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,340px)] xl:items-start">
        <div className="min-w-0 space-y-4">
          <SectionCard title="تفاصيل البلاغ">
            <div className="space-y-4 p-5">
              <dl className="grid gap-3 sm:grid-cols-2">
                <KeyValue label="المُبلِّغ">
                  <span dir="ltr">{report.reporter_email}</span>
                </KeyValue>
                <KeyValue label="نوع المُبلِّغ">
                  {report.reporter_id ? "عميل مسجّل" : "زائر"}
                </KeyValue>
                <KeyValue label="تاريخ البلاغ">{formatDate(report.created_at, true)}</KeyValue>
                <KeyValue label="المسؤول">
                  {report.assignee_email ?? "غير مُسند"}
                </KeyValue>
              </dl>

              <div className="panel p-4">
                <p className="mb-1.5 text-[11.5px] text-mist-500">وصف المخالفة</p>
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
                    فتح المرفق الذي أرسله المُبلِّغ
                  </a>
                ) : (
                  <p className="panel px-3.5 py-2.5 text-[12px] text-mist-500">
                    أرفق المُبلِّغ رابطًا غير صالح، وهو معروض كنص فقط:{" "}
                    <code dir="ltr" className="break-all text-mist-400">
                      {report.evidence_url}
                    </code>
                  </p>
                ))}

              {report.resolution && (
                <div className="panel border border-emerald-400/20 p-4">
                  <p className="mb-1.5 text-[11.5px] text-emerald-300">الخلاصة</p>
                  <p className="text-[13px] leading-relaxed text-mist-200">{report.resolution}</p>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="الملاحظات الداخلية" description="مرئية لفريق ديزاينكم فقط">
            <div className="space-y-4 p-5">
              {notes.length === 0 ? (
                <EmptyState title="لا ملاحظات بعد" body="سجّل ما توصّلت إليه ليبقى القرار مفهومًا لاحقًا." />
              ) : (
                <ul className="space-y-3">
                  {notes.map((note) => (
                    <li key={note.id} className="panel p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-semibold">{note.author_name}</span>
                        <span className="text-[11px] text-mist-600">{timeAgo(note.created_at)}</span>
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-mist-300">
                        {note.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <ReportNoteForm reportId={report.id} />
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="الإسناد">
            <div className="p-5">
              <AssignReport reportId={report.id} assigneeId={report.assignee_id} staff={members} />
            </div>
          </SectionCard>

          <SectionCard title="القرار">
            <div className="p-5">
              <ReportDecision reportId={report.id} status={report.status} />
            </div>
          </SectionCard>

          {can(staff, "moderation.enforce") ? (
            <>
              <SectionCard title="تنبيه العميل">
                <div className="p-5">
                  <WarnOwnerForm reportId={report.id} />
                </div>
              </SectionCard>

              {portfolio && (
                <SectionCard title="إيقاف المعرض">
                  <div className="p-5">
                    <PortfolioSuspensionControl
                      portfolioId={portfolio.id}
                      slug={portfolio.slug}
                      suspended={portfolio.suspended === 1}
                      reason={portfolio.suspended_reason}
                    />
                  </div>
                </SectionCard>
              )}

              <SectionCard title="إيقاف الحساب" className="border-rose-500/20">
                <div className="p-5">
                  <BanAccountForm
                    userId={report.owner_id}
                    email={report.owner_email}
                    reportId={report.id}
                  />
                  <Link
                    href={`/console/customers/${report.owner_id}`}
                    className="mt-3 block text-[12px] text-mist-500 underline decoration-white/20 underline-offset-4 hover:text-white"
                  >
                    فتح ملف العميل الكامل
                  </Link>
                </div>
              </SectionCard>
            </>
          ) : (
            <SectionCard title="إجراءات التنفيذ">
              <p className="p-5 text-[12.5px] leading-relaxed text-mist-500">
                التحذير وإيقاف المعارض والحسابات متاح لمالك المنصة. يمكنك مراجعة البلاغ وتدوين
                الملاحظات وتحويله للمالك.
              </p>
            </SectionCard>
          )}
        </div>
      </div>
    </>
  );
}
