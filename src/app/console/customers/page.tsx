import Link from "next/link";
import { currentLocale } from "@/lib/locale";
import { dict, fill } from "@/lib/i18n";
import type { Metadata } from "next";
import { listCustomers, type CustomerFilter } from "@/lib/customers";
import { guardPage } from "@/lib/permissions";
import {
  Badge,
  EmptyState,
  PageHeader,
  Pagination,
  SectionCard,
  formatDate,
  nf,
  timeAgo,
} from "@/components/console/ui";
import { FilterSelect, SearchField } from "@/components/console/forms";
import { Ban, ExternalLink, Eye, Flag, LifeBuoy, Users } from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: dict(await currentLocale()).console.customers.title };
}
export const dynamic = "force-dynamic";

const PER_PAGE = 20;



type Search = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await guardPage("customers.view");
  const params = await searchParams;

  const page = Math.max(1, Number(one(params.page)) || 1);
  const search = one(params.q) ?? "";
  const plan = (one(params.plan) ?? "all") as NonNullable<CustomerFilter["plan"]>;
  const status = (one(params.status) ?? "all") as NonNullable<CustomerFilter["status"]>;
  const sort = (one(params.sort) ?? "recent") as NonNullable<CustomerFilter["sort"]>;
  const deleted = one(params.deleted) ?? "";

  const { rows, total } = await listCustomers({
    search,
    plan,
    status,
    sort,
    limit: PER_PAGE,
    offset: (page - 1) * PER_PAGE,
  });

  const buildPage = (next: number) => {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    if (plan !== "all") query.set("plan", plan);
    if (status !== "all") query.set("status", status);
    if (sort !== "recent") query.set("sort", sort);
    if (next > 1) query.set("page", String(next));
    const qs = query.toString();
    return qs ? `/console/customers?${qs}` : "/console/customers";
  };

  const filtered = Boolean(search) || plan !== "all" || status !== "all";
  const locale = await currentLocale();
  const c = dict(locale).console;
  const t = c.customers;
  const planLabel: Record<string, string> = c.plans;
  const sourceLabel: Record<string, string> = c.sources;

  return (
    <>
      <PageHeader
        title={t.title}
        description={fill(filtered ? t.countFiltered : t.count, { n: nf.format(total) })}
      />

      {/* Carried in the URL because deleting sends you back here: without it the
          row simply vanishes and nothing confirms it was you who did that. */}
      {deleted && (
        <p className="mb-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-200">
          {fill(t.deletedNotice, { email: deleted })}
        </p>
      )}

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <SearchField placeholder={t.searchPlaceholder} clearLabel={c.common.clearSearch} />
        <FilterSelect
          paramName="plan"
          label={t.plan}
          options={[
            { value: "all", label: c.common.all },
            { value: "monthly", label: c.plans.monthly },
            { value: "yearly", label: c.plans.yearly },
            { value: "free", label: c.plans.none },
          ]}
        />
        <FilterSelect
          paramName="status"
          label={t.status}
          options={[
            { value: "all", label: c.common.all },
            { value: "active", label: t.statusActive },
            { value: "suspended", label: t.statusSuspended },
            { value: "portfolio_suspended", label: t.statusPortfolioSuspended },
          ]}
        />
        <FilterSelect
          paramName="sort"
          label={t.sort}
          options={[
            { value: "recent", label: t.sortRecent },
            { value: "views", label: t.sortViews },
            { value: "name", label: t.sortName },
          ]}
        />
      </div>

      <SectionCard>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title={filtered ? t.emptyFiltered : t.empty}
            body={
              filtered
                ? t.emptyFilteredBody
                : t.emptyBody
            }
            action={
              filtered ? (
                <Link href="/console/customers" className="btn btn-ghost">
                  {t.clearFilters}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-white/6">
              {rows.map((row) => (
                <li key={row.id} className="transition hover:bg-white/[0.02]">
                  {/* Stacked on a phone. Sharing one line with the badges and
                      the two buttons left the name about 120px, so every
                      customer in the list read "Alex …" over "alex@d…". */}
                  <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
                    <Link
                      href={`/console/customers/${row.id}`}
                      className="flex min-w-0 items-center gap-3 sm:flex-1"
                    >
                      <span className="accent-grad grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-2xl text-[14px] font-bold">
                        {row.slug && row.portfolio_name ? (
                          row.portfolio_name.trim().charAt(0)
                        ) : (
                          row.display_name.trim().charAt(0) || "?"
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[14.5px] font-semibold">
                            {row.portfolio_name || row.display_name}
                          </span>
                          {row.status === "suspended" && (
                            <Badge tone="bad">
                              <Ban className="h-3 w-3" />
                              {t.suspended}
                            </Badge>
                          )}
                          {row.suspended === 1 && row.status !== "suspended" && (
                            <Badge tone="warn">{t.portfolioSuspended}</Badge>
                          )}
                        </span>
                        <span dir="ltr" className="block truncate text-start text-[11.5px] text-mist-500">
                          {row.email}
                        </span>
                      </span>
                    </Link>

                    <div className="flex flex-wrap items-center gap-2">
                      {row.subscription_status === "active" ? (
                        <Badge tone={row.subscription_source === "paid" ? "good" : "accent"}>
                          {planLabel[row.subscription_plan ?? "free"]}
                          {row.subscription_source && row.subscription_source !== "paid"
                            ? ` · ${sourceLabel[row.subscription_source]}`
                            : ""}
                        </Badge>
                      ) : (
                        <Badge>{c.plans.none}</Badge>
                      )}

                      {row.open_reports > 0 && (
                        <Badge tone="bad">
                          <Flag className="h-3 w-3" />
                          {row.open_reports}
                        </Badge>
                      )}
                      {row.open_tickets > 0 && (
                        <Badge tone="warn">
                          <LifeBuoy className="h-3 w-3" />
                          {row.open_tickets}
                        </Badge>
                      )}

                      <span className="tnum hidden items-center gap-1 text-[11.5px] text-mist-500 sm:flex">
                        <Eye className="h-3.5 w-3.5" />
                        {nf.format(row.views ?? 0)}
                      </span>

                      <span className="hidden text-[11.5px] text-mist-600 lg:block">
                        {row.last_seen_at ? timeAgo(row.last_seen_at, locale) : formatDate(row.created_at, locale)}
                      </span>

                      {row.slug && (
                        <Link
                          href={`/p/${row.slug}`}
                          target="_blank"
                          aria-label={t.openPortfolio}
                          className="icon-btn !h-8 !w-8"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      )}
                      <Link
                        href={`/console/customers/${row.id}`}
                        className="btn btn-ghost !px-3 !py-1.5 !text-[12.5px]"
                      >
                        {t.manage}
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination total={total} page={page} perPage={PER_PAGE} build={buildPage} />
          </>
        )}
      </SectionCard>
    </>
  );
}
