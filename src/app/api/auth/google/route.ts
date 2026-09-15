import { redirect } from "next/navigation";
import { beginGoogleAuth, googleConfigured } from "@/lib/google";
import { requestOrigin } from "@/lib/origin";

export async function GET(request: Request) {
  if (!googleConfigured()) {
    return new Response("Google sign-in is not configured on this deployment.", {
      status: 501,
    });
  }

  const origin = await requestOrigin();
  const requested = new URL(request.url).searchParams.get("returnTo") ?? "/dashboard";
  // Only same-site paths, so the state parameter can never become an open redirect.
  const returnTo = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard";

  redirect(beginGoogleAuth(origin, returnTo));
}
