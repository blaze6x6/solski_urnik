"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { subjects, timeSlots, timetableEntries } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getOwnedChild } from "@/lib/data";
import { notifyScope } from "@/lib/notifications";
import { DNEVI } from "@/lib/time";
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
