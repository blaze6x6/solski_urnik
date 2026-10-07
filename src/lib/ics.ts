// ---------------------------------------------------------------------------
// Generiranje .ics (iCalendar) datotek za dodajanje v druge koledarje
// ---------------------------------------------------------------------------

import type { SchoolEvent } from "@/db/schema";
import { addDaysISO } from "@/lib/time";
import { icsStamp, spanDays } from "@/lib/recurrence";

function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Zavij vrstice na 75 oktetov, kot zahteva RFC 5545. */
function fold(line: string): string {
  if (line.length <= 73) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 73));
  rest = rest.slice(73);
  while (rest.length > 72) {
    parts.push(" " + rest.slice(0, 72));
    rest = rest.slice(72);
  }
  if (rest.length) parts.push(" " + rest);
  return parts.join("\r\n");
}

function rrule(ev: SchoolEvent, timed: boolean): string | null {
  // UNTIL mora biti istega tipa kot DTSTART (RFC 5545)
  const untilStamp = ev.recurrenceUntil
    ? timed
      ? `${icsStamp(ev.recurrenceUntil)}T235959`
      : icsStamp(ev.recurrenceUntil)
    : null;
  const until = untilStamp ? `;UNTIL=${untilStamp}` : "";
  switch (ev.recurrence) {
    case "weekly":
      return `RRULE:FREQ=WEEKLY;INTERVAL=1${until}`;
    case "biweekly":
      return `RRULE:FREQ=WEEKLY;INTERVAL=2${until}`;
    case "triweekly":
      return `RRULE:FREQ=WEEKLY;INTERVAL=3${until}`;
    case "monthly":
      return `RRULE:FREQ=MONTHLY;INTERVAL=1${until}`;
    default:
      return null;
  }
}

function alarms(minutes: number[]): string[] {
  return minutes.flatMap((m) => [
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `TRIGGER:-PT${Math.max(0, Math.round(m))}M`,
    `DESCRIPTION:${escapeIcs("Opomnik")}`,
    "END:VALARM",
  ]);
}

export type IcsInput = {
  event: SchoolEvent;
  /** ime otroka za opis */
  childName?: string | null;
  /** čas šolske ure, če je dogodek vezan nanjo */
  slotTime?: { start: string; end: string } | null;
  /** minute pred začetkom za VALARM */
  reminderMinutes?: number[];
};

/** Zgradi veljavno .ics vsebino za enega ali več dogodkov. */
export function buildIcs(inputs: IcsInput[], calendarName = "Šolski urnik"): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Zasebni solski urnik//SL//",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    "X-WR-TIMEZONE:Europe/Ljubljana",
  ];

  const stampNow = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  for (const { event: ev, childName, slotTime, reminderMinutes } of inputs) {
    const span = spanDays(ev);
    const timed = !ev.allDay && (ev.startTime || slotTime);
    const start = ev.startTime ?? slotTime?.start ?? null;
    const end = ev.endTime ?? slotTime?.end ?? null;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:dogodek-${ev.id}@solski-urnik`);
    lines.push(`DTSTAMP:${stampNow}`);

    if (timed && start) {
      // lebdeči lokalni čas — koledarji ga prikažejo v lokalnem času naprave
      lines.push(`DTSTART:${icsStamp(ev.startDate, start)}`);
      const endIso = span > 0 ? addDaysISO(ev.startDate, span) : ev.startDate;
      lines.push(`DTEND:${icsStamp(endIso, end ?? start)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${icsStamp(ev.startDate)}`);
      // DTEND pri celodnevnih je ekskluziven => dan po koncu
      const lastDay = span > 0 ? addDaysISO(ev.startDate, span) : ev.startDate;
      lines.push(`DTEND;VALUE=DATE:${icsStamp(addDaysISO(lastDay, 1))}`);
    }

    const rule = rrule(ev, Boolean(timed && start));
    if (rule) lines.push(rule);

    lines.push(`SUMMARY:${escapeIcs(ev.title)}`);

    const descParts: string[] = [];
    if (ev.description) descParts.push(ev.description);
    if (childName) descParts.push(`Otrok: ${childName}`);
    if (descParts.length) lines.push(`DESCRIPTION:${escapeIcs(descParts.join("\n"))}`);
    if (ev.location) lines.push(`LOCATION:${escapeIcs(ev.location)}`);

    lines.push(ev.allDay ? "TRANSP:TRANSPARENT" : "TRANSP:OPAQUE");
    lines.push(...alarms(reminderMinutes ?? []));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Varno ime datoteke iz naslova dogodka. */
export function icsFileName(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${base || "dogodek"}.ics`;
}
