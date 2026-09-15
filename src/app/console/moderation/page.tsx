import Link from "next/link";
import type { Metadata } from "next";
import { listReports, reportCounts, REPORT_STATUS_LABEL } from "@/lib/moderation";
import { guardPage } from "@/lib/permissions";
import {
  Badge,
  EmptyState,
  PageHeader,
  Pagination,
  SectionCard,
  Tabs,
  nf,
  timeAgo,
} from "@/components/console/ui";
import { SearchField } from "@/components/console/forms";
import { Flag } from "@/components/icons";
import { REPORT_REASONS, type ReportStatus } from "@/lib/types";

export const metadata: Metadata = { title: "البلاغات" };
export const dynamic = "force-dynamic";

const PER_PAGE = 20;
const REASON_LABEL = Object.fromEntries(REPORT_REASONS.map((r) => [r.value, r.label]));

const STATUS_TONE: Record<ReportStatus, "bad" | "warn" | "good" | "neutral"> = {
  pending: "bad",
  reviewing: "warn",
  resolved: "good",
  dismissed: "neutral",
};

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await guardPage("moderation.review");
  const params = await searchParams;

  const status = (one(params.status) ?? "pending") as ReportStatus | "all";
  const search = one(params.q) ?? "";
  const page = Math.max(1, Number(one(params.page)) || 1);

  const counts = await reportCounts();
  const { rows, total } = await listReports({
    status,
    search,
    limit: PER_PAGE,
    offset: (page - 1) * PER_PAGE,
  });

  const build = (next: { status?: string; page?: number }) => {
    const query = new URLSearchParams();
    const nextStatus = next.status ?? status;
    if (nextStatus !== "pending") query.set("status", nextStatus);
    if (search) query.set("q", search);
    if ((next.page ?? 1) > 1) query.set("page", String(next.page));
    const qs = query.toString();
    return qs ? `/console/moderation?${qs}` : "/console/moderation";
  };

  return (
    <>
      <PageHeader
        title="البلاغات"
        description="بلاغات العملاء والزوار عن معارض مخالفة لقواعد ديزاينكم."
      />

      <div className="mb-4 space-y-3">
        <Tabs
          current={status}
          build={(key) => build({ status: key })}
          tabs={[
            { key: "pending", label: REPORT_STATUS_LABEL.pending, count: counts.pending },
            { key: "reviewing", label: REPORT_STATUS_LABEL.reviewing, count: counts.reviewing },
            { key: "resolved", label: REPORT_STATUS_LABEL.resolved, count: counts.resolved },
            { key: "dismissed", label: REPORT_STATUS_LABEL.dismissed, count: counts.dismissed },
            { key: "all", label: "الكل", count: counts.all },
          ]}
        />
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <SearchField placeholder="ابحث باسم المعرض أو بريد المُبلِّغ…" />
        </div>
      </div>

      <SectionCard>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Flag className="h-5 w-5" />}
            title={
              status === "pending" ? "لا بلاغات بانتظار المراجعة" : "لا بلاغات في هذه القائمة"
            }
            body={
              status === "pending"
                ? "كل شيء هادئ. ستظهر البلاغات الجديدة هنا فور وصولها."
                : undefined
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-white/6">
              {rows.map((report) => (
                <li key={report.id}>
                  <Link
                    href={`/console/moderation/${report.id}`}
                    className="flex flex-wrap items-center gap-3 px-4 py-3.5 transition hover:bg-white/[0.03] sm:px-5"
                  >
                    <Badge tone={STATUS_TONE[report.status]}>
                      {REPORT_STATUS_LABEL[report.status]}
                    </Badge>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-semibold">
                          {report.portfolio_name}
                        </span>
                        <span dir="ltr" className="shrink-0 text-[11px] text-mist-600">
                          /p/{report.portfolio_slug}
                        </span>
                        {report.portfolio_suspended === 1 && <Badge tone="bad">موقوف</Badge>}
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-mist-400">
                        {REASON_LABEL[report.reason] ?? report.reason} — {report.description}
                      </span>
                    </span>

                    <span className="flex shrink-0 items-center gap-2">
                      {report.assignee_email ? (
                        <Badge tone="accent">{report.assignee_email.split("@")[0]}</Badge>
                      ) : (
                        <Badge>غير مُسند</Badge>
                      )}
                      {report.note_count > 0 && (
                        <span className="tnum text-[11px] text-mist-600">
                          {nf.format(report.note_count)} ملاحظة
                        </span>
                      )}
                      <span className="text-[11px] text-mist-600">{timeAgo(report.created_at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination
              total={total}
              page={page}
              perPage={PER_PAGE}
              build={(next) => build({ page: next })}
            />
          </>
        )}
      </SectionCard>
    </>
  );
}
