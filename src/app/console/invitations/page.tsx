import type { Metadata } from "next";
import { currentLocale } from "@/lib/locale";
import { dict, fill } from "@/lib/i18n";
import { invitationStats, listInvitations } from "@/lib/invitations";
import { guardPage } from "@/lib/permissions";
import { requestOrigin } from "@/lib/origin";
import {
  Badge,
  EmptyState,
  PageHeader,
  Pagination,
  SectionCard,
  StatCard,
  formatDate,
  nf,
} from "@/components/console/ui";
import {
  CopyInvitationLink,
  CreateInvitationForm,
  RevokeInvitation,
} from "@/components/console/invitation-forms";
import { Gift } from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: dict(await currentLocale()).console.nav.invitations };
}
export const dynamic = "force-dynamic";

const PER_PAGE = 25;

type Search = Record<string, string | string[] | undefined>;

export default async function InvitationsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await guardPage("invitations.manage");

  const params = await searchParams;
  const raw = params.page;
  const page = Math.max(1, Number(Array.isArray(raw) ? raw[0] : raw) || 1);

  const { rows: invitations, total } = await listInvitations({
    limit: PER_PAGE,
    offset: (page - 1) * PER_PAGE,
  });
  const stats = await invitationStats();
  const origin = await requestOrigin();
  const locale = await currentLocale();
  const c = dict(locale).console;
  const t = c.invitations;
  const dialogChrome = {
    cancel: c.common.cancel,
    pending: c.common.saving,
    confirmParts: [c.common.confirmBefore, c.common.confirmAfter] as [string, string],
  };


  const stateOf = (invitation: (typeof invitations)[number]) => {
    if (invitation.revoked === 1) return { label: t.stateRevoked, tone: "bad" as const };
    if (invitation.expires_at && invitation.expires_at < Date.now())
      return { label: t.stateExpired, tone: "neutral" as const };
    if (invitation.used_count >= invitation.max_uses)
      return { label: t.stateUsedUp, tone: "neutral" as const };
    return { label: t.stateLive, tone: "good" as const };
  };

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
      />

      <section className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t.liveCount}
          value={nf.format(stats.live)}
          icon={<Gift className="h-4 w-4" />}
          tone="accent"
        />
        <StatCard label={t.totalCount} value={nf.format(stats.total)} />
        <StatCard label={t.redeemedCount} value={nf.format(stats.redeemed)} tone="good" />
      </section>

      <SectionCard title={t.create} className="mb-4">
        <CreateInvitationForm copy={t} plans={{ monthly: c.plans.monthly, yearly: c.plans.yearly }} />
      </SectionCard>

      <SectionCard title={t.all}>
        {invitations.length === 0 ? (
          <EmptyState
            icon={<Gift className="h-5 w-5" />}
            title={t.empty}
            body={t.emptyBody}
          />
        ) : (
          <ul className="divide-y divide-white/6">
            {invitations.map((invitation) => {
              const state = stateOf(invitation);
              return (
                <li key={invitation.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <code
                    dir="ltr"
                    className="rounded-xl bg-white/[0.06] px-3 py-1.5 text-[13px] font-semibold tracking-wider"
                  >
                    {invitation.code}
                  </code>

                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px]">
                      {invitation.plan === "monthly" ? c.plans.monthly : c.plans.yearly} ·{" "}
                      {invitation.months}{" "}
                      {invitation.plan === "yearly" ? t.years : t.months}
                      {invitation.email && (
                        <span dir="ltr" className="text-mist-500"> · {invitation.email}</span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-mist-500">
                      {invitation.note || t.noNote}
                      {invitation.redeemed_by &&
                        ` · ${fill(t.redeemedBy, { emails: invitation.redeemed_by })}`}
                    </span>
                  </span>

                  <span className="tnum text-[12px] text-mist-500">
                    {invitation.used_count}/{invitation.max_uses}
                  </span>
                  <span className="text-[11.5px] text-mist-600">
                    {invitation.expires_at
                      ? fill(t.until, { date: formatDate(invitation.expires_at, locale) })
                      : t.noExpiry}
                  </span>
                  <Badge tone={state.tone}>{state.label}</Badge>

                  <span className="flex items-center gap-2">
                    <CopyInvitationLink code={invitation.code} origin={origin} copy={t} />
                    {invitation.revoked === 0 && (
                      <RevokeInvitation
                        id={invitation.id}
                        code={invitation.code}
                        copy={t}
                        dialog={dialogChrome}
                      />
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <Pagination
          total={total}
          page={page}
          perPage={PER_PAGE}
          build={(next) => (next > 1 ? `/console/invitations?page=${next}` : "/console/invitations")}
          labels={{ prev: c.common.prev, next: c.common.next, range: c.common.range }}
        />
      </SectionCard>
    </>
  );
}
