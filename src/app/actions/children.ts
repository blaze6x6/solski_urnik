"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { children, timeSlots } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { notifyScope } from "@/lib/notifications";

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
  };

  if (id) {
    await db
      .update(children)
      .set({ name, className, school, color, ...details })
      .where(and(eq(children.id, id), eq(children.userId, user.scope)));
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
  }
  refresh();
}

export async function deleteChildAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  if (!id) return;
  const gone = await db
    .delete(children)
    .where(and(eq(children.id, id), eq(children.userId, user.scope)))
    .returning({ name: children.name });
  if (gone[0]) await notifyScope(user, "child", "deleted", `Izbrisan otrok ${gone[0].name}`);
  refresh();
}
