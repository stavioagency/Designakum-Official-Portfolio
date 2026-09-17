"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isCurrency } from "@/lib/currency";
import { CURRENCY_COOKIE } from "@/lib/visitor-currency";

/**
 * Remembers which currency this visitor wants to read prices in.
 *
 * A year, because a person's country rarely changes and being asked again every
 * session is its own small annoyance. Not httpOnly: nothing here is secret, and
 * it is a display preference rather than a credential.
 */
export async function setCurrencyAction(fd: FormData) {
  const code = String(fd.get("currency") ?? "");
  if (!isCurrency(code)) return;

  (await cookies()).set(CURRENCY_COOKIE, code, {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/");
  revalidatePath("/pricing");
  revalidatePath("/dashboard/billing");
}
