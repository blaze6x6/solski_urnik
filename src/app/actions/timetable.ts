"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { lessonCancellations, subjects, timeSlots, timetableEntries } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getOwnedChild } from "@/lib/data";
import { notifyScope } from "@/lib/notifications";
import { DNEVI, formatDayMonthSI } from "@/lib/time";
import { slotTitle } from "@/lib/week";

/** Nastavi ali počisti predmet v celici urnika. */
export async function setEntryAction(input: {
  childId: number;
  weekday: number;
  slotId: number;
  subjectId: number | null;
}): Promise<void> {
  const user = await requireUser();
  const child = await getOwnedChild(user.scope, input.childId);
  if (!child) return;

  let subjectName: string | null = null;
  if (input.subjectId !== null) {
    const subj = await db
      .select({ id: subjects.id, name: subjects.name })
      .from(subjects)
      .where(and(eq(subjects.id, input.subjectId), eq(subjects.userId, user.scope)))
      .limit(1);
    if (!subj[0]) return;
    subjectName = subj[0].name;
  }

  if (input.subjectId === null) {
    await db
      .delete(timetableEntries)
      .where(
        and(
          eq(timetableEntries.childId, input.childId),
          eq(timetableEntries.weekday, input.weekday),
          eq(timetableEntries.slotId, input.slotId),
        ),
      );
  } else {
    const existing = await db
      .select({ id: timetableEntries.id })
      .from(timetableEntries)
      .where(
        and(
          eq(timetableEntries.childId, input.childId),
          eq(timetableEntries.weekday, input.weekday),
          eq(timetableEntries.slotId, input.slotId),
        ),
      )
      .limit(1);
    if (existing[0]) {
      await db
        .update(timetableEntries)
        .set({ subjectId: input.subjectId })
        .where(eq(timetableEntries.id, existing[0].id));
    } else {
      await db.insert(timetableEntries).values({
        childId: input.childId,
        weekday: input.weekday,
        slotId: input.slotId,
        subjectId: input.subjectId,
      });
    }
  }
  const slotRows = await db
    .select()
    .from(timeSlots)
    .where(and(eq(timeSlots.id, input.slotId), eq(timeSlots.childId, input.childId)))
    .limit(1);
  const day = DNEVI[input.weekday] ?? "";
  const where = `${child.name}, ${day} · ${slotRows[0] ? slotTitle(slotRows[0]) : "ura"}`;
  await notifyScope(
    user,
    "timetable",
    subjectName ? "updated" : "deleted",
    subjectName ? `Urnik (${where}): ${subjectName}` : `Urnik (${where}): predmet odstranjen`,
  );
  revalidatePath("/", "layout");
}

/** Označi, da ura (predmet) na določen datum odpade — ali to prekliče. */
export async function setLessonCancelledAction(input: {
  childId: number;
  slotId: number;
  /** datum (YYYY-MM-DD) */
  date: string;
  cancelled: boolean;
}): Promise<void> {
  const user = await requireUser();
  const date = String(input.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const child = await getOwnedChild(user.scope, Number(input.childId));
  if (!child) return;
  const slot = await db
    .select()
    .from(timeSlots)
    .where(and(eq(timeSlots.id, Number(input.slotId)), eq(timeSlots.childId, child.id)))
    .limit(1);
  if (!slot[0]) return;

  if (input.cancelled) {
    await db
      .insert(lessonCancellations)
      .values({ childId: child.id, slotId: slot[0].id, date })
      .onConflictDoNothing();
  } else {
    await db
      .delete(lessonCancellations)
      .where(
        and(
          eq(lessonCancellations.childId, child.id),
          eq(lessonCancellations.slotId, slot[0].id),
          eq(lessonCancellations.date, date),
        ),
      );
  }
  const where = `${child.name}, ${formatDayMonthSI(date)} · ${slotTitle(slot[0])}`;
  await notifyScope(
    user,
    "timetable",
    "updated",
    input.cancelled ? `Ura odpade (${where})` : `Ura je spet na sporedu (${where})`,
  );
  revalidatePath("/", "layout");
}
