import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";

export async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value } });
}

export const REG_ENABLED_KEY = "reg_request_enabled";
export const REG_NOTIFY_KEY = "reg_request_notify";

/** Nastavitve »Zahtevaj registracijo« (privzeto izklopljeno; obvestilo na e-pošto privzeto vklopljeno). */
export async function getRegistrationSettings(): Promise<{ enabled: boolean; notify: boolean }> {
  const [enabled, notify] = await Promise.all([getSetting(REG_ENABLED_KEY), getSetting(REG_NOTIFY_KEY)]);
  return { enabled: enabled === "1", notify: notify !== "0" };
}
