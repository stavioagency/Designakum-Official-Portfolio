import Link from "next/link";
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

export const metadata: Metadata = { title: "العملاء" };
export const dynamic = "force-dynamic";

const PER_PAGE = 20;

const PLAN_LABEL: Record<string, string> = {
  free: "مجانية",
  monthly: "شهرية",
  yearly: "سنوية",
};

const SOURCE_LABEL: Record<string, string> = {
  paid: "مدفوع",
  manual: "ممنوح",
  invitation: "دعوة",
};

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

  return (
    <>
      <PageHeader
        title="العملاء"
        description={`${nf.format(total)} حساب${filtered ? " مطابق للبحث" : ""}`}
      />

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <SearchField placeholder="ابحث بالاسم أو البريد أو رابط المعرض…" />
        <FilterSelect
          paramName="plan"
          label="الباقة"
          options={[
            { value: "all", label: "الكل" },
            { value: "monthly", label: "شهرية" },
            { value: "yearly", label: "سنوية" },
            { value: "free", label: "بدون اشتراك" },
          ]}
        />
        <FilterSelect
          paramName="status"
          label="الحالة"
          options={[
            { value: "all", label: "الكل" },
            { value: "active", label: "نشط" },
            { value: "suspended", label: "موقوف" },
            { value: "portfolio_suspended", label: "معرض موقوف" },
          ]}
        />
        <FilterSelect
          paramName="sort"
          label="الترتيب"
          options={[
            { value: "recent", label: "الأحدث" },
            { value: "views", label: "الأكثر مشاهدة" },
            { value: "name", label: "الاسم" },
          ]}
        />
      </div>

      <SectionCard>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title={filtered ? "لا نتائج مطابقة" : "لا يوجد عملاء بعد"}
            body={
              filtered
                ? "جرّب تعديل كلمات البحث أو إزالة بعض عوامل التصفية."
                : "سيظهر هنا كل من ينشئ حسابًا على ديزاينكم."
            }
            action={
              filtered ? (
                <Link href="/console/customers" className="btn btn-ghost">
                  إزالة التصفية
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-white/6">
              {rows.map((row) => (
                <li key={row.id} className="transition hover:bg-white/[0.02]">
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
                    <Link
                      href={`/console/customers/${row.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <span className="accent-grad grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-2xl text-[14px] font-bold">
                        {row.slug && row.portfolio_name ? (
                          row.portfolio_name.trim().charAt(0)
                        ) : (
                          row.display_name.trim().charAt(0) || "?"
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[14.5px] font-semibold">
                            {row.portfolio_name || row.display_name}
                          </span>
                          {row.status === "suspended" && (
                            <Badge tone="bad">
                              <Ban className="h-3 w-3" />
                              موقوف
                            </Badge>
                          )}
                          {row.suspended === 1 && row.status !== "suspended" && (
                            <Badge tone="warn">معرض موقوف</Badge>
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
                          {PLAN_LABEL[row.subscription_plan ?? "free"]}
                          {row.subscription_source && row.subscription_source !== "paid"
                            ? ` · ${SOURCE_LABEL[row.subscription_source]}`
                            : ""}
                        </Badge>
                      ) : (
                        <Badge>بدون اشتراك</Badge>
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
                        {row.last_seen_at ? timeAgo(row.last_seen_at) : formatDate(row.created_at)}
                      </span>

                      {row.slug && (
                        <Link
                          href={`/p/${row.slug}`}
                          target="_blank"
                          aria-label="فتح المعرض"
                          className="icon-btn !h-8 !w-8"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      )}
                      <Link
                        href={`/console/customers/${row.id}`}
                        className="btn btn-ghost !px-3 !py-1.5 !text-[12.5px]"
                      >
                        إدارة
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
