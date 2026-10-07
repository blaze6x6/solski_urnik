"use server";

import { revalidatePath } from "next/cache";
import { and, eq, desc, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { schoolBreaks, schoolYears, timeSlots, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getOwnedChild } from "@/lib/data";
import { notifyScope } from "@/lib/notifications";

function refresh() {
  revalidatePath("/", "layout");
}

// --- Šolska leta ------------------------------------------------------------

export async function saveSchoolYearAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0) || null;
  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  if (!name || !startDate || !endDate || endDate < startDate) return;

  if (id) {
    await db
      .update(schoolYears)
      .set({ name, startDate, endDate })
      .where(and(eq(schoolYears.id, id), eq(schoolYears.userId, user.scope)));
    await notifyScope(user, "year", "updated", `Urejeno šolsko leto ${name}`);
  } else {
    await db.insert(schoolYears).values({ userId: user.scope, name, startDate, endDate, isActive: false });
    await notifyScope(user, "year", "created", `Dodano šolsko leto ${name}`);
  }
  refresh();
}

export async function activateSchoolYearAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  if (!id) return;
  await db.update(schoolYears).set({ isActive: false }).where(eq(schoolYears.userId, user.scope));
  const activated = await db
    .update(schoolYears)
    .set({ isActive: true })
    .where(and(eq(schoolYears.id, id), eq(schoolYears.userId, user.scope)))
    .returning({ name: schoolYears.name });
  if (activated[0]) await notifyScope(user, "year", "updated", `Aktivno šolsko leto: ${activated[0].name}`);
  refresh();
}

export async function deleteSchoolYearAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  if (!id) return;
  const goneYear = await db
    .delete(schoolYears)
    .where(and(eq(schoolYears.id, id), eq(schoolYears.userId, user.scope)))
    .returning({ name: schoolYears.name });
  if (goneYear[0]) await notifyScope(user, "year", "deleted", `Izbrisano šolsko leto ${goneYear[0].name}`);
  // če je bilo aktivno leto izbrisano, aktiviraj najnovejše preostalo
  const remaining = await db
    .select()
    .from(schoolYears)
    .where(eq(schoolYears.userId, user.scope))
    .orderBy(desc(schoolYears.startDate));
  if (remaining.length > 0 && !remaining.some((y) => y.isActive)) {
    await db.update(schoolYears).set({ isActive: true }).where(eq(schoolYears.id, remaining[0].id));
  }
  refresh();
}

// --- Počitnice ----------------------------------------------------------------

export async function saveBreakAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0) || null;
  const schoolYearId = Number(formData.get("schoolYearId") ?? 0);
  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");

  const year = await db
    .select({ id: schoolYears.id })
    .from(schoolYears)
    .where(and(eq(schoolYears.id, schoolYearId), eq(schoolYears.userId, user.scope)))
    .limit(1);
  if (!year[0] || !name || !startDate || !endDate || endDate < startDate) return;

  if (id) {
    await db
      .update(schoolBreaks)
      .set({ name, startDate, endDate })
      .where(and(eq(schoolBreaks.id, id), eq(schoolBreaks.schoolYearId, schoolYearId)));
    await notifyScope(user, "year", "updated", `Urejene počitnice »${name}«`);
  } else {
    await db.insert(schoolBreaks).values({ schoolYearId, name, startDate, endDate });
    await notifyScope(user, "year", "created", `Dodane počitnice »${name}«`);
  }
  refresh();
}

export async function deleteBreakAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  const schoolYearId = Number(formData.get("schoolYearId") ?? 0);
  const year = await db
    .select({ id: schoolYears.id })
    .from(schoolYears)
    .where(and(eq(schoolYears.id, schoolYearId), eq(schoolYears.userId, user.scope)))
    .limit(1);
  if (!year[0] || !id) return;
  const goneBreak = await db
    .delete(schoolBreaks)
    .where(and(eq(schoolBreaks.id, id), eq(schoolBreaks.schoolYearId, schoolYearId)))
    .returning({ name: schoolBreaks.name });
  if (goneBreak[0]) await notifyScope(user, "year", "deleted", `Izbrisane počitnice »${goneBreak[0].name}«`);
  refresh();
}

// --- Vrstni red ur --------------------------------------------------------------

export type SlotInput = {
  /** obstoječa vrstica (id) ali nova (null) */
  id: number | null;
  label: string;
  kind: string;
  start: string;
  end: string;
  show: boolean;
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Shrani celoten seznam ur otroka naenkrat: vrstni red, preimenovanja, čase,
 * nove vrstice in izbrisane vrstice (tiste, ki jih v seznamu ni več).
 * Vse poteka v eni transakciji, zato se ob napaki ne spremeni nič.
 */
export async function saveSlotsLayoutAction(input: {
  childId: number;
  slots: SlotInput[];
}): Promise<{ ok: boolean; error?: string; deleted?: number }> {
  const user = await requireUser();
  const childId = Number(input?.childId ?? 0);
  const child = await getOwnedChild(user.scope, childId);
  if (!child) return { ok: false, error: "Otrok ni najden." };

  const raw = Array.isArray(input.slots) ? input.slots : [];
  if (raw.length > 60) return { ok: false, error: "Preveč vrstic (največ 60)." };

  const rows: Array<Required<Omit<SlotInput, "id">> & { id: number | null }> = [];
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    const start = String(r.start ?? "").trim();
    const end = String(r.end ?? "").trim();
    if (!TIME_RE.test(start) || !TIME_RE.test(end)) {
      return { ok: false, error: `Vrstica ${i + 1}: vnesite veljavna časa od in do.` };
    }
    if (end <= start) {
      return { ok: false, error: `Vrstica ${i + 1}: konec mora biti po začetku.` };
    }
    rows.push({
      id: r.id ? Number(r.id) : null,
      label: String(r.label ?? "").trim().slice(0, 40),
      kind: r.kind === "break" ? "break" : "lesson",
      start,
      end,
      show: r.show !== false,
    });
  }

  const existing = await db.select({ id: timeSlots.id }).from(timeSlots).where(eq(timeSlots.childId, childId));
  const existingIds = new Set(existing.map((e) => e.id));
  const kept = new Set<number>();
  for (const r of rows) if (r.id && existingIds.has(r.id)) kept.add(r.id);
  const toDelete = [...existingIds].filter((id) => !kept.has(id));

  try {
    await db.transaction(async (tx) => {
      if (toDelete.length) {
        await tx.delete(timeSlots).where(and(eq(timeSlots.childId, childId), inArray(timeSlots.id, toDelete)));
      }
      // Stolpec »period« ima unikaten indeks (otrok + zaporedje), zato obstoječe vrstice
      // najprej odmaknemo, nato pa vsaki dodelimo novo mesto v seznamu.
      await tx
        .update(timeSlots)
        .set({ period: sql`${timeSlots.period} + 1000000` })
        .where(eq(timeSlots.childId, childId));

      const used = new Set<number>();
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const period = i + 1;
        const values = { period, label: r.label, kind: r.kind, start: r.start, end: r.end, showInTimetable: r.show };
        if (r.id && existingIds.has(r.id) && !used.has(r.id)) {
          used.add(r.id);
          await tx.update(timeSlots).set(values).where(and(eq(timeSlots.id, r.id), eq(timeSlots.childId, childId)));
        } else {
          await tx.insert(timeSlots).values({ childId, ...values });
        }
      }
    });
  } catch (err) {
    console.error("[ure] shranjevanje vrstnega reda ni uspelo:", err);
    return { ok: false, error: "Shranjevanje ni uspelo. Poskusite znova." };
  }

  await notifyScope(
    user,
    "timetable",
    toDelete.length ? "deleted" : "updated",
    toDelete.length
      ? `Spremenjen vrstni red ur (${child.name}), izbrisanih vrstic: ${toDelete.length}`
      : `Spremenjen vrstni red ur (${child.name})`,
  );
  refresh();
  return { ok: true, deleted: toDelete.length };
}

// --- E-poštna obvestila ---------------------------------------------------------

export async function setNotifyEmailAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const notify = formData.get("notify") === "on";
  await db.update(users).set({ notifyEmail: notify }).where(eq(users.id, user.id));
  refresh();
}
