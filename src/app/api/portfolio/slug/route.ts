import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { slugify } from "@/lib/ids";
import { get } from "@/lib/db";
import { getPortfolioForUser } from "@/lib/portfolios";

export const dynamic = "force-dynamic";

/**
 * Availability for one candidate link, so the customer finds out while typing
 * rather than after submitting. Signed in only: this would otherwise let anyone
 * enumerate which customers exist.
 */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const slug = slugify(new URL(request.url).searchParams.get("slug") ?? "");
  if (!slug) return NextResponse.json({ slug: "", status: "invalid" });

  const mine = await getPortfolioForUser(user.id);
  const clash = await get<{ id: string }>("SELECT id FROM portfolios WHERE slug = ?", slug);

  // Their current link counts as available to them — otherwise confirming the
  // suggestion we generated would report itself as taken.
  const free = !clash || clash.id === mine?.id;
  return NextResponse.json({ slug, status: free ? "available" : "taken" });
}
