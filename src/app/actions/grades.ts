"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { grades, subjects } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getOwnedChild } from "@/lib/data";
import { notifyScope } from "@/lib/notifications";

export async function addGradeAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const childId = Number(formData.get("childId") ?? 0);
  const subjectId = Number(formData.get("subjectId") ?? 0);
  const grade = Number(formData.get("grade") ?? 0);
  const gradeDate = String(formData.get("gradeDate") ?? "");
  const type = String(formData.get("type") ?? "pisni izpit").trim();
  const note = String(formData.get("note") ?? "").trim();

  const child = await getOwnedChild(user.scope, childId);
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

export async function deleteGradeAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  const childId = Number(formData.get("childId") ?? 0);
  const child = await getOwnedChild(user.scope, childId);
  if (!child || !id) return;
  const gone = await db
    .delete(grades)
    .where(and(eq(grades.id, id), eq(grades.childId, childId)))
    .returning({ grade: grades.grade });
  if (gone[0]) await notifyScope(user, "grade", "deleted", `Izbrisana ocena ${gone[0].grade} (${child.name})`);
  revalidatePath("/", "layout");
}
