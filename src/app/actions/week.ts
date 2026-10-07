"use server";

import { requireUser } from "@/lib/auth";
import { getActiveSchoolYear, getBreaksForYear, getChildren } from "@/lib/data";
import { buildChildWeek } from "@/lib/week";
import type { WeekPayload } from "@/components/timetable-grid";

/**
 * Podatki enega tedna za enega otroka. Uporablja se, kadar se posamezen urnik
 * pomika neodvisno (npr. pri prikazu vseh urnikov hkrati), brez menjave strani.
 */
export async function loadChildWeekAction(input: {
  childId: number;
  weekOffset: number;
}): Promise<WeekPayload | null> {
  const user = await requireUser();
  const childId = Number(input.childId);
  const weekOffset = Math.max(-52, Math.min(52, Math.trunc(Number(input.weekOffset) || 0)));

  const kids = await getChildren(user.scope);
  if (!kids.some((k) => k.id === childId)) return null;

  const year = await getActiveSchoolYear(user.scope);
  const breaks = year ? await getBreaksForYear(year.id) : [];
  const built = await buildChildWeek(childId, weekOffset, breaks, user.scope, year?.endDate ?? null);

  return {
    weekOffset,
    weekLabel: built.weekLabel,
    days: built.days,
    slots: built.slots,
    cells: built.cells,
    eventChips: built.eventChips,
  };
}
