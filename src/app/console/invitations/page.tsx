import type { Metadata } from "next";
import { invitationStats, listInvitations } from "@/lib/invitations";
import { guardPage } from "@/lib/permissions";
import { requestOrigin } from "@/lib/origin";
import {
  Badge,
  EmptyState,
  PageHeader,
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

export const metadata: Metadata = { title: "الدعوات" };
export const dynamic = "force-dynamic";

export default async function InvitationsPage() {
  await guardPage("invitations.manage");

  const invitations = await listInvitations();
  const stats = await invitationStats();
  const origin = await requestOrigin();

  const stateOf = (invitation: (typeof invitations)[number]) => {
    if (invitation.revoked === 1) return { label: "ملغاة", tone: "bad" as const };
    if (invitation.expires_at && invitation.expires_at < Date.now())
      return { label: "منتهية", tone: "neutral" as const };
    if (invitation.used_count >= invitation.max_uses)
      return { label: "مستخدمة", tone: "neutral" as const };
    return { label: "فعّالة", tone: "good" as const };
  };

  return (
    <>
      <PageHeader
        title="الدعوات والاشتراكات المجانية"
        description="امنح أشخاصًا مختارين اشتراكًا كاملًا عبر رابط أو رمز أو دعوة لبريد محدد."
      />

      <section className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="دعوات فعّالة" value={nf.format(stats.live)} icon={<Gift className="h-4 w-4" />} tone="accent" />
        <StatCard label="إجمالي الدعوات" value={nf.format(stats.total)} />
        <StatCard label="مرات الاستخدام" value={nf.format(stats.redeemed)} tone="good" />
      </section>

      <SectionCard title="دعوة جديدة" className="mb-4">
        <CreateInvitationForm />
      </SectionCard>

      <SectionCard title="كل الدعوات">
        {invitations.length === 0 ? (
          <EmptyState
            icon={<Gift className="h-5 w-5" />}
            title="لا دعوات بعد"
            body="أنشئ دعوة من الأعلى، ثم شارك الرابط أو الرمز مع من تريد منحه اشتراكًا مجانيًا."
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
                      {invitation.plan === "monthly" ? "شهرية" : "سنوية"} · {invitation.months}{" "}
                      {invitation.plan === "yearly" ? "سنة" : "شهر"}
                      {invitation.email && (
                        <span dir="ltr" className="text-mist-500"> · {invitation.email}</span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-mist-500">
                      {invitation.note || "بدون ملاحظة"}
                      {invitation.redeemed_by && ` · استخدمها: ${invitation.redeemed_by}`}
                    </span>
                  </span>

                  <span className="tnum text-[12px] text-mist-500">
                    {invitation.used_count}/{invitation.max_uses}
                  </span>
                  <span className="text-[11.5px] text-mist-600">
                    {invitation.expires_at ? `حتى ${formatDate(invitation.expires_at)}` : "بلا انتهاء"}
                  </span>
                  <Badge tone={state.tone}>{state.label}</Badge>

                  <span className="flex items-center gap-2">
                    <CopyInvitationLink code={invitation.code} origin={origin} />
                    {invitation.revoked === 0 && (
                      <RevokeInvitation id={invitation.id} code={invitation.code} />
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
