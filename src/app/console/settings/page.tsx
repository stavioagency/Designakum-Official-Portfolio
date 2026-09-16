import type { Metadata } from "next";
import { currentLocale } from "@/lib/locale";
import { dict, fill } from "@/lib/i18n";
import { currentUser } from "@/lib/auth";
import { guardPage, roleLabel } from "@/lib/permissions";
import { readSettings } from "@/lib/settings";
import { staffMembers } from "@/lib/customers";
import { BRAND_ASSETS, brandAsset } from "@/lib/brand";
import { billingConfigured } from "@/lib/billing";
import { googleConfigured } from "@/lib/google";
import { Badge, PageHeader, SectionCard, formatDate } from "@/components/console/ui";
import { SettingsGroup } from "@/components/console/settings-form";
import { CreateStaffForm, StaffRoleControl } from "@/components/console/staff-forms";
import { BrandAssets } from "@/components/admin/brand-assets";
import { EmailChange } from "@/components/account/email-change";

export async function generateMetadata(): Promise<Metadata> {
  return { title: dict(await currentLocale()).console.nav.settings };
}
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await guardPage("settings.manage");
  const me = (await currentUser())!;
  const settings = await readSettings();
  const locale = await currentLocale();
  const d = dict(locale).console;
  const t = d.settings;
  const staffCopy = d.staff;
  const staff = await staffMembers();

  const assetSlots = [
    ...BRAND_ASSETS.map((asset) => ({
      name: asset.name,
      description: locale === "en" ? asset.descriptionEn : asset.description,
      url: brandAsset(asset.name),
      onLight: asset.name.endsWith("-dark"),
    })),
    {
      name: "favicon",
      description: t.faviconHint,
      url: brandAsset("favicon"),
      onLight: false,
    },
  ];

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
      />

      <div className="space-y-4">
        <SettingsGroup
          saveLabel={t.save}
          riyalLabel={t.riyal}
          title={t.pricing}
          description={t.pricingHint}
          fields={[
            { key: "pricing.monthly_halalas", label: t.monthlyPrice, type: "money", value: settings["pricing.monthly_halalas"] },
            { key: "pricing.yearly_halalas", label: t.yearlyPrice, type: "money", value: settings["pricing.yearly_halalas"] },
          ]}
        />

        <SettingsGroup
          saveLabel={t.save}
          riyalLabel={t.riyal}
          title={t.platformState}
          fields={[
            {
              key: "platform.maintenance",
              label: t.maintenance,
              hint: t.maintenanceHint,
              type: "boolean",
              value: settings["platform.maintenance"],
            },
            {
              key: "platform.maintenance_includes_portfolios",
              label: t.maintenancePortfolios,
              hint: t.maintenancePortfoliosHint,
              type: "boolean",
              value: settings["platform.maintenance_includes_portfolios"],
            },
            {
              key: "platform.maintenance_message",
              label: t.maintenanceMessage,
              type: "textarea",
              value: settings["platform.maintenance_message"],
            },
            {
              key: "platform.signups_open",
              label: t.signupsOpen,
              hint: t.signupsOpenHint,
              type: "boolean",
              value: settings["platform.signups_open"],
            },
            {
              key: "platform.invite_only",
              label: t.inviteOnly,
              hint: t.inviteOnlyHint,
              type: "boolean",
              value: settings["platform.invite_only"],
            },
          ]}
        />

        <SettingsGroup
          saveLabel={t.save}
          riyalLabel={t.riyal}
          title={t.features}
          description={t.featuresHint}
          fields={[
            {
              key: "features.google_signin",
              label: t.googleSignin,
              hint: googleConfigured() ? t.googleConfigured : t.googleNotConfigured,
              type: "boolean",
              value: settings["features.google_signin"],
            },
            { key: "features.reports", label: t.reportsFeature, type: "boolean", value: settings["features.reports"] },
            { key: "features.support", label: t.supportFeature, type: "boolean", value: settings["features.support"] },
            { key: "features.public_showcase", label: t.showcaseFeature, type: "boolean", value: settings["features.public_showcase"] },
          ]}
        />

        <SettingsGroup
          saveLabel={t.save}
          riyalLabel={t.riyal}
          title={t.brand}
          fields={[
            { key: "brand.name_ar", label: t.nameAr, type: "text", value: settings["brand.name_ar"] },
            { key: "brand.name_en", label: t.nameEn, type: "text", value: settings["brand.name_en"] },
            { key: "brand.tagline_ar", label: t.taglineAr, type: "text", value: settings["brand.tagline_ar"] },
            { key: "brand.tagline_en", label: t.taglineEn, type: "text", value: settings["brand.tagline_en"] },
            { key: "brand.support_email", label: t.supportEmail, type: "text", value: settings["brand.support_email"] },
          ]}
        />

        <BrandAssets slots={assetSlots} copy={d.brandAssets} />

        <SettingsGroup
          saveLabel={t.save}
          riyalLabel={t.riyal}
          title={t.support}
          columns={1}
          fields={[
            { key: "support.hours", label: t.supportHours, type: "text", value: settings["support.hours"] },
            { key: "support.hours_en", label: t.supportHoursEn, hint: t.englishHint, type: "text", value: settings["support.hours_en"] },
            { key: "support.intro", label: t.supportIntro, type: "textarea", value: settings["support.intro"] },
            { key: "support.intro_en", label: t.supportIntroEn, hint: t.englishHint, type: "textarea", value: settings["support.intro_en"] },
          ]}
        />

        <SettingsGroup
          saveLabel={t.save}
          riyalLabel={t.riyal}
          title={t.policies}
          columns={1}
          description={t.policiesHint}
          fields={[
            { key: "rules.portfolio", label: t.rules, type: "textarea", value: settings["rules.portfolio"] },
            { key: "rules.portfolio_en", label: t.rulesEn, hint: t.englishHint, type: "textarea", value: settings["rules.portfolio_en"] },
            { key: "policy.terms", label: t.terms, type: "textarea", value: settings["policy.terms"] },
            { key: "policy.terms_en", label: t.termsEn, hint: t.englishHint, type: "textarea", value: settings["policy.terms_en"] },
            { key: "policy.privacy", label: t.privacy, type: "textarea", value: settings["policy.privacy"] },
            { key: "policy.privacy_en", label: t.privacyEn, hint: t.englishHint, type: "textarea", value: settings["policy.privacy_en"] },
          ]}
        />

        {/* Owners and support reach the console but not the customer dashboard —
            two of the three owner accounts have no portfolio at all — so the
            account's own email has to be changeable from here too. */}
        <EmailChange
          currentEmail={me.email}
          hasPassword={me.password_hash !== ""}
          usesGoogle={Boolean(me.google_id)}
          t={dict(locale).dashboard.settings}
          saving={dict(locale).dashboard.common.saving}
        />

        <SectionCard
          title={t.team}
          description={t.teamHint}
        >
          <ul className="divide-y divide-white/6">
            {staff.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span className="accent-grad grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[13px] font-bold">
                  {(member.display_name || member.email).trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">
                    {member.display_name || member.email}
                  </span>
                  <span dir="ltr" className="block truncate text-start text-[11.5px] text-mist-500">
                    {member.email}
                  </span>
                </span>
                <Badge tone={member.role === "owner" ? "accent" : "neutral"}>
                  {roleLabel(member.role, locale)}
                </Badge>
                <span className="hidden text-[11px] text-mist-600 sm:block">
                  {fill(t.joined, { date: formatDate(member.created_at, locale) })}
                </span>
                <StaffRoleControl copy={staffCopy}
                  userId={member.id}
                  role={member.role}
                  isSelf={member.id === me.id}
                />
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title={t.newStaff}>
          <CreateStaffForm copy={staffCopy} />
        </SectionCard>

        <SectionCard title={t.server} description={t.serverHint}>
          <ul className="divide-y divide-white/6 text-[13px]">
            <li className="flex items-center justify-between gap-3 px-5 py-3">
              <span>{t.googleLogin}</span>
              <Badge tone={googleConfigured() ? "good" : "neutral"}>
                {googleConfigured() ? t.configured : t.notConfigured}
              </Badge>
            </li>
            <li className="flex items-center justify-between gap-3 px-5 py-3">
              <span>{t.paymentProvider}</span>
              <Badge tone={billingConfigured() ? "good" : "warn"}>
                {billingConfigured() ? t.configured : t.notConfigured}
              </Badge>
            </li>
            <li className="flex items-center justify-between gap-3 px-5 py-3">
              <span>{t.sessionSecret}</span>
              <Badge tone={process.env.AUTH_SECRET ? "good" : "warn"}>
                {process.env.AUTH_SECRET ? t.configured : t.usingDefaultSecret}
              </Badge>
            </li>
          </ul>
          <p className="border-t border-white/8 px-5 py-3 text-[11.5px] leading-relaxed text-mist-500">
            {t.noSecretsShown}
          </p>
        </SectionCard>
      </div>
    </>
  );
}
