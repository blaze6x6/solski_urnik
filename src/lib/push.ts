// ---------------------------------------------------------------------------
// Web Push (RFC 8030 + VAPID RFC 8292 + šifriranje aes128gcm RFC 8188/8291)
//
// Brez zunanjih knjižnic — samo vgrajeni `node:crypto` in `fetch`.
// VAPID ključi se ob prvi uporabi samodejno ustvarijo in shranijo v bazo
// (tabela app_settings); z okoljskima spremenljivkama VAPID_PUBLIC_KEY in
// VAPID_PRIVATE_KEY jih je mogoče tudi nastaviti ročno.
// ---------------------------------------------------------------------------

import { generateKeyPairSync } from "node:crypto";
import { cookies } from "next/headers";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, pushSubscriptions, users, type PushSubscriptionRow } from "@/db/schema";
import { b64u, buildVapidHeader, encryptPayload, fromB64u } from "@/lib/webpush-crypto";

export type PushKind = "reminders" | "changes";
export const PUSH_KINDS: Array<{ key: PushKind; label: string; hint: string }> = [
  { key: "reminders", label: "Opomniki", hint: "Dogodki, ki se kmalu začnejo, in roki beležk." },
  { key: "changes", label: "Spremembe", hint: "Novi in spremenjeni dogodki, odpadle ure, urnik, avtobusi, ocene in beležke." },
];

export type PushPayload = {
  title: string;
  body: string;
  /** stran, ki se odpre ob tapu na obvestilo */
  url?: string;
  /** enaka oznaka zamenja prejšnje obvestilo */
  tag?: string;
};

// --- VAPID ključi -------------------------------------------------------------

type Vapid = { publicKey: string; privateKey: string };
let cachedVapid: Vapid | null = null;

async function readSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function getVapid(): Promise<Vapid> {
  if (cachedVapid) return cachedVapid;
  const envPub = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPriv = process.env.VAPID_PRIVATE_KEY?.trim();
  if (envPub && envPriv) {
    cachedVapid = { publicKey: envPub, privateKey: envPriv };
    return cachedVapid;
  }
  let pub: string = (await readSetting("vapid_public")) ?? "";
  let priv: string = (await readSetting("vapid_private")) ?? "";
  if (!pub || !priv) {
    const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const pj = publicKey.export({ format: "jwk" });
    const kj = privateKey.export({ format: "jwk" });
    pub = b64u(Buffer.concat([Buffer.from([4]), fromB64u(pj.x as string), fromB64u(pj.y as string)]));
    priv = kj.d as string;
    await db.insert(appSettings).values({ key: "vapid_public", value: pub }).onConflictDoNothing();
    await db.insert(appSettings).values({ key: "vapid_private", value: priv }).onConflictDoNothing();
    // morebitna sočasna ustvaritev: obvelja tista, ki je prva v bazi
    pub = (await readSetting("vapid_public")) ?? pub;
    priv = (await readSetting("vapid_private")) ?? priv;
  }
  const result: Vapid = { publicKey: pub, privateKey: priv };
  cachedVapid = result;
  return result;
}

export async function getVapidPublicKey(): Promise<string> {
  return (await getVapid()).publicKey;
}

async function vapidSubject(): Promise<string> {
  const env = process.env.VAPID_SUBJECT?.trim();
  if (env) return env;
  const app = process.env.APP_URL?.trim();
  if (app && app.startsWith("https://")) return app.replace(/\/+$/, "");
  const first = await db.select({ email: users.email }).from(users).orderBy(asc(users.id)).limit(1);
  return `mailto:${first[0]?.email ?? "admin@localhost.invalid"}`;
}

async function vapidAuthHeader(endpoint: string): Promise<string> {
  const { publicKey, privateKey } = await getVapid();
  return buildVapidHeader(endpoint, publicKey, privateKey, await vapidSubject());
}

// --- pošiljanje ---------------------------------------------------------------

export type PushResult = "ok" | "gone" | "error";

async function sendToSubscription(sub: PushSubscriptionRow, payload: PushPayload): Promise<PushResult> {
  try {
    const body = encryptPayload(Buffer.from(JSON.stringify(payload)), sub.p256dh, sub.auth);
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: await vapidAuthHeader(sub.endpoint),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        "Content-Length": String(body.length),
        TTL: "86400",
        Urgency: "normal",
      },
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404 || res.status === 410) return "gone";
    if (!res.ok) {
      console.warn(`[push] ${res.status} ${res.statusText} za ${new URL(sub.endpoint).host}: ${(await res.text()).slice(0, 200)}`);
      return "error";
    }
    return "ok";
  } catch (err) {
    console.warn("[push] pošiljanje ni uspelo:", err);
    return "error";
  }
}

/** Pošlje obvestilo na eno napravo; neveljavno naročnino odstrani. */
export async function sendPushTo(sub: PushSubscriptionRow, payload: PushPayload): Promise<PushResult> {
  const r = await sendToSubscription(sub, payload);
  if (r === "gone") await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
  return r;
}

/**
 * Pošlje obvestilo vsem napravam članov skupine, ki so vklopile to vrsto.
 * Napake nikoli ne prekinejo klicatelja.
 */
export async function pushToScope(
  scopeId: number,
  kind: PushKind,
  payload: PushPayload,
  /** naprava (id naročnine), ki je spremembo naredila — nanjo ne pošljemo */
  excludeSubscriptionId?: number,
): Promise<number> {
  try {
    const members = await db.select({ id: users.id, householdId: users.householdId }).from(users);
    const ids = members.filter((u) => (u.householdId ?? u.id) === scopeId).map((u) => u.id);
    if (ids.length === 0) return 0;
    const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, ids));
    const targets = subs.filter((s) => s.kinds.split(",").includes(kind) && s.id !== excludeSubscriptionId);
    let sent = 0;
    await Promise.all(
      targets.map(async (s) => {
        if ((await sendPushTo(s, payload)) === "ok") sent++;
      }),
    );
    console.log(`[push] ${kind}: naprav v skupini ${subs.length}, ciljnih ${targets.length}, poslanih ${sent}`);
    return sent;
  } catch (err) {
    console.warn("[push] napaka:", err);
    return 0;
  }
}

export async function listSubscriptions(userId: number) {
  return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)).orderBy(asc(pushSubscriptions.id));
}

export async function removeOtherUsersOfEndpoint(userId: number, endpoint: string) {
  // ista naprava se je prijavila z drugim računom: naročnina preide na novega
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), ne(pushSubscriptions.userId, userId)));
}

// --- »ta naprava« --------------------------------------------------------------
// Naprava, ki je naredila spremembo, ne dobi push obvestila zanjo. Naprava si
// ob vklopu zapiše piškotek z id-jem svoje naročnine.

export const PUSH_DEVICE_COOKIE = "urnik_push_naprava";

export async function currentDeviceId(): Promise<number | undefined> {
  try {
    const v = (await cookies()).get(PUSH_DEVICE_COOKIE)?.value;
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  } catch {
    return undefined; // ni zahtevka (npr. opomniki po urniku)
  }
}
