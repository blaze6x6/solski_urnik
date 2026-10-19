"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, count, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { registrationRequests, users } from "@/db/schema";
import { requireSuperadmin } from "@/lib/auth";
import { REG_ENABLED_KEY, REG_NOTIFY_KEY, getRegistrationSettings, setSetting } from "@/lib/app-settings";
import { sendMail, smtpConfigured } from "@/lib/email";
import { appOrigin, deliverInvite, type InviteResult } from "@/lib/invites";
import { escHtml } from "@/lib/text";

export type RequestState = { error?: string; ok?: string } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OK_TEXT =
  "Hvala! Zahteva je poslana. Ko jo pregledamo, boste na e-pošto prejeli povezavo za registracijo.";

async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : h.get("x-real-ip") ?? "").trim().slice(0, 64);
}

/** Javni obrazec »Zahtevaj registracijo« (prijavna stran). */
export async function requestRegistrationAction(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const { enabled, notify } = await getRegistrationSettings();
  if (!enabled) return { error: "Zahteve za registracijo trenutno niso omogočene." };

  // skrito polje: ljudje ga ne vidijo, roboti ga pogosto izpolnijo → tiho se pretvarjamo, da je uspelo
  if (String(formData.get("website") ?? "").trim()) return { ok: OK_TEXT };

  const firstName = String(formData.get("firstName") ?? "").trim().slice(0, 80);
  const lastName = String(formData.get("lastName") ?? "").trim().slice(0, 80);
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  if (!firstName || !lastName) return { error: "Vnesite ime in priimek." };
  if (!EMAIL_RE.test(email)) return { error: "Vnesite veljaven e-poštni naslov." };

  const ip = await clientIp();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  if (ip) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(registrationRequests)
      .where(and(eq(registrationRequests.ip, ip), gt(registrationRequests.createdAt, hourAgo)));
    if (n >= 5) return { error: "Preveč zahtev. Poskusite znova čez nekaj časa." };
  }
  const [{ total }] = await db
    .select({ total: count() })
    .from(registrationRequests)
    .where(and(eq(registrationRequests.status, "pending"), gt(registrationRequests.createdAt, hourAgo)));
  if (total >= 50) return { error: "Preveč zahtev. Poskusite znova čez nekaj časa." };

  // odgovor je vedno enak: ne razkrijemo, ali račun ali zahteva že obstaja
  const existingUser = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existingUser[0]) return { ok: OK_TEXT };
  const existingReq = await db
    .select({ id: registrationRequests.id })
    .from(registrationRequests)
    .where(and(eq(registrationRequests.email, email), eq(registrationRequests.status, "pending")))
    .limit(1);
  if (existingReq[0]) return { ok: OK_TEXT };

  await db.insert(registrationRequests).values({ firstName, lastName, email, ip });
  revalidatePath("/nastavitve");

  if (notify && smtpConfigured()) {
    try {
      const supers = await db.select({ email: users.email }).from(users).where(eq(users.isSuperadmin, true));
      const link = `${await appOrigin()}/nastavitve?tab=superadmin`;
      const html = `<div style="font-family:system-ui,sans-serif;max-width:480px">
        <p>Nova zahteva za registracijo v aplikaciji <strong>Šolski urnik</strong>:</p>
        <p style="margin:12px 0;padding:10px 14px;background:#f3f4f6;border-radius:10px"><strong>${escHtml(firstName)} ${escHtml(lastName)}</strong><br>${escHtml(email)}</p>
        <p><a href="${link}" style="display:inline-block;background:#06a66b;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:600">Odpri zahteve</a></p>
        <p style="color:#6b7280;font-size:13px">Zahtevo lahko pregledate v Nastavitve → Superadmin in pošljete vabilo ali jo zavrnete.</p>
      </div>`;
      for (const s of supers) {
        try {
          await sendMail(s.email, "Nova zahteva za registracijo — Šolski urnik", html);
        } catch (err) {
          console.error("[registracija] obvestilo ni bilo poslano:", err);
        }
      }
    } catch (err) {
      console.error("[registracija] obvestilo ni uspelo:", err);
    }
  }
  return { ok: OK_TEXT };
}

/** Superadmin: vklop/izklop gumba na prijavni strani in obvestila na e-pošto. */
export async function saveRegistrationSettingsAction(formData: FormData): Promise<void> {
  await requireSuperadmin();
  await setSetting(REG_ENABLED_KEY, formData.get("enabled") !== null ? "1" : "0");
  await setSetting(REG_NOTIFY_KEY, formData.get("notify") !== null ? "1" : "0");
  revalidatePath("/nastavitve");
  revalidatePath("/login");
}

/** Superadmin: iz zahteve ustvari vabilo (nova skupina); obrazec za registracijo je vnaprej izpolnjen z imenom. */
export async function inviteFromRequestAction(_prev: InviteResult, formData: FormData): Promise<InviteResult> {
  const me = await requireSuperadmin();
  const id = Number(formData.get("id") ?? 0);
  const rows = await db.select().from(registrationRequests).where(eq(registrationRequests.id, id)).limit(1);
  const req = rows[0];
  if (!req) return { error: "Zahteva ni najdena." };

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, req.email)).limit(1);
  if (existing[0]) return { error: "Uporabnik s to e-pošto že obstaja." };

  const result = await deliverInvite({
    email: req.email,
    name: `${req.firstName} ${req.lastName}`,
    scopeId: null,
    inviter: { id: me.id, name: me.name },
  });
  // vabilo je ustvarjeno tudi, če e-pošta ni šla (povezavo vrnemo za ročno pošiljanje)
  if (result?.ok || result?.link) {
    await db.update(registrationRequests).set({ status: "invited" }).where(eq(registrationRequests.id, id));
  }
  revalidatePath("/nastavitve");
  return result;
}

export async function rejectRequestAction(formData: FormData): Promise<void> {
  await requireSuperadmin();
  const id = Number(formData.get("id") ?? 0);
  if (!id) return;
  await db.update(registrationRequests).set({ status: "rejected" }).where(eq(registrationRequests.id, id));
  revalidatePath("/nastavitve");
}

export async function deleteRequestAction(formData: FormData): Promise<void> {
  await requireSuperadmin();
  const id = Number(formData.get("id") ?? 0);
  if (!id) return;
  await db.delete(registrationRequests).where(eq(registrationRequests.id, id));
  revalidatePath("/nastavitve");
}
