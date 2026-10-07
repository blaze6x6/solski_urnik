"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { subjects } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { notifyScope } from "@/lib/notifications";

function refresh() {
  revalidatePath("/", "layout");
}

export async function saveSubjectAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0) || null;
  const name = String(formData.get("name") ?? "").trim();
  const abbr = String(formData.get("abbr") ?? "").trim().toUpperCase();
  const colorIdx = Number(formData.get("colorIdx") ?? 0) || 0;
  if (!name || !abbr) return;

  if (id) {
    await db
      .update(subjects)
      .set({ name, abbr, colorIdx })
      .where(and(eq(subjects.id, id), eq(subjects.userId, user.scope)));
    await notifyScope(user, "subject", "updated", `Urejen predmet ${name} (${abbr})`);
  } else {
    await db.insert(subjects).values({ userId: user.scope, name, abbr, colorIdx });
    await notifyScope(user, "subject", "created", `Dodan predmet ${name} (${abbr})`);
  }
  refresh();
}

export async function deleteSubjectAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  if (!id) return;
  const gone = await db
    .delete(subjects)
    .where(and(eq(subjects.id, id), eq(subjects.userId, user.scope)))
    .returning({ name: subjects.name });
  if (gone[0]) await notifyScope(user, "subject", "deleted", `Izbrisan predmet ${gone[0].name}`);
  refresh();
}
