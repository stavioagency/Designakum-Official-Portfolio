import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortfolioPage, portfolioMetadata } from "@/app/p/[slug]/render";
import { portfolioIdForHost } from "@/lib/domains";
import { get } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ host: string }> };

/**
 * A customer's own domain.
 *
 * Nothing links here — the middleware rewrites to it when a request arrives on a
 * hostname the platform does not own itself. Only domains that finished
 * verification resolve, so a CNAME pointed at us by someone who never proved
 * they control the name reaches a 404 rather than someone else's portfolio.
 */
async function slugForHost(host: string): Promise<string | null> {
  const portfolioId = await portfolioIdForHost(decodeURIComponent(host));
  if (!portfolioId) return null;

  const row = await get<{ slug: string }>(
    "SELECT slug FROM portfolios WHERE id = ?",
    portfolioId,
  );
  return row?.slug ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = await slugForHost((await params).host);
  return slug ? await portfolioMetadata(slug) : { title: "404" };
}

export default async function CustomDomainPage({ params }: Props) {
  const slug = await slugForHost((await params).host);
  if (!slug) notFound();

  return <PortfolioPage slug={slug} />;
}
