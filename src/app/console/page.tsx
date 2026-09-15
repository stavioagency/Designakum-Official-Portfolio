import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { platformStats, recentActivity } from "@/lib/console-stats";
import {
  eventSeries,
  registrationSeries,
  seriesTotal,
  uniqueVisitorSeries,
} from "@/lib/analytics";
import { brandAsset } from "@/lib/brand";
import { Riyal } from "@/components/riyal";
import {
  Badge,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  money,
  nf,
  timeAgo,
} from "@/components/console/ui";
import {
  Ban,
  Bell,
  CreditCard,
  Eye,
  Flag,
  Gift,
  LifeBuoy,
  Sparkle,
  Users,
  Wallet,
} from "@/components/icons";
import type { ActivityKind } from "@/lib/console-stats";

export const dynamic = "force-dynamic";

const ACTIVITY_STYLE: Record<ActivityKind, { label: string; tone: "neutral" | "good" | "warn" | "bad" | "accent" }> = {
  signup: { label: "تسجيل", tone: "accent" },
  subscription: { label: "اشتراك", tone: "good" },
  report: { label: "بلاغ", tone: "bad" },
  ticket: { label: "تذكرة", tone: "warn" },
  audit: { label: "إجراء", tone: "neutral" },
};

const DENIED_LABEL: Record<string, string> = {
  "billing.manage": "إدارة الاشتراكات",
  "invitations.manage": "الدعوات",
  "settings.manage": "إعدادات المنصة",
  "audit.view": "سجل التدقيق",
  "announcements.manage": "الإعلانات",
  "staff.manage": "إدارة الفريق",
  "customers.delete": "حذف الحسابات",
  "moderation.enforce": "إجراءات الإيقاف",
};

export default async function ConsoleDashboard({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = (await currentUser())!;
  const { denied } = await searchParams;
  const stats = platformStats();
  const activity = recentActivity(14);
  const riyalSrc = brandAsset("riyal");

  const views = eventSeries("view", 30);
  const visitors = uniqueVisitorSeries(30);
  const signups = registrationSeries(30);
  const showRevenue = can(user, "billing.manage");

  return (
    <>
      <PageHeader
        title="نظرة عامة"
        description="حالة منصة ديزاينكم الآن، مبنية على بيانات التطبيق الفعلية."
        actions={
          <>
            {stats.pendingReports > 0 && can(user, "moderation.review") && (
              <Link href="/console/moderation" className="btn btn-ghost !py-2.5">
                <Flag className="h-4 w-4" />
                {stats.pendingReports} بلاغ بانتظارك
              </Link>
            )}
            {stats.openTickets > 0 && can(user, "support.manage") && (
              <Link href="/console/support" className="btn btn-ghost !py-2.5">
                <LifeBuoy className="h-4 w-4" />
                {stats.openTickets} تذكرة مفتوحة
              </Link>
            )}
          </>
        }
      />

      {denied && (
        <p className="panel mb-4 flex items-center gap-2.5 px-4 py-3 text-[13px] text-amber-200">
          <Ban className="h-4 w-4 shrink-0" />
          {DENIED_LABEL[denied]
            ? `قسم «${DENIED_LABEL[denied]}» متاح لمالك المنصة فقط.`
            : "ليست لديك صلاحية فتح هذا القسم."}
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="إجمالي العملاء"
          value={nf.format(stats.totalUsers)}
          hint={`${nf.format(stats.newThisMonth)} خلال 30 يومًا`}
          icon={<Users className="h-4 w-4" />}
          tone="accent"
          href="/console/customers"
          series={signups}
        />
        <StatCard
          label="عملاء نشطون"
          value={nf.format(stats.activeUsers)}
          hint="ظهروا خلال آخر 30 يومًا"
          icon={<Sparkle className="h-4 w-4" />}
          tone="good"
        />
        <StatCard
          label="اشتراكات نشطة"
          value={nf.format(stats.activeSubscriptions)}
          hint={`${nf.format(stats.monthlySubscribers)} شهري · ${nf.format(stats.yearlySubscribers)} سنوي`}
          icon={<CreditCard className="h-4 w-4" />}
          tone="good"
          href={can(user, "billing.manage") ? "/console/subscriptions" : undefined}
        />
        {showRevenue ? (
          <StatCard
            label="الإيراد الشهري المتكرر"
            value={money(stats.mrr)}
            hint={`سنويًا ${money(stats.arr)} · معدل التسرب ${stats.churnPercent.toFixed(1)}%`}
            icon={<Wallet className="h-4 w-4" />}
            tone="accent"
          />
        ) : (
          <StatCard
            label="معارض منشورة"
            value={`${nf.format(stats.publishedPortfolios)}/${nf.format(stats.totalPortfolios)}`}
            icon={<Eye className="h-4 w-4" />}
          />
        )}
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="بدون اشتراك"
          value={nf.format(stats.freeUsers)}
          hint={`منهم ${nf.format(stats.compedSubscribers)} اشتراك مجاني ممنوح`}
          icon={<Gift className="h-4 w-4" />}
        />
        <StatCard
          label="حسابات موقوفة"
          value={nf.format(stats.suspendedUsers)}
          hint={`${nf.format(stats.suspendedPortfolios)} معرض موقوف`}
          icon={<Ban className="h-4 w-4" />}
          tone={stats.suspendedUsers > 0 ? "bad" : "neutral"}
        />
        <StatCard
          label="اشتراكات منتهية أو ملغاة"
          value={nf.format(stats.endedSubscriptions)}
          icon={<CreditCard className="h-4 w-4" />}
          tone={stats.endedSubscriptions > 0 ? "warn" : "neutral"}
        />
        <StatCard
          label="بلاغات وتذاكر مفتوحة"
          value={`${nf.format(stats.pendingReports)} · ${nf.format(stats.openTickets)}`}
          hint="بلاغات · تذاكر"
          icon={<Bell className="h-4 w-4" />}
          tone={stats.pendingReports + stats.openTickets > 0 ? "warn" : "neutral"}
        />
      </section>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <SectionCard
          title="حركة المعارض خلال 30 يومًا"
          description={`${nf.format(seriesTotal(views))} مشاهدة · ${nf.format(seriesTotal(visitors))} زائر مختلف`}
          actions={
            can(user, "analytics.view") && (
              <Link href="/console/analytics" className="btn btn-ghost !px-3 !py-1.5 !text-[12.5px]">
                التحليلات
              </Link>
            )
          }
        >
          <div className="p-5">
            {seriesTotal(views) === 0 ? (
              <EmptyState
                icon={<Eye className="h-5 w-5" />}
                title="لا توجد مشاهدات بعد"
                body="ستظهر هنا حركة الزوار بمجرد أن يبدأ العملاء بمشاركة روابط معارضهم."
              />
            ) : (
              <>
                <div className="flex items-end gap-[3px]" style={{ height: 150 }} dir="ltr">
                  {views.map((point, index) => {
                    const max = Math.max(1, ...views.map((v) => v.value));
                    const unique = visitors[index]?.value ?? 0;
                    return (
                      <div key={point.day} className="group relative flex-1">
                        <div
                          className="w-full rounded-t-[3px] bg-white/[0.08]"
                          style={{ height: Math.max(2, (point.value / max) * 150) }}
                        >
                          <div
                            className="accent-grad w-full rounded-t-[3px]"
                            style={{
                              height: `${point.value ? (unique / point.value) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="glass pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-lg px-2 py-1 text-[10.5px] group-hover:block">
                          {point.day} · {point.value} مشاهدة · {unique} زائر
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-4 text-[11.5px] text-mist-500">
                  <span className="flex items-center gap-1.5">
                    <span className="accent-grad h-2.5 w-2.5 rounded-sm" />
                    زوار مختلفون
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-white/[0.12]" />
                    إجمالي المشاهدات
                  </span>
                </div>
              </>
            )}
          </div>
        </SectionCard>

        <SectionCard title="آخر النشاطات" description="من كل أنحاء المنصة">
          {activity.length === 0 ? (
            <EmptyState title="لا نشاط بعد" body="سيظهر هنا كل تسجيل واشتراك وبلاغ وتذكرة فور حدوثه." />
          ) : (
            <ul className="divide-y divide-white/6">
              {activity.map((item) => {
                const style = ACTIVITY_STYLE[item.kind];
                const row = (
                  <>
                    <Badge tone={style.tone}>{style.label}</Badge>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px]">{item.title}</span>
                      <span className="block truncate text-[11.5px] text-mist-500">{item.detail}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-mist-600">{timeAgo(item.created_at)}</span>
                  </>
                );
                return (
                  <li key={`${item.kind}-${item.id}`}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="flex items-center gap-3 px-5 py-3 transition hover:bg-white/[0.03]"
                      >
                        {row}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-5 py-3">{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      {showRevenue && (
        <p className="mt-4 flex items-center gap-1.5 text-[12px] text-mist-600">
          كل المبالغ بالريال السعودي
          <Riyal src={riyalSrc} size="0.9em" />
        </p>
      )}
    </>
  );
}
