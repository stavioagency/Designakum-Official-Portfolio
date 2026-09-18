import Link from "next/link";
import { currentLocale } from "@/lib/locale";
import { dict, fill } from "@/lib/i18n";
import type { Metadata } from "next";
import { listReports, reportCounts, reportStatusLabel } from "@/lib/moderation";
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

export async function generateMetadata(): Promise<Metadata> {
  return { title: dict(await currentLocale()).console.reports.title };
}
export const dynamic = "force-dynamic";

const PER_PAGE = 20;
const reasonLabel = (value: string, locale: string) => {
  const reason = REPORT_REASONS.find((r) => r.value === value);
  if (!reason) return value;
  return locale === "en" ? reason.labelEn : reason.label;
};

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
  const locale = await currentLocale();
  const c = dict(locale).console;
  const t = c.reports;
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
        title={t.title}
        description={t.description}
      />

      <div className="mb-4 space-y-3">
        <Tabs
          current={status}
          build={(key) => build({ status: key })}
          tabs={[
            { key: "pending", label: reportStatusLabel("pending", locale), count: counts.pending },
            { key: "reviewing", label: reportStatusLabel("reviewing", locale), count: counts.reviewing },
            { key: "resolved", label: reportStatusLabel("resolved", locale), count: counts.resolved },
            { key: "dismissed", label: reportStatusLabel("dismissed", locale), count: counts.dismissed },
            { key: "all", label: c.common.all, count: counts.all },
          ]}
        />
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <SearchField placeholder={t.searchPlaceholder} clearLabel={c.common.clearSearch} />
        </div>
      </div>

      <SectionCard>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Flag className="h-5 w-5" />}
            title={
              status === "pending" ? t.emptyPending : t.empty
            }
            body={
              status === "pending"
                ? t.emptyBody
                : undefined
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-white/6">
              {rows.map((report) => (
                <li key={report.id}>
                  {/* Same squeeze as the tickets beside it: on a phone the
                      portfolio name and the reason were clipped to a couple of
                      characters so a badge, an assignee and a timestamp could
                      share their line. They get the line now. */}
                  <Link
                    href={`/console/moderation/${report.id}`}
                    className="flex flex-col gap-2 px-4 py-3.5 transition hover:bg-white/[0.03] sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-5"
                  >
                    <span className="flex min-w-0 items-start gap-3 sm:contents">
                      <Badge tone={STATUS_TONE[report.status]}>
                        {reportStatusLabel(report.status, locale)}
                      </Badge>

                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2">
                          <span className="truncate text-[14px] font-semibold">
                            {report.portfolio_name}
                          </span>
                          <span dir="ltr" className="shrink-0 text-[11px] text-mist-600">
                            /p/{report.portfolio_slug}
                          </span>
                          {report.portfolio_suspended === 1 && <Badge tone="bad">{t.suspended}</Badge>}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-mist-400">
                          <span className="font-medium">
                            {reasonLabel(report.reason, locale) ?? report.reason}
                          </span>
                          {report.description ? (
                            <span className="line-clamp-2 text-mist-500">{report.description}</span>
                          ) : null}
                        </span>
                      </span>
                    </span>

                    <span className="flex shrink-0 flex-wrap items-center gap-2">
                      {report.assignee_email ? (
                        <Badge tone="accent">{report.assignee_email.split("@")[0]}</Badge>
                      ) : (
                        <Badge>{t.unassigned}</Badge>
                      )}
                      {report.note_count > 0 && (
                        <span className="tnum text-[11px] text-mist-600">
                          {fill(t.notes, { n: nf.format(report.note_count) })}
                        </span>
                      )}
                      <span className="text-[11px] text-mist-600">{timeAgo(report.created_at, locale)}</span>
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
