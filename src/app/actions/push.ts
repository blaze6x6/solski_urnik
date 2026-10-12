"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { cookies } from "next/headers";
import { PUSH_DEVICE_COOKIE, removeOtherUsersOfEndpoint, sendPushTo } from "@/lib/push";

const VALID = ["reminders", "changes"];
const cleanKinds = (kinds: unknown): string =>
  (Array.isArray(kinds) ? kinds : []).filter((k): k is string => typeof k === "string" && VALID.includes(k)).join(",");

/** Shrani (ali posodobi) naročnino te naprave. */
export async function savePushSubscriptionAction(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  kinds: string[];
  userAgent?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const endpoint = String(input?.endpoint ?? "");
  const p256dh = String(input?.p256dh ?? "");
  const auth = String(input?.auth ?? "");
  if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) return { ok: false, error: "Neveljavna naročnina." };
  const kinds = cleanKinds(input.kinds);

  await removeOtherUsersOfEndpoint(user.id, endpoint);
  const [row] = await db
    .insert(pushSubscriptions)
    .values({ userId: user.id, endpoint, p256dh, auth, kinds, userAgent: String(input.userAgent ?? "").slice(0, 300) })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: user.id, p256dh, auth, kinds },
    })
    .returning({ id: pushSubscriptions.id });
  await setDeviceCookie(row.id);
  revalidatePath("/nastavitve");
  return { ok: true };
}

async function setDeviceCookie(id: number | null): Promise<void> {
  const store = await cookies();
  if (id === null) store.delete(PUSH_DEVICE_COOKIE);
  else store.set(PUSH_DEVICE_COOKIE, String(id), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
}

/** Že naročena naprava si zapomni svoj id (za izključitev lastnih sprememb). */
export async function markPushDeviceAction(endpoint: string): Promise<void> {
  const user = await requireUser();
  const rows = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, String(endpoint)), eq(pushSubscriptions.userId, user.id)))
    .limit(1);
  await setDeviceCookie(rows[0]?.id ?? null);
}

export async function updatePushKindsAction(input: { endpoint: string; kinds: string[] }): Promise<void> {
  const user = await requireUser();
  await db
    .update(pushSubscriptions)
    .set({ kinds: cleanKinds(input.kinds) })
    .where(and(eq(pushSubscriptions.endpoint, String(input.endpoint)), eq(pushSubscriptions.userId, user.id)));
  revalidatePath("/nastavitve");
}

export async function removePushSubscriptionAction(endpoint: string): Promise<void> {
  const user = await requireUser();
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, String(endpoint)), eq(pushSubscriptions.userId, user.id)));
  await setDeviceCookie(null);
  revalidatePath("/nastavitve");
}

/** Preizkusno obvestilo na to napravo. */
export async function sendTestPushAction(endpoint: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, String(endpoint)), eq(pushSubscriptions.userId, user.id)))
    .limit(1);
  if (!rows[0]) return { ok: false, error: "Naprava ni naročena. Vklopite obvestila znova." };
  const r = await sendPushTo(rows[0], {
    title: "Šolski urnik",
    body: "Preizkusno obvestilo — push obvestila delujejo.",
    url: "/nastavitve?tab=naprava",
    tag: "test",
  });
  if (r === "ok") return { ok: true };
  if (r === "gone") return { ok: false, error: "Naročnina ni več veljavna. Izklopite in ponovno vklopite obvestila." };
  return { ok: false, error: "Pošiljanje ni uspelo (glejte dnevnik strežnika)." };
}
