import type { SchoolBreak } from "@/db/schema";
import { getCancelledLessons, getSlots, getTimetableRows, lessonKey, occurrencesInWindow } from "@/lib/data";
import { holidayMapForRange } from "@/lib/holidays";
import { clockLabel, eventsForSlot, isRecurring, recurrenceLabel, timeLabel, type Occurrence } from "@/lib/recurrence";
import {
  DNEVI,
  DNEVI_3,
  dateInRange,
  formatDayMonthSI,
  parseISO,
  todayISO,
  weekDates,
} from "@/lib/time";
import type { GridCell, GridDay, GridSlot, WeekEventChip } from "@/components/timetable-grid";

export type BuiltWeek = {
  slots: GridSlot[];
  days: GridDay[];
  cells: Record<string, GridCell>;
  dates: string[];
  weekLabel: string;
  occurrences: Occurrence[];
  /** dogodki tedna v obliki, primerni za prenos v odjemalca */
  eventChips: WeekEventChip[];
};

/** Privzeto ime vrstice, če uporabnik ni vnesel svojega. */
export function slotTitle(slot: { label: string; kind: string; period: number }): string {
  if (slot.label.trim()) return slot.label.trim();
  return slot.kind === "break" ? "Odmor" : `${slot.period}. ura`;
}

/** Kratko ime za ozek stolpec urnika. */
export function slotShort(slot: { label: string; kind: string; period: number }): string {
  const t = slotTitle(slot);
  const m = /^(\d+)\./.exec(t);
  if (m) return `${m[1]}.`;
  if (slot.kind === "break") return "☕";
  // vzemi začetnico (npr. "Predura" -> "P")
  return t.slice(0, 2);
}

/**
 * Sestavi podatke za tedenski urnik otroka (pon–pet).
 * Celice nastanejo za **vsako** vidno vrstico in dan — tudi če predmeta ni,
 * tako da se dogodki prikažejo neodvisno od urnika predmetov.
 */
export async function buildChildWeek(
  childId: number,
  weekOffset: number,
  breaks: SchoolBreak[],
  scopeId: number,
  /** zadnji dan aktivnega šolskega leta — po njem predmetov ne prikazujemo */
  yearEnd: string | null = null,
): Promise<BuiltWeek> {
  const allDates = weekDates(weekOffset);
  const dates = allDates.slice(0, 5); // ponedeljek–petek
  const start = dates[0];
  const end = dates[4];
  const today = todayISO();

  const [rawSlots, rows, occs, cancelledLessons] = await Promise.all([
    getSlots(childId),
    getTimetableRows(childId),
    occurrencesInWindow([childId], start, end, scopeId),
    getCancelledLessons(childId, start, end),
  ]);

  const visibleSlots = rawSlots.filter((s) => s.showInTimetable);
  const holidays = holidayMapForRange(start, end);

  const days: GridDay[] = dates.map((iso, wd) => {
    const b = breaks.find((br) => dateInRange(iso, br.startDate, br.endDate));
    const d = parseISO(iso);
    return {
      iso,
      wd,
      name: DNEVI[wd].charAt(0).toUpperCase() + DNEVI[wd].slice(1),
      shortName: DNEVI_3[wd],
      dateLabel: formatDayMonthSI(iso),
      shortDate: `${d.getDate()}. ${d.getMonth() + 1}.`,
      isToday: iso === today,
      holiday: holidays.get(iso) ?? null,
      breakName: b?.name ?? null,
      afterYear: yearEnd !== null && iso > yearEnd,
    };
  });

  const slots: GridSlot[] = visibleSlots.map((s) => ({
    id: s.id,
    period: s.period,
    title: slotTitle(s),
    short: slotShort(s),
    kind: s.kind === "break" ? "break" : "lesson",
    start: s.start,
    end: s.end,
  }));

  // predmeti po dnevu+uri
  const subjectAt = new Map<string, (typeof rows)[number]["subject"]>();
  for (const { entry, subject } of rows) {
    subjectAt.set(`${entry.weekday}-${entry.slotId}`, subject);
  }

  const cells: Record<string, GridCell> = {};
  for (const slot of slots) {
    for (const day of days) {
      const key = `${day.wd}-${slot.id}`;
      // ob počitnicah, praznikih in po koncu šolskega leta predmetov ne prikazujemo
      // (v novem šolskem letu je razpored drugačen); dogodki ostanejo
      const subject =
        day.breakName || day.holiday || day.afterYear ? null : (subjectAt.get(key) ?? null);

      // VSI dogodki (tudi ponavljajoči), ki pokrivajo to vrstico — ne glede na predmet
      const hits = eventsForSlot(occs, day.iso, {
        id: slot.id,
        start: slot.start,
        end: slot.end,
      });

      if (!subject && hits.length === 0) continue; // prazen termin

      cells[key] = {
        subjectCancelled: subject !== null && cancelledLessons.has(lessonKey(slot.id, day.iso)),
        subject: subject
          ? { id: subject.id, name: subject.name, abbr: subject.abbr, colorIdx: subject.colorIdx }
          : null,
        events: hits.map((h) => ({
          id: h.event.id,
          title: h.event.title,
          color: h.event.color,
          time: timeLabel(h.event),
          location: h.event.location || null,
          clock: clockLabel(h.event),
          occDate: h.startDate,
          cancelled: h.cancelled,
          note: h.event.description?.trim() || null,
        })),
      };
    }
  }

  const weekLabel = `Teden ${formatDayMonthSI(start)} – ${formatDayMonthSI(end)} ${end.slice(0, 4)}`;

  const eventChips: WeekEventChip[] = occs.map((o) => ({
    key: `${o.event.id}-${o.index}`,
    title: o.event.title,
    color: o.event.color,
    cancelled: o.cancelled,
    range:
      o.endDate !== o.startDate
        ? `${formatDayMonthSI(o.startDate)} – ${formatDayMonthSI(o.endDate)}`
        : formatDayMonthSI(o.startDate),
    time: timeLabel(o.event),
    repeat: isRecurring(o.event.recurrence) ? recurrenceLabel(o.event.recurrence) : null,
    note: o.event.description?.trim() || null,
  }));

  return { slots, days, cells, dates, weekLabel, occurrences: occs, eventChips };
}
