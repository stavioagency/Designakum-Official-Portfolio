import { redirect } from "next/navigation";

/** Legacy path kept alive so older shared links keep resolving. */
export default async function LegacyPortfolioPath({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/p/${slug}`);
}
