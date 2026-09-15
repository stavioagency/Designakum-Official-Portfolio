import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { guardPage, ROLE_LABEL } from "@/lib/permissions";
import { readSettings } from "@/lib/settings";
import { staffMembers } from "@/lib/customers";
import { BRAND_ASSETS, brandAsset } from "@/lib/brand";
import { billingConfigured } from "@/lib/billing";
import { googleConfigured } from "@/lib/google";
import { Badge, PageHeader, SectionCard, formatDate } from "@/components/console/ui";
import { SettingsGroup } from "@/components/console/settings-form";
import { CreateStaffForm, StaffRoleControl } from "@/components/console/staff-forms";
import { BrandAssets } from "@/components/admin/brand-assets";

export const metadata: Metadata = { title: "الإعدادات" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await guardPage("settings.manage");
  const me = (await currentUser())!;
  const settings = readSettings();
  const staff = staffMembers();

  const assetSlots = [
    ...BRAND_ASSETS.map((asset) => ({
      name: asset.name,
      description: asset.description,
      url: brandAsset(asset.name),
      onLight: asset.name.endsWith("-dark"),
    })),
    {
      name: "favicon",
      description: "أيقونة الموقع في تبويب المتصفح — 512×512 (اختياري)",
      url: brandAsset("favicon"),
      onLight: false,
    },
  ];

  return (
    <>
      <PageHeader
        title="إعدادات المنصة"
        description="كل ما يمكن تغييره دون نشر نسخة جديدة من التطبيق."
      />

      <div className="space-y-4">
        <SettingsGroup
          title="الأسعار والحدود"
          description="تنعكس فورًا على صفحة الأسعار ولوحات العملاء."
          fields={[
            { key: "pricing.monthly_halalas", label: "سعر الباقة الشهرية", type: "money", value: settings["pricing.monthly_halalas"] },
            { key: "pricing.yearly_halalas", label: "سعر الباقة السنوية", type: "money", value: settings["pricing.yearly_halalas"] },
            { key: "limits.free_projects", label: "حد الأعمال في الخطة المجانية", type: "number", value: settings["limits.free_projects"] },
            { key: "limits.free_slides", label: "حد الشرائح في الخطة المجانية", type: "number", value: settings["limits.free_slides"] },
          ]}
        />

        <SettingsGroup
          title="حالة المنصة"
          fields={[
            {
              key: "platform.maintenance",
              label: "وضع الصيانة",
              hint: "يغلق الصفحة الرئيسية والدخول ولوحات العملاء. معارض العملاء المنشورة تبقى متاحة لزوارها، وفريق ديزاينكم يواصل الدخول طبيعيًا.",
              type: "boolean",
              value: settings["platform.maintenance"],
            },
            {
              key: "platform.maintenance_includes_portfolios",
              label: "إيقاف معارض العملاء أيضًا",
              hint: "عند تفعيله تتوقف صفحات العملاء العامة كذلك. إن أوقفته تبقى معارض العملاء متاحة لزوارهم أثناء الصيانة.",
              type: "boolean",
              value: settings["platform.maintenance_includes_portfolios"],
            },
            {
              key: "platform.maintenance_message",
              label: "رسالة الصيانة",
              type: "textarea",
              value: settings["platform.maintenance_message"],
            },
            {
              key: "platform.signups_open",
              label: "التسجيل مفتوح للجميع",
              hint: "عند إيقافه لا يمكن إنشاء حسابات جديدة إلا بدعوة.",
              type: "boolean",
              value: settings["platform.signups_open"],
            },
            {
              key: "platform.invite_only",
              label: "التسجيل بدعوة فقط",
              hint: "يتطلب رمز دعوة صالحًا عند إنشاء أي حساب جديد.",
              type: "boolean",
              value: settings["platform.invite_only"],
            },
          ]}
        />

        <SettingsGroup
          title="الميزات"
          description="أطفئ ميزة مؤقتًا دون تعديل الكود."
          fields={[
            { key: "features.google_signin", label: "إظهار الدخول عبر جوجل", hint: googleConfigured() ? "مضبوط على الخادم." : "غير مضبوط على الخادم — الزر مخفي بأي حال.", type: "boolean", value: settings["features.google_signin"] },
            { key: "features.reports", label: "استقبال بلاغات الزوار", type: "boolean", value: settings["features.reports"] },
            { key: "features.support", label: "تذاكر الدعم للعملاء", type: "boolean", value: settings["features.support"] },
            { key: "features.public_showcase", label: "عرض المعارض في الصفحة الرئيسية", type: "boolean", value: settings["features.public_showcase"] },
          ]}
        />

        <SettingsGroup
          title="الهوية"
          fields={[
            { key: "brand.name_ar", label: "الاسم بالعربية", type: "text", value: settings["brand.name_ar"] },
            { key: "brand.name_en", label: "الاسم بالإنجليزية", type: "text", value: settings["brand.name_en"] },
            { key: "brand.tagline_ar", label: "الوصف بالعربية", type: "text", value: settings["brand.tagline_ar"] },
            { key: "brand.tagline_en", label: "الوصف بالإنجليزية", type: "text", value: settings["brand.tagline_en"] },
            { key: "brand.support_email", label: "بريد الدعم", type: "text", value: settings["brand.support_email"] },
          ]}
        />

        <BrandAssets slots={assetSlots} />

        <SettingsGroup
          title="الدعم"
          columns={1}
          fields={[
            { key: "support.hours", label: "أوقات العمل", type: "text", value: settings["support.hours"] },
            { key: "support.intro", label: "نص تعريفي في نموذج التذكرة", type: "textarea", value: settings["support.intro"] },
          ]}
        />

        <SettingsGroup
          title="القواعد والسياسات"
          columns={1}
          description="تظهر للعملاء والزوار عند الإبلاغ عن معرض."
          fields={[
            { key: "rules.portfolio", label: "قواعد النشر", type: "textarea", value: settings["rules.portfolio"] },
            { key: "policy.terms", label: "شروط الاستخدام", type: "textarea", value: settings["policy.terms"] },
            { key: "policy.privacy", label: "سياسة الخصوصية", type: "textarea", value: settings["policy.privacy"] },
          ]}
        />

        <SectionCard
          title="فريق المنصة"
          description="حسابات الإدارة والدعم. الدعم لا يصل إلى الفوترة أو الدعوات أو الإعدادات أو سجل التدقيق."
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
                  {ROLE_LABEL[member.role]}
                </Badge>
                <span className="hidden text-[11px] text-mist-600 sm:block">
                  انضم {formatDate(member.created_at)}
                </span>
                <StaffRoleControl
                  userId={member.id}
                  role={member.role}
                  isSelf={member.id === me.id}
                />
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="حساب فريق جديد">
          <CreateStaffForm />
        </SectionCard>

        <SectionCard title="إعدادات الخادم" description="تُضبط بمتغيرات البيئة، وليست قابلة للتعديل من هنا.">
          <ul className="divide-y divide-white/6 text-[13px]">
            <li className="flex items-center justify-between gap-3 px-5 py-3">
              <span>الدخول عبر جوجل</span>
              <Badge tone={googleConfigured() ? "good" : "neutral"}>
                {googleConfigured() ? "مضبوط" : "غير مضبوط"}
              </Badge>
            </li>
            <li className="flex items-center justify-between gap-3 px-5 py-3">
              <span>مزوّد الدفع</span>
              <Badge tone={billingConfigured() ? "good" : "warn"}>
                {billingConfigured() ? "مضبوط" : "غير مضبوط"}
              </Badge>
            </li>
            <li className="flex items-center justify-between gap-3 px-5 py-3">
              <span>مفتاح توقيع الجلسات</span>
              <Badge tone={process.env.AUTH_SECRET ? "good" : "warn"}>
                {process.env.AUTH_SECRET ? "مضبوط" : "يستخدم المفتاح الافتراضي"}
              </Badge>
            </li>
          </ul>
          <p className="border-t border-white/8 px-5 py-3 text-[11.5px] leading-relaxed text-mist-500">
            لا تُعرض أي مفاتيح أو أسرار هنا — تظهر حالة الضبط فقط.
          </p>
        </SectionCard>
      </div>
    </>
  );
}
