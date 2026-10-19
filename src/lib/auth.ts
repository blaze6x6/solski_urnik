import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { moduleAllowed, firstAllowedHref, parseChildPerms, type ChildModule, type ChildPerms } from "@/lib/child-permissions";

export const SESSION_COOKIE = "urnik_seja";
const SESSION_DAYS = 30;

// ---------------------------------------------------------------------------
// Gesla (scrypt, brez dodatnih odvisnosti)
// ---------------------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

// ---------------------------------------------------------------------------
// Seje
// ---------------------------------------------------------------------------

export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ id: token, userId, expiresAt });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, token));
  }
  store.delete(SESSION_COOKIE);
}

/** Piškotek z izvirno sejo superadmina, dokler gleda račun drugega uporabnika. */
export const SUPER_COOKIE = "urnik_seja_super";
export const IMPERSONATION_MINUTES = 120;

/** Če je trenutna seja odprta »kot« drug uporabnik, vrne superadmina, ki jo je odprl. */
export async function getImpersonator(): Promise<{ id: number; name: string } | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ impersonatorId: sessions.impersonatorId })
    .from(sessions)
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const id = rows[0]?.impersonatorId;
  if (!id) return null;
  const sup = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, id)).limit(1);
  return sup[0] ?? null;
}

/** Uporabnik + `scope` = id skupine, ki ji pripadajo skupni podatki. */
export type SessionUser = User & {
  scope: number;
  /** otroški profil: omejene pravice, vidi samo podatke svojega otroka */
  isChild: boolean;
  /** pravice otroškega profila (null = administrator) */
  perms: ChildPerms | null;
};

function withScope(user: User): SessionUser {
  const isChild = user.childId !== null;
  return {
    ...user,
    scope: user.householdId ?? user.id,
    isChild,
    perms: isChild ? parseChildPerms(user.childPerms) : null,
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ? withScope(rows[0].user) : null;
}

/**
 * Vsak prijavljen uporabnik, tudi otroški profil. Uporabi samo tam, kjer otrok sme delovati
 * (pregled, urnik, koledar, beležke, ocene, videz, geslo, push) — in tam ponovno preveri pravice.
 */
export async function requireViewer(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Prijavljen uporabnik, ki sme videti dani del aplikacije. Administrator vedno,
 * otroški profil samo, če mu je stran omogočena (sicer preusmeritev na prvo dovoljeno).
 */
export async function requireModule(module: ChildModule): Promise<SessionUser> {
  const user = await requireViewer();
  if (user.perms && !moduleAllowed(user.perms, module)) redirect(firstAllowedHref(user.perms));
  return user;
}

/**
 * Administrator skupine (ali superadmin). Otroški profili so tu zavrnjeni, zato je
 * vsaka stran in akcija privzeto nedostopna otroku, dokler ni izrecno odprta z requireViewer().
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await requireViewer();
  if (user.isChild) redirect("/");
  return user;
}

/** Samo za superadministratorja; drugi so preusmerjeni na začetno stran. */
export async function requireSuperadmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isSuperadmin) redirect("/");
  return user;
}

/** Vsi uporabniki iste skupine. */
export async function householdUsers(scope: number): Promise<User[]> {
  const rows = await db.select().from(users);
  return rows.filter((u) => (u.householdId ?? u.id) === scope).sort((a, b) => a.id - b.id);
}
