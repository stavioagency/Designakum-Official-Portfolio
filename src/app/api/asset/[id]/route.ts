import { openAsset, readAsset } from "@/lib/assets";
import { currentUser } from "@/lib/auth";
import { isStaff } from "@/lib/permissions";
import { reportError } from "@/lib/observability";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const asset = await readAsset(id);
  if (!asset) return new Response("Not found", { status: 404 });

  const withheld = asset.owner_status === "suspended" || asset.portfolio_suspended === 1;
  if (withheld && !isStaff(await currentUser())) {
    // Staff still need to see the image while reviewing the report about it.
    return new Response("Not found", { status: 404 });
  }

  let opened;
  try {
    opened = await openAsset(asset);
  } catch (error) {
    reportError(error, { area: "asset", assetId: id });
    return new Response("Unavailable", { status: 502 });
  }
  if (!opened) return new Response("Not found", { status: 404 });

  // Deliberately not `immutable`: a suspension has to take effect for people who
  // already loaded the page, and an hour is an acceptable takedown lag.
  const cache = "public, max-age=3600, stale-while-revalidate=86400";

  if (opened.kind === "redirect") {
    return new Response(null, {
      status: 307,
      headers: { Location: opened.url, "Cache-Control": cache },
    });
  }

  return new Response(new Uint8Array(opened.bytes), {
    headers: {
      "Content-Type": asset.mime,
      "Cache-Control": cache,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
    },
  });
}
