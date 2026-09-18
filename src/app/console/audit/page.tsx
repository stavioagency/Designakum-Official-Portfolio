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
                /*
                  Two lines on a phone, not one line wrapped four times.

                  This row put the action, the actor, an arrow, the target and
                  the timestamp in a single wrapping flex track, with the time
                  pushed to the far end by `ms-auto`. On a narrow screen the
                  track broke wherever it ran out of room and the time landed
                  in the middle of the entry, so nothing lined up with anything
                  above or below it.

                  What is stable now: the action and the time share the top
                  line, everything about who and what sits under it.
                */
                <li key={entry.id} className="px-4 py-3.5 sm:px-5">
                  {/* Wrapping rather than breaking: an action name split across
                      two lines mid-word is harder to read than a timestamp on
                      a line of its own. */}
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                    <code
                      dir="ltr"
                      className="shrink-0 rounded-lg bg-white/[0.06] px-2 py-1 text-[11.5px] text-mist-200"
                    >
                      {entry.action}
                    </code>
                    <span className="shrink-0 text-[11px] text-mist-600">
                      {formatDateTime(entry.created_at, locale)}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span dir="ltr" className="break-all text-[12px] text-mist-400">
                      {entry.actor_email}
                    </span>
                    {entry.target_label && (
                      <>
                        <span className="flip-rtl text-mist-600" aria-hidden>→</span>
                        {entry.target_type === "user" ? (
                          <Link
                            href={`/console/customers/${entry.target_id}`}
                            className="break-all text-[12px] text-mist-200 underline decoration-white/20 underline-offset-4 hover:text-white"
                          >
                            {entry.target_label}
                          </Link>
                        ) : (
                          <span className="break-all text-[12px] text-mist-200">{entry.target_label}</span>
                        )}
                      </>
                    )}
                  </div>

                  {entry.detail && (
                    <p className="mt-1.5 break-words text-[12.5px] leading-relaxed text-mist-400">{entry.detail}</p>
                  )}

                  {/*
                    The before and after are raw stored JSON, and they are long.
                    Bare on the page they read as text that has broken out of
                    the row; in a box of their own they read as what they are,
                    a record you can drag sideways to finish.
                  */}
                  {(entry.before_state || entry.after_state) && (
                    <pre
                      dir="ltr"
                      className="no-scrollbar mt-2 overflow-x-auto rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-start font-mono text-[11px] leading-relaxed text-mist-500"
                    >
                      {`${entry.before_state || "·"} → ${entry.after_state || "·"}`}
                    </pre>
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
