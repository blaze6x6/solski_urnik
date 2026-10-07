// ---------------------------------------------------------------------------
// E-pošta za dogodke: obvestilo ob dodajanju (+ .ics) in opomniki pred začetkom
// ---------------------------------------------------------------------------

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  children,
  eventCancellations,
  eventReminders,
  events,
  reminderLog,
  schoolYears,
  timeSlots,
  users,
  type SchoolEvent,
} from "@/db/schema";
import { eventScopeFilter } from "@/lib/data";
import { sendMail, smtpConfigured } from "@/lib/email";
import { buildIcs, icsFileName } from "@/lib/ics";
import {
  applySchoolYearEnd,
  nextOccurrence,
  occurrenceStartDate,
  occurrencesInRange,
  recurrenceLabel,
  isRecurring,
  timeLabel,
} from "@/lib/recurrence";
import { addDaysISO, formatDateSI, formatShortSI, todayISO } from "@/lib/time";
import { escHtml } from "@/lib/text";
import { recipientsFor } from "@/lib/recipients";
import { reminderLabel } from "@/lib/reminder-labels";

export { reminderLabel };

// --- pomožno ---------------------------------------------------------------

async function childNameFor(ev: SchoolEvent): Promise<string | null> {
  if (ev.childId === null) return null;
  const rows = await db.select({ name: children.name }).from(children).where(eq(children.id, ev.childId)).limit(1);
  return rows[0]?.name ?? null;
}

async function slotTimeFor(ev: SchoolEvent): Promise<{ start: string; end: string } | null> {
  if (ev.slotId === null) return null;
  const rows = await db
    .select({ start: timeSlots.start, end: timeSlots.end })
    .from(timeSlots)
    .where(eq(timeSlots.id, ev.slotId))
    .limit(1);
  return rows[0] ?? null;
}

async function minutesFor(eventId: number): Promise<number[]> {
  const rows = await db.select().from(eventReminders).where(eq(eventReminders.eventId, eventId));
  return rows.map((r) => r.minutesBefore).sort((a, b) => a - b);
}

// --- HTML predloge ----------------------------------------------------------

function card(title: string, rows: Array<[string, string]>, accent: string, intro: string, footer?: string) {
  const body = rows
    .map(
      ([k, v]) => `<tr>
        <td style="padding:7px 0;color:#93a0b0;font-size:12px;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;vertical-align:top">${k}</td>
        <td style="padding:7px 0 7px 16px;font-size:14px;color:#16202b;font-weight:600">${v}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f6f8;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 18px 44px -28px rgba(22,32,43,.45)">
      <div style="background:${accent};padding:22px 26px;color:#fff">
        <p style="margin:0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.85">${intro}</p>
        <h1 style="margin:6px 0 0;font-size:23px;line-height:1.25">${title}</h1>
      </div>
      <div style="padding:20px 26px 24px">
        <table style="width:100%;border-collapse:collapse">${body}</table>
        ${footer ?? ""}
      </div>
      <div style="padding:14px 26px;background:#f4f6f8;color:#93a0b0;font-size:11px">
        Zasebni šolski urnik · ${new Date().toLocaleString("sl-SI")}
      </div>
    </div></body></html>`;
}

function whenRow(ev: SchoolEvent, startISO: string, endISO: string, slot: { start: string; end: string } | null): string {
  const date = startISO === endISO ? formatDateSI(startISO) : `${formatShortSI(startISO)} – ${formatShortSI(endISO)}`;
  const t = ev.allDay ? "cel dan" : ev.startTime ? timeLabel(ev) : slot ? `${slot.start}–${slot.end} (šolska ura)` : "cel dan";
  return `${escHtml(date)}<br><span style="font-weight:500;color:#566475">${escHtml(t)}</span>`;
}

// --- Obvestilo ob dodajanju dogodka ----------------------------------------

export async function sendEventCreatedMail(ev: SchoolEvent, changed = false): Promise<void> {
  if (!smtpConfigured()) return;

  const [childName, slot, minutes, recipients] = await Promise.all([
    childNameFor(ev),
    slotTimeFor(ev),
    minutesFor(ev.id),
    recipientsFor(changed ? "eventChange" : "newEvent", ev.scopeId),
  ]);
  if (recipients.length === 0) return;

  const occ = nextOccurrence(ev, todayISO()) ?? {
    event: ev,
    startDate: ev.startDate,
    endDate: ev.endDate ?? ev.startDate,
    index: 0,
    cancelled: false,
  };

  const rows: Array<[string, string]> = [
    ["Kdaj", whenRow(ev, occ.startDate, occ.endDate, slot)],
    ["Kdo", escHtml(childName ?? "Vsi otroci")],
  ];
  if (ev.location) rows.push(["Kje", escHtml(ev.location)]);
  if (isRecurring(ev.recurrence)) {
    rows.push([
      "Ponavljanje",
      `${escHtml(recurrenceLabel(ev.recurrence))}${ev.recurrenceUntil ? ` do ${escHtml(formatShortSI(ev.recurrenceUntil))}` : ""}`,
    ]);
  }
  if (minutes.length) rows.push(["Opomniki", minutes.map((m) => escHtml(reminderLabel(m))).join(" · ")]);
  if (ev.description) rows.push(["Opis", escHtml(ev.description)]);

  const footer = `<p style="margin:20px 0 0;padding:14px 16px;background:#eafaf3;border-radius:12px;font-size:12.5px;color:#046c46;line-height:1.5">
      📎 V prilogi je datoteka <strong>${escHtml(icsFileName(ev.title))}</strong> — odprite jo na telefonu ali računalniku
      in dogodek se doda v Google Koledar, Apple Koledar, Outlook ali katerikoli drug koledar.
    </p>`;

  const html = card(
    escHtml(ev.title),
    rows,
    changed ? "linear-gradient(135deg,#1d7ff0,#4f46e5)" : "linear-gradient(135deg,#06a66b,#06b3b8)",
    changed ? "Spremenjen dogodek" : "Nov dogodek",
    footer,
  );

  const ics = buildIcs([{ event: ev, childName, slotTime: slot, reminderMinutes: minutes }]);

  for (const r of recipients) {
    await sendMail(r.email, `${changed ? "Spremenjen dogodek" : "Nov dogodek"}: ${ev.title}`, html, [
      {
        filename: icsFileName(ev.title),
        content: ics,
        contentType: "text/calendar; charset=utf-8; method=PUBLISH",
      },
    ]);
  }
}

// --- Opomniki ----------------------------------------------------------------

async function sendReminderMail(ev: SchoolEvent, occStart: string, occEnd: string, minutes: number): Promise<void> {
  const [childName, slot, allMinutes, recipients] = await Promise.all([
    childNameFor(ev),
    slotTimeFor(ev),
    minutesFor(ev.id),
    recipientsFor("reminder", ev.scopeId),
  ]);
  if (recipients.length === 0) return;

  const rows: Array<[string, string]> = [
    ["Kdaj", whenRow(ev, occStart, occEnd, slot)],
    ["Kdo", escHtml(childName ?? "Vsi otroci")],
  ];
  if (ev.location) rows.push(["Kje", escHtml(ev.location)]);
  if (ev.description) rows.push(["Opis", escHtml(ev.description)]);

  const html = card(
    escHtml(ev.title),
    rows,
    "linear-gradient(135deg,#f58316,#f0a500)",
    `Opomnik · ${reminderLabel(minutes)}`,
    `<p style="margin:20px 0 0;padding:14px 16px;background:#fff0da;border-radius:12px;font-size:12.5px;color:#9a5e04">
        Dogodek se začne ${escHtml(reminderLabel(minutes).replace(" prej", ""))} od zdaj.
      </p>`,
  );

  const ics = buildIcs([{ event: ev, childName, slotTime: slot, reminderMinutes: allMinutes }]);

  for (const r of recipients) {
    await sendMail(r.email, `Opomnik: ${ev.title} — ${formatShortSI(occStart)}`, html, [
      { filename: icsFileName(ev.title), content: ics, contentType: "text/calendar; charset=utf-8" },
    ]);
  }
}

/**
 * Pošlje vse zapadle opomnike (zamudo tolerira 12 ur, da se ob izpadu
 * strežnika opomnik vseeno pošlje, a ne pošilja starih).
 */
export async function processDueReminders(now = new Date()): Promise<number> {
  if (!smtpConfigured()) return 0;

  const rows = await db
    .select({ reminder: eventReminders, event: events })
    .from(eventReminders)
    .innerJoin(events, eq(events.id, eventReminders.eventId));
  if (rows.length === 0) return 0;

  const today = todayISO();
  const windowStart = addDaysISO(today, -2);
  const windowEnd = addDaysISO(today, 60);
  const toleranceMs = 12 * 60 * 60 * 1000;

  let sent = 0;

  // odpadle ponovitve ne sprožijo opomnika
  const cancelledRows = await db
    .select()
    .from(eventCancellations)
    .where(inArray(eventCancellations.eventId, [...new Set(rows.map((r) => r.event.id))]));
  const cancelled = new Set(cancelledRows.map((c) => `${c.eventId}|${c.occurrenceDate}`));

  const years = await db.select().from(schoolYears);

  for (const { reminder, event: rawEv } of rows) {
    const ev = applySchoolYearEnd([rawEv], years)[0];
    const occs = occurrencesInRange(ev, windowStart, windowEnd);
    for (const occ of occs) {
      if (cancelled.has(`${ev.id}|${occ.startDate}`)) continue;
      const triggerAt = occurrenceStartDate(occ).getTime() - reminder.minutesBefore * 60_000;
      const diff = now.getTime() - triggerAt;
      if (diff < 0 || diff > toleranceMs) continue;

      const already = await db
        .select({ id: reminderLog.id })
        .from(reminderLog)
        .where(
          and(eq(reminderLog.reminderId, reminder.id), eq(reminderLog.occurrenceDate, occ.startDate)),
        )
        .limit(1);
      if (already[0]) continue;

      try {
        await sendReminderMail(ev, occ.startDate, occ.endDate, reminder.minutesBefore);
        await db.insert(reminderLog).values({ reminderId: reminder.id, occurrenceDate: occ.startDate });
        sent++;
      } catch (err) {
        console.error(`[opomnik] napaka pri dogodku ${ev.id}:`, err);
      }
    }
  }
  return sent;
}

/** Vsi dogodki skupine kot en .ics (naročnina/izvoz celotnega koledarja). */
export async function buildScopeCalendar(scopeId: number): Promise<string> {
  const kids = await db.select({ id: children.id }).from(children).where(eq(children.userId, scopeId));
  const ids = kids.map((k) => k.id);
  const years = await db.select().from(schoolYears).where(eq(schoolYears.userId, scopeId));
  const rows = applySchoolYearEnd(
    await db.select().from(events).where(eventScopeFilter(ids, scopeId)),
    years,
  );

  const inputs = await Promise.all(
    rows.map(async (ev) => ({
      event: ev,
      childName: await childNameFor(ev),
      slotTime: await slotTimeFor(ev),
      reminderMinutes: await minutesFor(ev.id),
    })),
  );
  return buildIcs(inputs, "Šolski urnik — dogodki");
}
