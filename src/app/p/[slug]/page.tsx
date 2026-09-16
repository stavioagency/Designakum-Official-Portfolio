import type { Metadata } from "next";
import { PortfolioPage, portfolioMetadata } from "./render";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return await portfolioMetadata((await params).slug);
}

export default async function PublicPortfolioPage({ params }: Props) {
  return <PortfolioPage slug={(await params).slug} />;
}
