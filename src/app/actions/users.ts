"use server";

import { revalidatePath } from "next/cache";
import { randomInt } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { events, notifications, sessions, userEmails, users } from "@/db/schema";
import { hashPassword, householdUsers, requireSuperadmin, requireUser } from "@/lib/auth";
import { notifyScope } from "@/lib/notifications";

export type UserFormState = { error?: string; ok?: string } | undefined;

function refresh() {
  revalidatePath("/", "layout");
}

/** Dodaj novega administratorja v isto skupino (deli vse podatke). */
export async function createUserAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const me = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const shared = formData.get("shared") !== null;

  if (!name || !email) return { error: "Vnesite ime in e-pošto." };
  if (password.length < 6) return { error: "Geslo mora imeti vsaj 6 znakov." };

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) return { error: "Uporabnik s to e-pošto že obstaja." };

  await db.insert(users).values({
    name,
    email,
    passwordHash: hashPassword(password),
    // skupni dostop do istih otrok/urnikov, sicer samostojna skupina (householdId ostane null)
    householdId: shared ? me.scope : null,
  });
  if (shared) await notifyScope(me, "user", "created", `Dodan administrator ${name}`);

  refresh();
  return { ok: `Uporabnik ${name} je dodan.` };
}

/** Preimenuj uporabnika oz. spremeni njegovo e-pošto (znotraj iste skupine). */
export async function updateUserAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const me = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!id || !name || !email) return { error: "Ime in e-pošta sta obvezna." };

  const members = await householdUsers(me.scope);
  if (!members.some((u) => u.id === id)) return { error: "Uporabnik ni iz vaše skupine." };

  const clash = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (clash[0] && clash[0].id !== id) return { error: "E-pošta je že v uporabi." };

  await db.update(users).set({ name, email }).where(eq(users.id, id));
  refresh();
  return { ok: "Shranjeno." };
}

/** Ponastavi geslo drugega uporabnika v skupini. */
export async function resetUserPasswordAction(formData: FormData): Promise<void> {
  const me = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  const password = String(formData.get("password") ?? "");
  if (!id || password.length < 6) return;

  const members = await householdUsers(me.scope);
  if (!members.some((u) => u.id === id)) return;

  await db.update(users).set({ passwordHash: hashPassword(password) }).where(eq(users.id, id));
  refresh();
}

/** Odstrani administratorja (ne sebe in ne zadnjega v skupini). */
export async function deleteUserAction(formData: FormData): Promise<void> {
  const me = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  if (!id || id === me.id) return;

  const members = await householdUsers(me.scope);
  if (members.length <= 1 || !members.some((u) => u.id === id)) return;

  // lastnika skupine (scope) ne brišemo, ker so nanj vezani otroci in predmeti
  if (id === me.scope) return;

  const target = members.find((u) => u.id === id);
  await db.delete(users).where(eq(users.id, id));
  if (target) await notifyScope(me, "user", "deleted", `Odstranjen administrator ${target.name}`);
  refresh();
}

/** Vklop/izklop e-poštnih obvestil za posameznega uporabnika. */
export async function toggleUserNotifyAction(formData: FormData): Promise<void> {
  const me = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  const members = await householdUsers(me.scope);
  const target = members.find((u) => u.id === id);
  if (!target) return;
  await db.update(users).set({ notifyEmail: !target.notifyEmail }).where(eq(users.id, id));
  refresh();
}

// ---------------------------------------------------------------------------
// Dodatni e-poštni naslovi
// ---------------------------------------------------------------------------

/** Dodaj nov e-poštni naslov uporabniku iz iste skupine. */
export async function addUserEmailAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const me = await requireUser();
  const userId = Number(formData.get("userId") ?? 0);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const label = String(formData.get("label") ?? "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Vnesite veljaven e-poštni naslov." };
  }

  const members = await householdUsers(me.scope);
  if (!members.some((u) => u.id === userId)) return { error: "Uporabnik ni iz vaše skupine." };

  const existing = await db
    .select({ id: userEmails.id })
    .from(userEmails)
    .where(and(eq(userEmails.userId, userId), eq(userEmails.email, email)))
    .limit(1);
  if (existing[0]) return { error: "Ta naslov je pri uporabniku že dodan." };

  await db.insert(userEmails).values({
    userId,
    email,
    label,
    notifyNewEvents: formData.get("notifyNewEvents") !== null,
    notifyEventChanges: formData.get("notifyEventChanges") !== null,
    notifyReminders: formData.get("notifyReminders") !== null,
    notifyDigest: formData.get("notifyDigest") !== null,
  });

  refresh();
  return { ok: `Naslov ${email} je dodan.` };
}

/** Preklopi posamezno vrsto obvestila za dodatni naslov. */
export async function toggleEmailNotifyAction(formData: FormData): Promise<void> {
  const me = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  const field = String(formData.get("field") ?? "");
  const allowed = ["notifyNewEvents", "notifyEventChanges", "notifyReminders", "notifyDigest"] as const;
  type Field = (typeof allowed)[number];
  if (!id || !allowed.includes(field as Field)) return;

  const rows = await db.select().from(userEmails).where(eq(userEmails.id, id)).limit(1);
  const row = rows[0];
  if (!row) return;

  const members = await householdUsers(me.scope);
  if (!members.some((u) => u.id === row.userId)) return;

  const key = field as Field;
  await db.update(userEmails).set({ [key]: !row[key] }).where(eq(userEmails.id, id));
  refresh();
}

/** Odstrani dodatni e-poštni naslov. */
export async function deleteUserEmailAction(formData: FormData): Promise<void> {
  const me = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  if (!id) return;
  const rows = await db.select().from(userEmails).where(eq(userEmails.id, id)).limit(1);
  const row = rows[0];
  if (!row) return;
  const members = await householdUsers(me.scope);
  if (!members.some((u) => u.id === row.userId)) return;
  await db.delete(userEmails).where(eq(userEmails.id, id));
  refresh();
}

// ---------------------------------------------------------------------------
// Superadministrator
// ---------------------------------------------------------------------------

/**
 * Superadministrator odstrani katerega koli drugega uporabnika.
 * Če je to lastnik skupine (gospodinjstva), se odstrani tudi vsa skupina:
 * njeni člani, otroci, predmeti, urniki in dogodki.
 */
export async function superDeleteUserAction(formData: FormData): Promise<void> {
  const me = await requireSuperadmin();
  const id = Number(formData.get("id") ?? 0);
  if (!id || id === me.id) return;

  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const target = rows[0];
  if (!target) return;

  const isOwner = target.householdId === null;
  if (isOwner) {
    const all = await db.select().from(users);
    const memberIds = all.filter((u) => u.householdId === target.id).map((u) => u.id);
    // sam sebe (in svojo skupino) superadmin ne more pobrisati posredno
    if (memberIds.includes(me.id)) return;

    // dogodki »Vsi otroci« nimajo otroka, zato se ne pobrišejo s kaskado
    await db.delete(events).where(eq(events.scopeId, target.id));
    await db.delete(notifications).where(eq(notifications.scopeId, target.id));
    if (memberIds.length) await db.delete(users).where(inArray(users.id, memberIds));
  }

  // otroci, predmeti, leta, seje in dodatni e-poštni naslovi se izbrišejo s kaskado
  await db.delete(users).where(eq(users.id, target.id));
  refresh();
}

export type TempPasswordState = { error?: string; password?: string; name?: string } | undefined;

// brez znakov, ki se zamenjujejo (0/O, 1/l/I)
const TEMP_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateTempPassword(len = 10): string {
  let out = "";
  for (let i = 0; i < len; i++) out += TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)];
  return out;
}

/**
 * Superadministrator ponastavi geslo katerega koli uporabnika. Obstoječih gesel ni mogoče
 * prebrati (v bazi je samo zgoščena vrednost), zato se ustvari novo začasno geslo,
 * ki se prikaže enkrat. Uporabnik je odjavljen z vseh naprav.
 */
export async function superResetPasswordAction(
  _prev: TempPasswordState,
  formData: FormData,
): Promise<TempPasswordState> {
  await requireSuperadmin();
  const id = Number(formData.get("id") ?? 0);
  if (!id) return { error: "Uporabnik ni najden." };
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const target = rows[0];
  if (!target) return { error: "Uporabnik ni najden." };

  const password = generateTempPassword();
  await db.update(users).set({ passwordHash: hashPassword(password) }).where(eq(users.id, id));
  await db.delete(sessions).where(eq(sessions.userId, id));
  return { password, name: target.name };
}
