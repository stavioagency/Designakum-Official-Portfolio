"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { PermissionError, requirePermission } from "@/lib/permissions";
import {
  coerceSetting,
  readSettings,
  SETTING_DEFAULTS,
  writeSetting,
  type SettingKey,
} from "@/lib/settings";
import type { ActionState } from "./console";
import { reportError } from "@/lib/observability";

function fail(error: unknown): ActionState {
  if (error instanceof PermissionError) return { error: error.message };
  reportError(error, { area: "settings" });
  return { error: error instanceof Error ? error.message : "تعذّر حفظ الإعدادات" };
}

const KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[];

/**
 * Saves one group of settings. Booleans arrive only when checked, so the form
 * declares which keys it owns and any missing boolean in that group means false.
 */
export async function saveSettingsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("settings.manage");

    const group = String(fd.get("group") ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter((k): k is SettingKey => KEYS.includes(k as SettingKey));

    if (!group.length) return { error: "لا توجد إعدادات لحفظها" };

    const before = readSettings();
    const changed: Record<string, unknown> = {};

    for (const key of group) {
      const isBoolean = typeof SETTING_DEFAULTS[key] === "boolean";
      const raw = fd.get(key);
      if (raw === null && !isBoolean) continue;

      const value = coerceSetting(key, isBoolean ? (raw === null ? "0" : "1") : String(raw));
      if (value !== before[key]) {
        writeSetting(key, value, actor.id);
        changed[key] = value;
      }
    }

    if (!Object.keys(changed).length) return { ok: "لا تغييرات" };

    audit({
      actor,
      action: "settings.updated",
      targetType: "settings",
      targetId: group.join(","),
      before: Object.fromEntries(Object.keys(changed).map((k) => [k, before[k as SettingKey]])),
      after: changed,
    });

    // Prices, limits and feature flags are read on nearly every page.
    revalidatePath("/", "layout");
    return { ok: "تم حفظ الإعدادات" };
  } catch (error) {
    return fail(error);
  }
}
