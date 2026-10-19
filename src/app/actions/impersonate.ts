"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { IMPERSONATION_MINUTES, SESSION_COOKIE, SUPER_COOKIE, requireSuperadmin } from "@/lib/auth";

const cookieBase = { httpOnly: true, sameSite: "lax" as const, path: "/" };

/** Superadmin odpre aplikacijo »kot« izbrani uporabnik (seja velja 2 uri). */
export async function startImpersonationAction(formData: FormData): Promise<void> {
  const me = await requireSuperadmin();
  const id = Number(formData.get("id") ?? 0);
  if (!id || id === me.id) return;

  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const target = rows[0];
  // drugih superadminov ne posnemamo; že odprta »kot« seja ne sme začeti nove
  if (!target || target.isSuperadmin) return;

  const store = await cookies();
  const own = store.get(SESSION_COOKIE)?.value;
  if (!own) return;
  const ownRow = await db
    .select({ impersonatorId: sessions.impersonatorId })
    .from(sessions)
    .where(eq(sessions.id, own))
    .limit(1);
  if (ownRow[0]?.impersonatorId) return;

  const token = randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + IMPERSONATION_MINUTES * 60_000);
  await db.insert(sessions).values({ id: token, userId: target.id, expiresAt, impersonatorId: me.id });
  console.log(`[superadmin] ${me.email} (id ${me.id}) je odprl račun ${target.email} (id ${target.id})`);

  // izvirno sejo si zapomnimo, da se je mogoče vrniti
  store.set(SUPER_COOKIE, own, { ...cookieBase, expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });
  store.set(SESSION_COOKIE, token, { ...cookieBase, expires: expiresAt });
  redirect("/");
}

/** Konec ogleda: zbriše začasno sejo in vrne superadmina v njegov račun. */
export async function stopImpersonationAction(): Promise<void> {
  const store = await cookies();
  const current = store.get(SESSION_COOKIE)?.value;
  const original = store.get(SUPER_COOKIE)?.value;

  if (current) {
    // briše se samo seja, ki je res »kot« seja
    const row = await db.select().from(sessions).where(eq(sessions.id, current)).limit(1);
    if (row[0]?.impersonatorId) await db.delete(sessions).where(eq(sessions.id, current));
  }

  let restored = false;
  if (original) {
    const ok = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.id, original), gt(sessions.expiresAt, new Date())))
      .limit(1);
    if (ok[0]) {
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      store.set(SESSION_COOKIE, original, { ...cookieBase, expires });
      restored = true;
    }
  }
  store.delete(SUPER_COOKIE);
  if (!restored) store.delete(SESSION_COOKIE);
  redirect(restored ? "/nastavitve?tab=superadmin" : "/login");
}
