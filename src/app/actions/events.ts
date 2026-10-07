"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { children, eventCancellations, eventReminders, events } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { eventScopeFilter } from "@/lib/data";
import { notifyScope } from "@/lib/notifications";
import { formatDayMonthSI } from "@/lib/time";
import { sendEventCreatedMail } from "@/lib/event-mail";
import { smtpConfigured } from "@/lib/email";
import { RECURRENCE_OPTIONS } from "@/lib/recurrence";

const VALID_RECURRENCE = new Set(RECURRENCE_OPTIONS.map((o) => o.value as string));

/** Minute iz obrazca: predizbire + poljuben vnos. */
function parseReminders(formData: FormData): number[] {
  const set = new Set<number>();
  for (const raw of formData.getAll("reminders")) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 60 * 24 * 60) set.add(Math.round(n));
  }
  const customValue = Number(formData.get("customReminderValue") ?? 0);
  const customUnit = String(formData.get("customReminderUnit") ?? "min");
  if (Number.isFinite(customValue) && customValue > 0) {
    const mult = customUnit === "dan" ? 1440 : customUnit === "ura" ? 60 : 1;
    const minutes = Math.round(customValue * mult);
    if (minutes > 0 && minutes <= 60 * 24 * 60) set.add(minutes);
  }
  return [...set].sort((a, b) => a - b);
}

function normalizeTime(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return /^\d{2}:\d{2}$/.test(s) ? s : null;
}

export async function saveEventAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0) || null;
  const rawChild = String(formData.get("childId") ?? "all");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const endDateRaw = String(formData.get("endDate") ?? "") || null;
  const color = String(formData.get("color") ?? "amber");

  // način časa: "allday" | "manual" | "slot"
  const timeMode = String(formData.get("timeMode") ?? "allday");
  const startTime = normalizeTime(formData.get("startTime"));
  const endTimeRaw = normalizeTime(formData.get("endTime"));
  const slotIdRaw = Number(formData.get("slotId") ?? 0) || null;

  // ponavljanje
  const recurrenceRaw = String(formData.get("recurrence") ?? "none");
  const recurrence = VALID_RECURRENCE.has(recurrenceRaw) ? recurrenceRaw : "none";
  const recurrenceUntilRaw = String(formData.get("recurrenceUntil") ?? "") || null;

  if (!title || !startDate) return;

  let childId: number | null = null;
  if (rawChild !== "all") {
    const wanted = Number(rawChild);
    const owned = await db
      .select({ id: children.id })
      .from(children)
      .where(and(eq(children.id, wanted), eq(children.userId, user.scope)))
      .limit(1);
    if (!owned[0]) return;
    childId = wanted;
  }

  const allDay = timeMode === "allday";
  const values = {
    childId,
    scopeId: user.scope,
    title,
    description,
    location,
    startDate,
    endDate: endDateRaw && endDateRaw >= startDate ? endDateRaw : null,
    allDay,
    startTime: timeMode === "manual" ? startTime : null,
    endTime: timeMode === "manual" && endTimeRaw && startTime && endTimeRaw > startTime ? endTimeRaw : null,
    slotId: timeMode === "slot" ? slotIdRaw : null,
    recurrence,
    recurrenceUntil: recurrence !== "none" && recurrenceUntilRaw && recurrenceUntilRaw >= startDate ? recurrenceUntilRaw : null,
    ignoreYearEnd: recurrence !== "none" && formData.get("ignoreYearEnd") !== null,
    color,
  };

  const reminders = parseReminders(formData);
  const ownedKids = (
    await db.select({ id: children.id }).from(children).where(eq(children.userId, user.scope))
  ).map((c) => c.id);
  const scopeFilter = eventScopeFilter(ownedKids, user.scope);

  let saved: typeof events.$inferSelect | undefined;

  if (id) {
    const updated = await db
      .update(events)
      .set(values)
      .where(and(eq(events.id, id), scopeFilter))
      .returning();
    saved = updated[0];
    if (saved) {
      await db.delete(eventReminders).where(eq(eventReminders.eventId, saved.id));
    }
  } else {
    const inserted = await db.insert(events).values(values).returning();
    saved = inserted[0];
  }

  if (saved && reminders.length) {
    await db
      .insert(eventReminders)
      .values(reminders.map((minutesBefore) => ({ eventId: saved.id, minutesBefore })));
  }

  // e-poštno obvestilo z .ics prilogo (nov dogodek ali sprememba obstoječega)
  const notify = formData.get("notify") !== null;
  if (saved && notify && smtpConfigured()) {
    try {
      await sendEventCreatedMail(saved, Boolean(id));
    } catch (err) {
      console.error("[dogodek] obvestila ni bilo mogoče poslati:", err);
    }
  }

  if (saved) {
    await notifyScope(
      user,
      "event",
      id ? "updated" : "created",
      `${id ? "Urejen" : "Dodan"} dogodek »${saved.title}« (${formatDayMonthSI(saved.startDate)})`,
    );
  }

  revalidatePath("/", "layout");
  // iz koledarja ostanemo na isti strani (obrazec je v modalnem oknu)
  if (formData.get("stay") !== null) return;
  redirect("/dogodki");
}

export async function deleteEventAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  if (!id) return;
  const ownedKids = (
    await db.select({ id: children.id }).from(children).where(eq(children.userId, user.scope))
  ).map((c) => c.id);
  const gone = await db
    .delete(events)
    .where(and(eq(events.id, id), eventScopeFilter(ownedKids, user.scope)))
    .returning({ title: events.title });
  if (gone[0]) await notifyScope(user, "event", "deleted", `Izbrisan dogodek »${gone[0].title}«`);
  revalidatePath("/", "layout");
}

/** Ročno pošiljanje obvestila z .ics za obstoječi dogodek. */
export async function resendEventMailAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  if (!id || !smtpConfigured()) return;
  const ownedKids = (
    await db.select({ id: children.id }).from(children).where(eq(children.userId, user.scope))
  ).map((c) => c.id);
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), eventScopeFilter(ownedKids, user.scope)))
    .limit(1);
  if (!rows[0]) return;
  try {
    await sendEventCreatedMail(rows[0]);
  } catch (err) {
    console.error("[dogodek] ponovno pošiljanje ni uspelo:", err);
  }
  redirect("/dogodki?poslano=1");
}

/**
 * Označi posamezno ponovitev dogodka kot odpadlo (ali jo povrne).
 * Dogodek in ostale ponovitve ostanejo nespremenjeni.
 */
export async function setOccurrenceCancelledAction(input: {
  eventId: number;
  /** začetni datum ponovitve (YYYY-MM-DD) */
  occurrenceDate: string;
  cancelled: boolean;
}): Promise<void> {
  const user = await requireUser();
  const eventId = Number(input.eventId);
  const date = String(input.occurrenceDate ?? "");
  if (!eventId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

  const ownedKids = (
    await db.select({ id: children.id }).from(children).where(eq(children.userId, user.scope))
  ).map((c) => c.id);
  const owned = await db
    .select({ id: events.id, title: events.title })
    .from(events)
    .where(
      and(eq(events.id, eventId), eventScopeFilter(ownedKids, user.scope)),
    )
    .limit(1);
  if (!owned[0]) return;

  if (input.cancelled) {
    await db
      .insert(eventCancellations)
      .values({ eventId, occurrenceDate: date })
      .onConflictDoNothing();
  } else {
    await db
      .delete(eventCancellations)
      .where(and(eq(eventCancellations.eventId, eventId), eq(eventCancellations.occurrenceDate, date)));
  }

  await notifyScope(
    user,
    "event",
    "updated",
    input.cancelled
      ? `Dogodek »${owned[0].title}« odpade (${formatDayMonthSI(date)})`
      : `Dogodek »${owned[0].title}« je spet na sporedu (${formatDayMonthSI(date)})`,
  );
  revalidatePath("/", "layout");
}
