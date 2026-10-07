"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { MODE_COOKIE, THEME_COOKIE, isMode, isTheme } from "@/lib/themes";

/** Shrani izbrano barvno temo za prijavljenega uporabnika (baza + piškotek). */
export async function setThemeAction(theme: string): Promise<void> {
  const user = await requireUser();
  if (!isTheme(theme)) return;
  await db.update(users).set({ theme }).where(eq(users.id, user.id));
  (await cookies()).set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}

/** Shrani način videza (svetlo / temno / samodejno) za prijavljenega uporabnika. */
export async function setModeAction(mode: string): Promise<void> {
  const user = await requireUser();
  if (!isMode(mode)) return;
  await db.update(users).set({ mode }).where(eq(users.id, user.id));
  (await cookies()).set(MODE_COOKIE, mode, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
