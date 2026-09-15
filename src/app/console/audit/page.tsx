import Link from "next/link";
import { currentLocale } from "@/lib/locale";
import { dict, fill } from "@/lib/i18n";
import type { Metadata } from "next";
import { auditActions, queryAudit } from "@/lib/audit";
import { guardPage } from "@/lib/permissions";
import {
  EmptyState,
  PageHeader,
  Pagination,
  SectionCard,
  formatDate,
  formatDateTime,
  nf,
} from "@/components/console/ui";
import { FilterSelect, SearchField } from "@/components/console/forms";
import { History } from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: dict(await currentLocale()).console.audit.title };
}
export const dynamic = "force-dynamic";

const PER_PAGE = 40;

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AuditPage({ searchParams }: { searchParams: Promise<Search> }) {
  await guardPage("audit.view");
  const params = await searchParams;

  const search = one(params.q) ?? "";
  const action = one(params.action) ?? "";
  const page = Math.max(1, Number(one(params.page)) || 1);

  const { rows, total } = await queryAudit({
    search,
    action: action || undefined,
    limit: PER_PAGE,
    offset: (page - 1) * PER_PAGE,
  });
  const actions = await auditActions();
  const locale = await currentLocale();
  const c = dict(locale).console;
  const t = c.audit;

  const build = (next: number) => {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    if (action) query.set("action", action);
    if (next > 1) query.set("page", String(next));
    const qs = query.toString();
    return qs ? `/console/audit?${qs}` : "/console/audit";
  };

  return (
    <>
      <PageHeader
        title={t.title}
        description={fill(t.description, { n: nf.format(total) })}
      />

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <SearchField placeholder={t.searchPlaceholder} clearLabel={c.common.clearSearch} />
        <FilterSelect
          paramName="action"
          label={t.action}
          options={[
            { value: "", label: t.allActions },
            ...actions.map((name) => ({ value: name, label: name })),
          ]}
        />
      </div>

      <SectionCard>
        {rows.length === 0 ? (
          <EmptyState
            icon={<History className="h-5 w-5" />}
            title={t.empty}
            body={t.emptyBody}
          />
        ) : (
          <>
            <ul className="divide-y divide-white/6">
              {rows.map((entry) => (
                <li key={entry.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <code
                      dir="ltr"
                      className="rounded-lg bg-white/[0.06] px-2 py-1 text-[11.5px] text-mist-200"
                    >
                      {entry.action}
                    </code>
                    <span dir="ltr" className="text-[12px] text-mist-400">
                      {entry.actor_email}
                    </span>
                    {entry.target_label && (
                      <>
                        <span className="text-mist-600">←</span>
                        {entry.target_type === "user" ? (
                          <Link
                            href={`/console/customers/${entry.target_id}`}
                            className="text-[12px] text-mist-200 underline decoration-white/20 underline-offset-4 hover:text-white"
                          >
                            {entry.target_label}
                          </Link>
                        ) : (
                          <span className="text-[12px] text-mist-200">{entry.target_label}</span>
                        )}
                      </>
                    )}
                    <span className="ms-auto shrink-0 text-[11px] text-mist-600">
                      {formatDateTime(entry.created_at, locale)}
                    </span>
                  </div>

                  {entry.detail && (
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-mist-400">{entry.detail}</p>
                  )}

                  {(entry.before_state || entry.after_state) && (
                    <p
                      dir="ltr"
                      className="mt-1.5 overflow-x-auto whitespace-nowrap text-start text-[11px] text-mist-600"
                    >
                      {entry.before_state || "—"} → {entry.after_state || "—"}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <Pagination
        total={total}
        page={page}
        perPage={PER_PAGE}
        build={build}
        labels={{ prev: c.common.prev, next: c.common.next, range: c.common.range }}
      />
          </>
        )}
      </SectionCard>
    </>
  );
}
