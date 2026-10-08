"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notes, subjects } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getOwnedChild } from "@/lib/data";
import { notifyScope } from "@/lib/notifications";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Nova beležka ali (ob izpolnjenem `id`) urejanje obstoječe. */
export async function saveNoteAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0) || null;
  const childId = Number(formData.get("childId") ?? 0);
  const subjectId = Number(formData.get("subjectId") ?? 0) || null;
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const content = String(formData.get("content") ?? "").trim();
  const noteDate = String(formData.get("noteDate") ?? "");
  const rawDue = String(formData.get("dueDate") ?? "").trim();
  const dueDate = ISO.test(rawDue) ? rawDue : null;
  const rd = Number(formData.get("remindDays") ?? 3);
  const remindDays = Number.isInteger(rd) && rd >= 0 && rd <= 60 ? rd : 3;
  const pinned = formData.get("pinned") === "on";

  const child = await getOwnedChild(user.scope, childId);
  if (!child || !title || !ISO.test(noteDate)) return;

  if (subjectId !== null) {
    const subj = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.id, subjectId), eq(subjects.userId, user.scope)))
      .limit(1);
    if (!subj[0]) return;
  }

  if (id) {
    const prev = await db
      .select({ dueDate: notes.dueDate, remindDays: notes.remindDays })
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.childId, childId)))
      .limit(1);
    if (!prev[0]) return;
    // sprememba roka ali števila dni pred rokom omogoči nov opomnik
    const resetReminder = prev[0].dueDate !== dueDate || prev[0].remindDays !== remindDays;
    await db
      .update(notes)
      .set({
        subjectId,
        title,
        content,
        noteDate,
        pinned,
        dueDate,
        remindDays,
        ...(resetReminder ? { reminderSentFor: null } : {}),
      })
      .where(and(eq(notes.id, id), eq(notes.childId, childId)));
    await notifyScope(user, "note", "updated", `Urejena beležka »${title}« (${child.name})`);
    revalidatePath("/", "layout");
    redirect(`/belezke?otrok=${childId}`);
  }

  await db.insert(notes).values({ childId, subjectId, title, content, noteDate, pinned, dueDate, remindDays });
  await notifyScope(user, "note", "created", `Nova beležka »${title}« (${child.name})`);
  revalidatePath("/", "layout");
}

/** Označi beležko kot opravljeno ali jo povrni. */
export async function toggleNoteDoneAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  const childId = Number(formData.get("childId") ?? 0);
  const child = await getOwnedChild(user.scope, childId);
  if (!child || !id) return;
  const rows = await db
    .select({ done: notes.done, title: notes.title })
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.childId, childId)))
    .limit(1);
  if (!rows[0]) return;
  const done = !rows[0].done;
  await db
    .update(notes)
    .set({ done, doneAt: done ? new Date() : null })
    .where(eq(notes.id, id));
  await notifyScope(
    user,
    "note",
    "updated",
    done ? `Beležka »${rows[0].title}« je opravljena (${child.name})` : `Beležka »${rows[0].title}« je spet odprta (${child.name})`,
  );
  revalidatePath("/", "layout");
}

export async function togglePinNoteAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  const childId = Number(formData.get("childId") ?? 0);
  const child = await getOwnedChild(user.scope, childId);
  if (!child || !id) return;
  const rows = await db
    .select({ pinned: notes.pinned })
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.childId, childId)))
    .limit(1);
  if (!rows[0]) return;
  await db.update(notes).set({ pinned: !rows[0].pinned }).where(eq(notes.id, id));
  revalidatePath("/", "layout");
}

export async function deleteNoteAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  const childId = Number(formData.get("childId") ?? 0);
  const child = await getOwnedChild(user.scope, childId);
  if (!child || !id) return;
  const gone = await db
    .delete(notes)
    .where(and(eq(notes.id, id), eq(notes.childId, childId)))
    .returning({ title: notes.title });
  if (gone[0]) await notifyScope(user, "note", "deleted", `Izbrisana beležka »${gone[0].title}« (${child.name})`);
  revalidatePath("/", "layout");
}
