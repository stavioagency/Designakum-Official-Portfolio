import type { Metadata } from "next";
import Link from "next/link";
import { currentLocale } from "@/lib/locale";
import { dict, fill } from "@/lib/i18n";
import { guardPage } from "@/lib/permissions";
import { allDomains } from "@/lib/domains";
import { Badge, EmptyState, PageHeader, SectionCard, formatDate } from "@/components/console/ui";
import { ExternalLink, Globe } from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: dict(await currentLocale()).console.domains.title };
}
export const dynamic = "force-dynamic";

const TONE = {
  active: "good",
  pending: "warn",
  failed: "bad",
} as const;

/**
 * Every customer domain, for the person who has to attach them.
 *
 * The platform records a domain and checks the customer's DNS, and something
 * still has to tell the hosting account to answer for that hostname. That step
 * needs a credential which, on this host, cannot be limited to one project, so
 * it is not one the public web server holds. It runs in CI, or a member of
 * staff does it from here.
 */
export default async function ConsoleDomainsPage() {
  await guardPage("settings.manage");
  const locale = await currentLocale();
  const c = dict(locale).console;
  const t = c.domains;
  const domains = await allDomains();

  // No project slug is knowable from here, and guessing one would produce a
  // link that 404s. The dashboard is one click from the right page.
  const hostSettings = "https://vercel.com/dashboard";

  return (
    <>
      <PageHeader title={t.title} description={t.description} />

      <SectionCard>
        {domains.length === 0 ? (
          <EmptyState icon={<Globe className="h-5 w-5" />} title={t.empty} />
        ) : (
          <ul className="divide-y divide-white/6">
            {domains.map((domain) => (
              <li key={domain.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p dir="ltr" className="text-[14px] font-semibold">{domain.hostname}</p>
                  <p className="mt-0.5 text-[12.5px] text-mist-500">
                    {domain.email} · /p/{domain.slug} · {formatDate(domain.created_at, locale)}
                  </p>
                  {domain.last_error && (
                    <p className="mt-1 text-[12px] text-rose-300">{domain.last_error}</p>
                  )}
                </div>

                <Badge tone={TONE[domain.status]}>{t[domain.status]}</Badge>

                <Link
                  href={`/p/${domain.slug}`}
                  className="btn btn-ghost !py-2 !text-[12.5px]"
                >
                  {t.openPage}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title={t.hostHeading}>
        <p className="px-4 pb-4 text-[13px] leading-relaxed text-mist-400">{t.hostBody}</p>
        <div className="px-4 pb-4">
          <a
            href={hostSettings}
            target="_blank"
            rel="noreferrer noopener"
            className="btn btn-ghost !py-2 !text-[13px]"
          >
            <ExternalLink className="h-4 w-4" />
            {t.hostLink}
          </a>
        </div>
      </SectionCard>
    </>
  );
}
