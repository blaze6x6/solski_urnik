// ---------------------------------------------------------------------------
// Ponavljajoči se dogodki — razširjanje v konkretne termine
// ---------------------------------------------------------------------------

import type { SchoolEvent } from "@/db/schema";
import { addDaysISO, pad2, parseISO, toISO, toMinutes } from "@/lib/time";

export type RecurrenceKind = "none" | "weekly" | "biweekly" | "triweekly" | "monthly";

export const RECURRENCE_OPTIONS: Array<{ value: RecurrenceKind; label: string; short: string }> = [
  { value: "none", label: "Se ne ponavlja", short: "enkratno" },
  { value: "weekly", label: "Vsak teden", short: "tedensko" },
  { value: "biweekly", label: "Vsak drugi teden", short: "na 14 dni" },
  { value: "triweekly", label: "Vsak tretji teden", short: "na 21 dni" },
  { value: "monthly", label: "Vsak mesec", short: "mesečno" },
];

export function recurrenceLabel(kind: string): string {
  return RECURRENCE_OPTIONS.find((o) => o.value === kind)?.short ?? "enkratno";
}

export function isRecurring(kind: string): boolean {
  return kind !== "none" && RECURRENCE_OPTIONS.some((o) => o.value === kind);
}

/** Prištej mesece z varnim skrajšanjem (31. jan + 1 mesec = 28./29. feb). */
export function addMonthsISO(iso: string, months: number): string {
  const d = parseISO(iso);
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toISO(target);
}

/** Dolžina dogodka v dnevih (0 = enodnevni). */
export function spanDays(ev: Pick<SchoolEvent, "startDate" | "endDate">): number {
  if (!ev.endDate) return 0;
  const a = parseISO(ev.startDate).getTime();
  const b = parseISO(ev.endDate).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export type Occurrence = {
  event: SchoolEvent;
  /** začetni datum te ponovitve */
  startDate: string;
  /** končni datum te ponovitve (pri večdnevnih) */
  endDate: string;
  /** zaporedna številka ponovitve (0 = izvorni termin) */
  index: number;
  /** ta ponovitev je odpadla (dogodek sam ostane) */
  cancelled: boolean;
};

const MAX_ITER = 400;

/** Vse ponovitve dogodka, ki se dotaknejo obdobja [rangeStart, rangeEnd]. */
export function occurrencesInRange(
  ev: SchoolEvent,
  rangeStart: string,
  rangeEnd: string,
): Occurrence[] {
  const out: Occurrence[] = [];
  const span = spanDays(ev);
  const kind = ev.recurrence as RecurrenceKind;
  const until = ev.recurrenceUntil;

  const push = (startDate: string, index: number) => {
    const endDate = span > 0 ? addDaysISO(startDate, span) : startDate;
    if (endDate >= rangeStart && startDate <= rangeEnd) {
      out.push({ event: ev, startDate, endDate, index, cancelled: false });
    }
    return startDate;
  };

  if (!isRecurring(kind)) {
    push(ev.startDate, 0);
    return out;
  }

  const stepDays = kind === "weekly" ? 7 : kind === "biweekly" ? 14 : kind === "triweekly" ? 21 : 0;

  for (let i = 0; i < MAX_ITER; i++) {
    const startDate =
      stepDays > 0 ? addDaysISO(ev.startDate, stepDays * i) : addMonthsISO(ev.startDate, i);
    if (startDate > rangeEnd) break;
    if (until && startDate > until) break;
    push(startDate, i);
  }
  return out;
}

/** Ponovitve več dogodkov hkrati, urejene po datumu. */
export function expandEvents(events: SchoolEvent[], rangeStart: string, rangeEnd: string): Occurrence[] {
  const all: Occurrence[] = [];
  for (const ev of events) all.push(...occurrencesInRange(ev, rangeStart, rangeEnd));
  return all.sort(
    (a, b) => a.startDate.localeCompare(b.startDate) || (a.event.startTime ?? "").localeCompare(b.event.startTime ?? ""),
  );
}

/** Naslednja ponovitev od danes naprej (ali null). */
export function nextOccurrence(ev: SchoolEvent, fromISO: string, horizonDays = 400): Occurrence | null {
  const list = occurrencesInRange(ev, fromISO, addDaysISO(fromISO, horizonDays));
  return list.find((o) => o.endDate >= fromISO) ?? null;
}

// ---------------------------------------------------------------------------
// Prekrivanje s šolskimi urami
// ---------------------------------------------------------------------------

export type SlotRef = { id: number; start: string; end: string };

/** Ali ponovitev dogodka prekriva dano šolsko uro na dan `iso`? */
export function coversSlot(occ: Occurrence, iso: string, slot: SlotRef): boolean {
  const ev = occ.event;
  if (iso < occ.startDate || iso > occ.endDate) return false;
  if (ev.allDay) return true;
  if (ev.slotId !== null && ev.slotId === slot.id) return true;
  if (ev.startTime) {
    const evStart = toMinutes(ev.startTime);
    const evEnd = ev.endTime ? toMinutes(ev.endTime) : evStart + 45;
    const sStart = toMinutes(slot.start);
    const sEnd = toMinutes(slot.end);
    // prekrivanje intervalov
    return evStart < sEnd && evEnd > sStart;
  }
  return false;
}

/**
 * Najbolj specifičen dogodek za dano vrstico urnika:
 * vezan na uro (3) > z ročnim časom (2) > celodnevni (1).
 * Tako ročno vneseni termin ni prekrit s celodnevnim dogodkom.
 * Odpadle ponovitve imajo vedno nižjo prednost od veljavnih, da odpadel
 * dogodek ne zakrije drugega dogodka, ki v tej uri še vedno poteka.
 */
export function bestEventForSlot(
  occs: Occurrence[],
  iso: string,
  slot: SlotRef,
  filter?: (o: Occurrence) => boolean,
): Occurrence | null {
  let best: Occurrence | null = null;
  let bestRank = 0;
  for (const o of occs) {
    if (filter && !filter(o)) continue;
    if (!coversSlot(o, iso, slot)) continue;
    const ev = o.event;
    const base = ev.slotId !== null && ev.slotId === slot.id ? 3 : !ev.allDay && ev.startTime ? 2 : 1;
    const rank = o.cancelled ? base : base + 3;
    if (rank > bestRank) {
      best = o;
      bestRank = rank;
    }
  }
  return best;
}

/**
 * VSI dogodki, ki prekrivajo vrstico urnika (ne le najboljši), urejeni po
 * času začetka. Odpadli so vključeni (označeni z `cancelled`), da se lahko
 * pokažejo sivi in prečrtani poleg veljavnih.
 */
export function eventsForSlot(
  occs: Occurrence[],
  iso: string,
  slot: SlotRef,
  filter?: (o: Occurrence) => boolean,
): Occurrence[] {
  const hits = occs.filter((o) => (!filter || filter(o)) && coversSlot(o, iso, slot));
  const startOf = (o: Occurrence) => {
    const ev = o.event;
    if (!ev.allDay && ev.startTime) return toMinutes(ev.startTime);
    if (ev.slotId !== null && ev.slotId === slot.id) return toMinutes(slot.start);
    return -1; // celodnevni dogodki na vrh
  };
  return hits.sort((a, b) => startOf(a) - startOf(b) || a.event.title.localeCompare(b.event.title, "sl"));
}

/**
 * Ponavljajoči dogodki brez določenega zadnjega dne se samodejno končajo s
 * koncem šolskega leta, v katerem se začnejo (razen če imajo kljukico
 * »brez omejitve«). Izvirnih zapisov ne spreminja.
 */
export function applySchoolYearEnd<T extends SchoolEvent>(
  events: T[],
  years: Array<{ userId: number; startDate: string; endDate: string }>,
): T[] {
  return events.map((ev) => {
    if (ev.recurrence === "none" || ev.recurrenceUntil || ev.ignoreYearEnd) return ev;
    const mine = years
      .filter((y) => ev.scopeId === null || y.userId === ev.scopeId)
      .sort((a, b) => a.endDate.localeCompare(b.endDate));
    // leto, v katerem se dogodek začne, sicer prvo naslednje
    const year = mine.find((y) => y.endDate >= ev.startDate);
    if (!year) return ev;
    return { ...ev, recurrenceUntil: year.endDate };
  });
}

/**
 * Točen čas dogodka za prikaz v urniku, npr. "15:00 - 16:30".
 * Za celodnevne dogodke in dogodke, vezane na šolsko uro, vrne null
 * (čas je razviden iz vrstice urnika oz. dneva).
 */
export function clockLabel(ev: SchoolEvent): string | null {
  if (ev.allDay || !ev.startTime) return null;
  return ev.endTime ? `${ev.startTime} - ${ev.endTime}` : ev.startTime;
}

/** Berljiv opis časa dogodka. */
export function timeLabel(ev: SchoolEvent): string {
  if (ev.allDay) return "cel dan";
  if (ev.startTime) return ev.endTime ? `${ev.startTime}–${ev.endTime}` : ev.startTime;
  if (ev.slotId !== null) return "šolska ura";
  return "cel dan";
}

/** Datum + čas začetka ponovitve kot Date (za opomnike). */
export function occurrenceStartDate(occ: Occurrence): Date {
  const d = parseISO(occ.startDate);
  const ev = occ.event;
  if (!ev.allDay && ev.startTime) {
    const [h, m] = ev.startTime.split(":").map(Number);
    d.setHours(h || 0, m || 0, 0, 0);
  } else {
    // celodnevni dogodki se "začnejo" ob 8:00 za potrebe opomnikov
    d.setHours(8, 0, 0, 0);
  }
  return d;
}

/** "YYYYMMDD" oz. "YYYYMMDDTHHMMSS" za ICS. */
export function icsStamp(iso: string, time?: string | null): string {
  const compact = iso.replace(/-/g, "");
  if (!time) return compact;
  const [h, m] = time.split(":").map(Number);
  return `${compact}T${pad2(h || 0)}${pad2(m || 0)}00`;
}
