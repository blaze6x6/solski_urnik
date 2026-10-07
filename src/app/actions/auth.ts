"use server";

import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { MODE_COOKIE, THEME_COOKIE } from "@/lib/themes";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { passwordResets, sessions, users } from "@/db/schema";
import { sendMail, smtpConfigured } from "@/lib/email";
import { escHtml } from "@/lib/text";
import {
  createSession,
  destroySession,
  getSessionUser,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";
import { revalidatePath } from "next/cache";

export type AuthState = { error?: string } | undefined;

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Vnesite e-pošto in geslo." };

  await ensureSeed();

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "Napačna e-pošta ali geslo." };
  }
  await createSession(user.id);
  const jar = await cookies();
  const cookieOpts = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };
  jar.set(THEME_COOKIE, user.theme, cookieOpts);
  jar.set(MODE_COOKIE, user.mode, cookieOpts);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function changePasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const user = await getSessionUser();
  if (!user) return { error: "Seja je potekla. Prijavite se znova." };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!verifyPassword(current, user.passwordHash)) return { error: "Trenutno geslo ni pravilno." };
  if (next.length < 6) return { error: "Novo geslo mora imeti vsaj 6 znakov." };
  if (next !== confirm) return { error: "Gesli se ne ujemata." };

  await db.update(users).set({ passwordHash: hashPassword(next) }).where(eq(users.id, user.id));
  revalidatePath("/nastavitve");
  return { error: undefined };
}

// ---------------------------------------------------------------------------
// Pozabljeno geslo
// ---------------------------------------------------------------------------

const RESET_TTL_MIN = 60;
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export type ResetRequestState = { error?: string; ok?: string } | undefined;

async function appOrigin(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Pošlje povezavo za ponastavitev gesla. Odgovor je vedno enak (ne razkrije, ali e-pošta obstaja). */
export async function requestPasswordResetAction(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Vnesite e-pošto." };
  if (!smtpConfigured()) {
    return {
      error:
        "Pošiljanje e-pošte na strežniku ni nastavljeno. Prosite superadministratorja, da vam ponastavi geslo.",
    };
  }

  const generic = {
    ok: "Če račun s to e-pošto obstaja, smo nanj poslali povezavo za ponastavitev gesla (velja 1 uro).",
  };

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user) return generic;

  // zaščita pred zasutjem: največ ena povezava na minuto
  const recent = await db
    .select({ id: passwordResets.id })
    .from(passwordResets)
    .where(and(eq(passwordResets.userId, user.id), gt(passwordResets.createdAt, new Date(Date.now() - 60_000))))
    .limit(1);
  if (recent[0]) return generic;

  const token = randomBytes(32).toString("hex");
  await db.delete(passwordResets).where(eq(passwordResets.userId, user.id));
  await db.insert(passwordResets).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MIN * 60_000),
  });

  const link = `${await appOrigin()}/ponastavi?token=${token}`;
  try {
    await sendMail(
      user.email,
      "Ponastavitev gesla — Šolski urnik",
      `<div style="font-family:system-ui,sans-serif;max-width:480px">
        <p>Pozdravljeni, ${escHtml(user.name)},</p>
        <p>prejeli smo zahtevo za ponastavitev gesla. Povezava velja ${RESET_TTL_MIN} minut:</p>
        <p><a href="${link}" style="display:inline-block;background:#06a66b;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:600">Nastavi novo geslo</a></p>
        <p style="color:#6b7280;font-size:13px">Če zahteve niste poslali vi, tega sporočila preprosto prezrite — geslo ostane nespremenjeno.</p>
      </div>`,
    );
  } catch (err) {
    console.error("[reset] pošiljanje ni uspelo:", err);
    return { error: "Pošiljanje e-pošte ni uspelo. Poskusite znova ali prosite superadministratorja." };
  }
  return generic;
}

/** Nastavi novo geslo z žetonom iz e-pošte. */
export async function resetPasswordWithTokenAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const token = String(formData.get("token") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (next.length < 6) return { error: "Novo geslo mora imeti vsaj 6 znakov." };
  if (next !== confirm) return { error: "Gesli se ne ujemata." };

  const rows = await db
    .select()
    .from(passwordResets)
    .where(and(eq(passwordResets.tokenHash, hashToken(token)), gt(passwordResets.expiresAt, new Date())))
    .limit(1);
  const reset = rows[0];
  if (!reset) return { error: "Povezava je neveljavna ali je potekla. Zahtevajte novo." };

  await db.update(users).set({ passwordHash: hashPassword(next) }).where(eq(users.id, reset.userId));
  await db.delete(passwordResets).where(eq(passwordResets.userId, reset.userId));
  // vse obstoječe seje se zaprejo
  await db.delete(sessions).where(eq(sessions.userId, reset.userId));
  redirect("/login?ponastavljeno=1");
}
