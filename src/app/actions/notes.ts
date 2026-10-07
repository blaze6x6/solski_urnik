"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notes, subjects } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getOwnedChild } from "@/lib/data";
import { notifyScope } from "@/lib/notifications";

export async function addNoteAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const childId = Number(formData.get("childId") ?? 0);
  const subjectId = Number(formData.get("subjectId") ?? 0) || null;
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const noteDate = String(formData.get("noteDate") ?? "");
  const pinned = formData.get("pinned") === "on";

  const child = await getOwnedChild(user.scope, childId);
  if (!child || !title || !noteDate) return;

  if (subjectId !== null) {
    const subj = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.id, subjectId), eq(subjects.userId, user.scope)))
      .limit(1);
    if (!subj[0]) return;
  }

  await db.insert(notes).values({ childId, subjectId, title, content, noteDate, pinned });
  await notifyScope(user, "note", "created", `Nova beležka »${title}« (${child.name})`);
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
