import { readAsset } from "@/lib/assets";
import { currentUser } from "@/lib/auth";
import { isStaff } from "@/lib/permissions";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const asset = readAsset(id);
  if (!asset) return new Response("Not found", { status: 404 });

  const withheld = asset.owner_status === "suspended" || asset.portfolio_suspended === 1;
  if (withheld && !isStaff(await currentUser())) {
    // Staff still need to see the image while reviewing the report about it.
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(asset.bytes), {
    headers: {
      "Content-Type": asset.mime,
      // Deliberately not `immutable`: a suspension has to take effect for people
      // who already loaded the page, and an hour is an acceptable takedown lag.
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
    },
  });
}
