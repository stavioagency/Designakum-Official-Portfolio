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
              /*
                Stacked on a phone, one row from `sm` up.
                An email address is a single unbreakable word, and in a flex
                track that may shrink below its own content it simply ran out
                of its box and under the status badge beside it.
              */
              <li
                key={domain.id}
                className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:flex-wrap sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p dir="ltr" className="break-words text-[14px] font-semibold">{domain.hostname}</p>
                  {/* Each fact its own item, so the line breaks between them
                      rather than through the middle of an address. */}
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-mist-500">
                    <span dir="ltr" className="break-all">{domain.email}</span>
                    <span aria-hidden>·</span>
                    <span dir="ltr">/p/{domain.slug}</span>
                    <span aria-hidden>·</span>
                    <span>{formatDate(domain.created_at, locale)}</span>
                  </div>
                  {domain.last_error && (
                    <p className="mt-1 break-words text-[12px] text-rose-300">{domain.last_error}</p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  <Badge tone={TONE[domain.status]}>{t[domain.status]}</Badge>

                  <Link
                    href={`/p/${domain.slug}`}
                    className="btn btn-ghost !py-2 !text-[12.5px]"
                  >
                    {t.openPage}
                  </Link>
                </div>
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
