"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/permissions";
import { resolveError } from "@/lib/error-log";
import { audit } from "@/lib/audit";

export async function resolveErrorAction(fd: FormData) {
  const actor = await requirePermission("settings.manage");
  const fingerprint = String(fd.get("fingerprint") ?? "");
  if (!fingerprint) return;

  await resolveError(fingerprint);
  await audit({
    actor,
    action: "error.resolved",
    targetType: "error",
    targetId: fingerprint,
    targetLabel: fingerprint.slice(0, 12),
  });

  revalidatePath("/console/errors");
}
