import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";

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

/** Uporabnik + `scope` = id skupine, ki ji pripadajo skupni podatki. */
export type SessionUser = User & { scope: number };

function withScope(user: User): SessionUser {
  return { ...user, scope: user.householdId ?? user.id };
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

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
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
