"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { children, sessions, timeSlots, users } from "@/db/schema";
import { hashPassword, requireUser } from "@/lib/auth";
import { isMaskedView } from "@/lib/privacy";
import { notifyScope } from "@/lib/notifications";
import { childPermsFromForm } from "@/lib/child-permissions";

function refresh() {
  revalidatePath("/", "layout");
}

/** Privzete vrstice urnika za novega otroka (predura je skrita). */
const DEFAULT_SLOTS: Array<{
  period: number;
  label: string;
  kind: "lesson" | "break";
  start: string;
  end: string;
  show?: boolean;
}> = [
  { period: 0, label: "Predura", kind: "lesson", start: "06:20", end: "07:05", show: false },
  { period: 1, label: "1. ura", kind: "lesson", start: "07:10", end: "07:55" },
  { period: 2, label: "2. ura", kind: "lesson", start: "08:00", end: "08:45" },
  { period: 3, label: "3. ura", kind: "lesson", start: "08:55", end: "09:40" },
  { period: 4, label: "Malica", kind: "break", start: "09:40", end: "10:00" },
  { period: 5, label: "4. ura", kind: "lesson", start: "10:00", end: "10:45" },
  { period: 6, label: "5. ura", kind: "lesson", start: "10:50", end: "11:35" },
  { period: 7, label: "6. ura", kind: "lesson", start: "11:40", end: "12:25" },
  { period: 8, label: "Kosilo", kind: "break", start: "12:25", end: "12:55" },
  { period: 9, label: "7. ura", kind: "lesson", start: "12:55", end: "13:40" },
  { period: 10, label: "8. ura", kind: "lesson", start: "13:45", end: "14:30" },
];

export async function saveChildAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0) || null;
  const name = String(formData.get("name") ?? "").trim();
  const className = String(formData.get("className") ?? "").trim();
  const school = String(formData.get("school") ?? "").trim();
  const color = String(formData.get("color") ?? "#1f4a38");
  if (!name) return;

  // neobvezna polja
  const field = (key: string, max = 200) => String(formData.get(key) ?? "").trim().slice(0, max);
  const details = {
    address: field("address"),
    postalCode: field("postalCode", 20),
    city: field("city", 100),
    emso: field("emso", 13).replace(/\s+/g, ""),
    taxNumber: field("taxNumber", 8).replace(/\s+/g, "").replace(/^SI/i, ""),
    phone: field("phone", 40),
    email: field("email", 200),
    extraEmails: "",
  };
  // dodatni e-poštni naslovi: ločeni z vrstico, vejico ali podpičjem; neveljavni, podvojeni in primarni se izpustijo
  details.extraEmails = Array.from(
    new Set(
      String(formData.get("extraEmails") ?? "")
        .split(/[\n,;]+/)
        .map((e) => e.trim())
        .filter((e) => EMAIL_RE.test(e) && e.toLowerCase() !== details.email.toLowerCase()),
    ),
  )
    .slice(0, 10)
    .join("\n");

  // oddaljena pomoč (superadmin gleda račun): EMŠO in davčne številke se ne berejo in ne spreminjajo
  const masked = await isMaskedView();
  if (masked) {
    if (id) {
      delete (details as Partial<typeof details>).emso;
      delete (details as Partial<typeof details>).taxNumber;
    } else {
      details.emso = "";
      details.taxNumber = "";
    }
  }

  // neobvezen otroški profil (prijava otroka) ob dodajanju
  const wantsProfile = !id && formData.get("createProfile") !== null;
  const profilePassword = String(formData.get("profilePassword") ?? "");
  if (wantsProfile) {
    const problem = await profileProblem(details.email, profilePassword);
    if (problem) redirect(`/nastavitve?tab=otroci&profilNapaka=${encodeURIComponent(problem)}`);
  }

  if (id) {
    const owned = await db
      .update(children)
      .set({ name, className, school, color, ...details })
      .where(and(eq(children.id, id), eq(children.userId, user.scope)))
      .returning({ id: children.id });
    if (owned[0]) {
      // otroški profil sledi imenu in (če je prost) e-poštnemu naslovu otroka
      const patch: { name: string; email?: string } = { name };
      if (EMAIL_RE.test(details.email)) {
        const clash = await db.select({ id: users.id, childId: users.childId }).from(users).where(eq(users.email, details.email.toLowerCase())).limit(1);
        if (!clash[0] || clash[0].childId === id) patch.email = details.email.toLowerCase();
      }
      await db.update(users).set(patch).where(and(eq(users.childId, id), eq(users.householdId, user.scope)));
    }
    await notifyScope(user, "child", "updated", `Urejen otrok ${name}`);
  } else {
    const [child] = await db
      .insert(children)
      .values({ userId: user.scope, name, className, school, color, ...details })
      .returning();
    await notifyScope(user, "child", "created", `Dodan otrok ${name}`);
    // novemu otroku samodejno dodamo privzet vrstni red ur
    await db.insert(timeSlots).values(
      DEFAULT_SLOTS.map((d) => ({
        childId: child.id,
        period: d.period,
        label: d.label,
        kind: d.kind,
        start: d.start,
        end: d.end,
        showInTimetable: d.show ?? true,
      })),
    );
    if (wantsProfile) {
      await createProfileFor(user.scope, child.id, name, details.email, profilePassword, JSON.stringify(childPermsFromForm(formData)));
    }
  }
  refresh();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Opis težave pri ustvarjanju otroškega profila ali null, če je vse v redu. */
async function profileProblem(email: string, password: string): Promise<string | null> {
  if (!EMAIL_RE.test(email)) return "Za otroški profil vnesite veljaven e-poštni naslov otroka.";
  if (password.length < 6) return "Geslo otroškega profila mora imeti vsaj 6 znakov.";
  const clash = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (clash[0]) return "Uporabnik s to e-pošto že obstaja.";
  return null;
}

async function createProfileFor(
  scope: number,
  childId: number,
  name: string,
  email: string,
  password: string,
  permsJson: string,
) {
  await db.insert(users).values({
    name,
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    householdId: scope,
    childId,
    childPerms: permsJson,
    // otrok ne prejema e-pošte, namenjene administratorjem
    notifyEmail: false,
  });
}

export type ProfileState = { error?: string; ok?: string } | undefined;

/** Ustvari otroški profil za že obstoječega otroka (e-pošta otroka + geslo, ki ga določi starš). */
export async function createChildProfileAction(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  const password = String(formData.get("password") ?? "");
  const rows = await db.select().from(children).where(and(eq(children.id, id), eq(children.userId, user.scope))).limit(1);
  const child = rows[0];
  if (!child) return { error: "Otrok ni najden." };
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.childId, id)).limit(1);
  if (existing[0]) return { error: "Profil za tega otroka že obstaja." };
  const problem = await profileProblem(child.email, password);
  if (problem) return { error: problem.startsWith("Za otroški") ? "Najprej vnesite veljavno e-pošto otroka in shranite." : problem };
  await createProfileFor(user.scope, id, child.name, child.email, password, JSON.stringify(childPermsFromForm(formData)));
  await notifyScope(user, "user", "created", `Ustvarjen profil za otroka ${child.name}`);
  refresh();
  return { ok: `Profil je ustvarjen. Prijava: ${child.email}` };
}

/** Starš nastavi, kaj otroški profil vidi in sme. */
export async function saveChildPermissionsAction(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  const updated = await db
    .update(users)
    .set({ childPerms: JSON.stringify(childPermsFromForm(formData)) })
    .where(and(eq(users.childId, id), eq(users.householdId, user.scope)))
    .returning({ id: users.id });
  if (!updated[0]) return { error: "Profil ne obstaja." };
  refresh();
  return { ok: "Pravice so shranjene." };
}

/** Starš določi novo geslo otroškega profila; otrok je odjavljen z vseh naprav. */
export async function setChildProfilePasswordAction(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) return { error: "Geslo mora imeti vsaj 6 znakov." };
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.childId, id), eq(users.householdId, user.scope)))
    .limit(1);
  if (!rows[0]) return { error: "Profil ne obstaja." };
  await db.update(users).set({ passwordHash: hashPassword(password) }).where(eq(users.id, rows[0].id));
  await db.delete(sessions).where(eq(sessions.userId, rows[0].id));
  return { ok: "Geslo je spremenjeno." };
}

export async function deleteChildProfileAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  if (!id) return;
  await db.delete(users).where(and(eq(users.childId, id), eq(users.householdId, user.scope)));
  refresh();
}

export async function deleteChildAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  if (!id) return;
  await db.delete(users).where(and(eq(users.childId, id), eq(users.householdId, user.scope)));
  const gone = await db
    .delete(children)
    .where(and(eq(children.id, id), eq(children.userId, user.scope)))
    .returning({ name: children.name });
  if (gone[0]) await notifyScope(user, "child", "deleted", `Izbrisan otrok ${gone[0].name}`);
  refresh();
}
