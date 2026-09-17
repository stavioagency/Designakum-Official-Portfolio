import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { canPublish } from "@/lib/billing";
import { getPortfolioForUser } from "@/lib/portfolios";
import { domainsFor, platformAddresses, TXT_RECORD } from "@/lib/domains";
import { currentLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";
import { DomainsPanel } from "@/components/domains-panel";
import {
  addDomainAction,
  checkDomainAction,
  platformTarget,
  removeDomainAction,
} from "@/app/actions/domains";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: dict(await currentLocale()).domains.title,
    robots: { index: false, follow: false },
  };
}

export default async function DomainPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const portfolio = await getPortfolioForUser(user.id);
  if (!portfolio) redirect("/console");

  const copy = dict(await currentLocale()).domains;
  const [domains, target, paid] = await Promise.all([
    domainsFor(portfolio.id),
    platformTarget(),
    canPublish(user),
  ]);

  // Looked up rather than written down, so a customer pointing a root domain
  // here is given the address the platform actually answers on today.
  const addresses = await platformAddresses(target);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-7 sm:px-6 lg:py-10">
      <h1 className="text-[26px] font-bold">{copy.title}</h1>
      <p className="mb-7 mt-1 text-[13.5px] text-mist-400">{copy.sub}</p>

      <div className="card p-6 sm:p-7">
        <DomainsPanel
          domains={domains}
          copy={copy}
          target={target}
          addresses={addresses}
          txtRecord={TXT_RECORD}
          paid={paid}
          actions={{
            add: addDomainAction,
            check: checkDomainAction,
            remove: removeDomainAction,
          }}
        />
      </div>
    </main>
  );
}
