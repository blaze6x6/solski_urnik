"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { busRoutes, busTimetables } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getOwnedChild } from "@/lib/data";
import { notifyScope } from "@/lib/notifications";
import { LIMITS, sanitizeTimetable, type TimetableData } from "@/lib/bus-timetable";

function normTime(v: FormDataEntryValue | null): string {
  const t = String(v ?? "").trim();
  return /^\d{1,2}:\d{2}$/.test(t) ? t.padStart(5, "0") : "";
}

function describe(direction: string, time: string, arrival: string | null, stop: string): string {
  const dir = direction === "from" ? "iz šole" : "v šolo";
  return `${dir}, odhod ${time}${arrival ? `, prihod ${arrival}` : ""}${stop ? ` (${stop})` : ""}`;
}

export async function saveBusRouteAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0) || null;
  const childId = Number(formData.get("childId") ?? 0);
  const direction = String(formData.get("direction") ?? "to") === "from" ? "from" : "to";
  const stop = String(formData.get("stop") ?? "").trim();
  const time = normTime(formData.get("time")); // odhod
  const arrivalTime = normTime(formData.get("arrivalTime")) || null; // prihod
  const note = String(formData.get("note") ?? "").trim();
  const days = formData.getAll("days").map((d) => Number(d)).filter((d) => d >= 0 && d <= 6);

  const child = await getOwnedChild(user.scope, childId);
  if (!child || !time || days.length === 0) return;

  if (id) {
    await db
      .update(busRoutes)
      .set({ direction, stop, time, arrivalTime, note, days })
      .where(and(eq(busRoutes.id, id), eq(busRoutes.childId, childId)));
  } else {
    await db.insert(busRoutes).values({ childId, direction, line: "", stop, time, arrivalTime, note, days });
  }
  await notifyScope(
    user,
    "bus",
    id ? "updated" : "created",
    `${id ? "Urejen" : "Dodan"} avtobus za ${child.name}: ${describe(direction, time, arrivalTime, stop)}`,
  );
  revalidatePath("/", "layout");
  redirect(`/avtobus?otrok=${childId}`);
}

export async function deleteBusRouteAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  const childId = Number(formData.get("childId") ?? 0);
  const child = await getOwnedChild(user.scope, childId);
  if (!child || !id) return;
  const gone = await db
    .delete(busRoutes)
    .where(and(eq(busRoutes.id, id), eq(busRoutes.childId, childId)))
    .returning();
  if (gone[0]) {
    await notifyScope(
      user,
      "bus",
      "deleted",
      `Izbrisan avtobus za ${child.name}: ${describe(gone[0].direction, gone[0].time, gone[0].arrivalTime, gone[0].stop)}`,
    );
  }
  revalidatePath("/", "layout");
}

// --- Stalni vozni redi (za tisk / PDF) -------------------------------------------

export async function saveBusTimetableAction(input: {
  id: number | null;
  name: string;
  subtitle: string;
  note: string;
  data: TimetableData;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const user = await requireUser();
  const name = String(input?.name ?? "").trim().slice(0, LIMITS.name);
  if (!name) return { ok: false, error: "Vnesite naslov voznega reda." };
  const data = sanitizeTimetable(input.data);
  if (data.to.length + data.from.length === 0) return { ok: false, error: "Dodajte vsaj eno vožnjo." };
  if ([...data.to, ...data.from].some((r) => !r.depart)) {
    return { ok: false, error: "Vsaka vožnja mora imeti čas odhoda (prazne vrstice odstranite)." };
  }

  const values = {
    name,
    subtitle: String(input.subtitle ?? "").trim().slice(0, LIMITS.subtitle),
    note: String(input.note ?? "").trim().slice(0, LIMITS.note),
    data: JSON.stringify(data),
    updatedAt: new Date(),
  };

  let id = Number(input.id ?? 0) || null;
  if (id) {
    const updated = await db
      .update(busTimetables)
      .set(values)
      .where(and(eq(busTimetables.id, id), eq(busTimetables.userId, user.scope)))
      .returning({ id: busTimetables.id });
    if (!updated[0]) return { ok: false, error: "Vozni red ni najden." };
  } else {
    const [row] = await db
      .insert(busTimetables)
      .values({ ...values, userId: user.scope })
      .returning({ id: busTimetables.id });
    id = row.id;
  }
  await notifyScope(
    user,
    "bus",
    input.id ? "updated" : "created",
    `${input.id ? "Urejen" : "Dodan"} vozni red »${name}«`,
  );
  revalidatePath("/", "layout");
  return { ok: true, id: id ?? undefined };
}

export async function deleteBusTimetableAction(id: number): Promise<void> {
  const user = await requireUser();
  const tid = Number(id);
  if (!tid) return;
  const gone = await db
    .delete(busTimetables)
    .where(and(eq(busTimetables.id, tid), eq(busTimetables.userId, user.scope)))
    .returning({ name: busTimetables.name });
  if (gone[0]) await notifyScope(user, "bus", "deleted", `Izbrisan vozni red »${gone[0].name}«`);
  revalidatePath("/", "layout");
}
