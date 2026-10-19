"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { grades, subjects } from "@/db/schema";
import { requireUser, requireViewer } from "@/lib/auth";
import { getAccessibleChild } from "@/lib/data";
import { gradesAccess } from "@/lib/child-permissions";
import { notifyScope } from "@/lib/notifications";

export async function addGradeAction(formData: FormData): Promise<void> {
  const user = await requireViewer();
  const level = gradesAccess(user);
  if (level !== "edit" && level !== "full") return;
  const childId = Number(formData.get("childId") ?? 0);
  const subjectId = Number(formData.get("subjectId") ?? 0);
  const grade = Number(formData.get("grade") ?? 0);
  const gradeDate = String(formData.get("gradeDate") ?? "");
  const type = String(formData.get("type") ?? "pisni izpit").trim();
  const note = String(formData.get("note") ?? "").trim();

  const child = await getAccessibleChild(user, childId);
  if (!child) return;
  const subj = await db
    .select({ id: subjects.id, name: subjects.name })
    .from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.userId, user.scope)))
    .limit(1);
  if (!subj[0] || grade < 1 || grade > 5 || !gradeDate) return;

  await db.insert(grades).values({ childId, subjectId, grade, gradeDate, type, note });
  await notifyScope(user, "grade", "created", `Nova ocena ${grade} — ${subj[0].name} (${child.name})`);
  revalidatePath("/", "layout");
}

/** Urejanje ocene: administrator in otrok (samo za svoje podatke). */
export async function updateGradeAction(formData: FormData): Promise<void> {
  const user = await requireViewer();
  const level = gradesAccess(user);
  if (level !== "edit" && level !== "full") return;
  const id = Number(formData.get("id") ?? 0);
  const childId = Number(formData.get("childId") ?? 0);
  const subjectId = Number(formData.get("subjectId") ?? 0);
  const grade = Number(formData.get("grade") ?? 0);
  const gradeDate = String(formData.get("gradeDate") ?? "");
  const type = String(formData.get("type") ?? "pisni izpit").trim();
  const note = String(formData.get("note") ?? "").trim();

  const child = await getAccessibleChild(user, childId);
  if (!child || !id) return;
  const subj = await db
    .select({ id: subjects.id, name: subjects.name })
    .from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.userId, user.scope)))
    .limit(1);
  if (!subj[0] || !Number.isInteger(grade) || grade < 1 || grade > 5 || !/^\d{4}-\d{2}-\d{2}$/.test(gradeDate)) return;

  const updated = await db
    .update(grades)
    .set({ subjectId, grade, gradeDate, type, note })
    .where(and(eq(grades.id, id), eq(grades.childId, childId)))
    .returning({ id: grades.id });
  if (updated[0]) {
    await notifyScope(user, "grade", "updated", `Urejena ocena ${grade} — ${subj[0].name} (${child.name})`);
  }
  revalidatePath("/", "layout");
}

/**
 * Brisanje ocene. Administrator jo izbriše takoj; otrok samo zaprosi za izbris
 * (starš ga potrdi ali zavrne), ponoven klik prošnjo prekliče.
 */
export async function deleteGradeAction(formData: FormData): Promise<void> {
  const user = await requireViewer();
  const level = gradesAccess(user);
  if (level !== "edit" && level !== "full") return;
  const id = Number(formData.get("id") ?? 0);
  const childId = Number(formData.get("childId") ?? 0);
  const child = await getAccessibleChild(user, childId);
  if (!child || !id) return;

  // raven »dodaja in ureja«: otrok samo zaprosi za izbris, potrdi ga starš
  if (level === "edit") {
    const rows = await db
      .select({ grade: grades.grade, requested: grades.deleteRequestedAt })
      .from(grades)
      .where(and(eq(grades.id, id), eq(grades.childId, childId)))
      .limit(1);
    if (!rows[0]) return;
    const requested = rows[0].requested === null;
    await db
      .update(grades)
      .set({ deleteRequestedAt: requested ? new Date() : null })
      .where(eq(grades.id, id));
    await notifyScope(
      user,
      "grade",
      "updated",
      requested
        ? `${child.name} prosi za izbris ocene ${rows[0].grade}`
        : `${child.name} je preklical(a) prošnjo za izbris ocene ${rows[0].grade}`,
    );
    revalidatePath("/", "layout");
    return;
  }

  const gone = await db
    .delete(grades)
    .where(and(eq(grades.id, id), eq(grades.childId, childId)))
    .returning({ grade: grades.grade });
  if (gone[0]) await notifyScope(user, "grade", "deleted", `Izbrisana ocena ${gone[0].grade} (${child.name})`);
  revalidatePath("/", "layout");
}

/** Starš zavrne otrokovo prošnjo za izbris ocene (ocena ostane). */
export async function rejectGradeDeleteAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  const childId = Number(formData.get("childId") ?? 0);
  const child = await getAccessibleChild(user, childId);
  if (!child || !id) return;
  await db.update(grades).set({ deleteRequestedAt: null }).where(and(eq(grades.id, id), eq(grades.childId, childId)));
  revalidatePath("/", "layout");
}
