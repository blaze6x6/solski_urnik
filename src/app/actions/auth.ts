"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MODE_COOKIE, THEME_COOKIE } from "@/lib/themes";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
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
