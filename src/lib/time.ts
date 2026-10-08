// ---------------------------------------------------------------------------
// Slovenski datumsko-časovni pripomočki (brez knjižnic, stabilni na strežniku)
// ---------------------------------------------------------------------------

export const DNEVI = [
  "ponedeljek",
  "torek",
  "sreda",
  "četrtek",
  "petek",
  "sobota",
  "nedelja",
];

export const DNEVI_3 = ["Pon", "Tor", "Sre", "Čet", "Pet", "Sob", "Ned"];

export const MESECI = [
  "januar",
  "februar",
  "marec",
  "april",
  "maj",
  "junij",
  "julij",
  "avgust",
  "september",
  "oktober",
  "november",
  "december",
];

export const MESECI_G = [
  "januarja",
  "februarja",
  "marca",
  "aprila",
  "maja",
  "junija",
  "julija",
  "avgusta",
  "septembra",
  "oktobra",
  "novembra",
  "decembra",
];

export function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Date -> "YYYY-MM-DD" (lokalni čas) */
export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDaysISO(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** 0 = ponedeljek ... 6 = nedelja */
export function weekdayIndex(iso: string): number {
  return (parseISO(iso).getDay() + 6) % 7;
}

/** Ponedeljek tedna, ki vsebuje datum iso. */
export function mondayOfWeekISO(iso: string): string {
  return addDaysISO(iso, -weekdayIndex(iso));
}

/**
 * Datumi (pon..ned) za teden z odmikom od »tekočega« tedna. Ob sobotah in
 * nedeljah je tekoči teden že naslednji teden (šolski teden se je končal).
 */
export function weekDates(weekOffset = 0): string[] {
  const today = todayISO();
  const mon = mondayOfWeekISO(weekdayIndex(today) >= 5 ? addDaysISO(today, 7) : today);
  return Array.from({ length: 7 }, (_, i) => addDaysISO(mon, i + weekOffset * 7));
}

/** "ponedeljek, 12. februarja 2026" */
export function formatDateSI(iso: string): string {
  const d = parseISO(iso);
  return `${DNEVI[weekdayIndex(iso)]}, ${d.getDate()}. ${MESECI_G[d.getMonth()]} ${d.getFullYear()}`;
}

/** "12. 2. 2026" */
export function formatShortSI(iso: string): string {
  const d = parseISO(iso);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}

/** "12. februar" */
export function formatDayMonthSI(iso: string): string {
  const d = parseISO(iso);
  return `${d.getDate()}. ${MESECI[d.getMonth()]}`;
}

/** "7. 10. 2026 ob 14:05" (neodvisno od ICU/jezikovnih podatkov v okolju) */
export function formatDateTimeSI(d: Date = new Date()): string {
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()} ob ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "februar 2026" */
export function formatMonthSI(isoOrY: string | number, m?: number): string {
  let y: number, mo: number;
  if (typeof isoOrY === "string") {
    const d = parseISO(isoOrY);
    y = d.getFullYear();
    mo = d.getMonth();
  } else {
    y = isoOrY;
    mo = (m ?? 1) - 1;
  }
  return `${MESECI[mo]} ${y}`;
}

export function dateInRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end;
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function nowMinutes(now = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}

export type SlotLike = { id: number; period: number; start: string; end: string };

export type NowSlot =
  | { kind: "active"; slotId: number; period: number; progress: number }
  | { kind: "upcoming"; slotId: number; period: number }
  | { kind: "done" | "off" };

/** Katera ura trenutno poteka (oz. katera je naslednja danes). */
export function findNowSlot<T extends SlotLike>(slots: T[], now = new Date()): NowSlot {
  const wd = (now.getDay() + 6) % 7; // 0=pon
  if (wd > 4) return { kind: "off" };
  const sorted = [...slots].sort((a, b) => a.period - b.period);
  const cur = nowMinutes(now);
  for (const s of sorted) {
    const st = toMinutes(s.start);
    const en = toMinutes(s.end);
    if (cur >= st && cur < en) {
      return { kind: "active", slotId: s.id, period: s.period, progress: (cur - st) / Math.max(1, en - st) };
    }
    if (cur < st) {
      return { kind: "upcoming", slotId: s.id, period: s.period };
    }
  }
  return { kind: "done" };
}

/** Npr. "2026-02" -> 42 celični koledarski prikaz (pon..ned). */
export function calendarCells(year: number, monthIndex: number): { iso: string; inMonth: boolean }[] {
  const first = new Date(year, monthIndex, 1);
  const startOffset = (first.getDay() + 6) % 7; // ponedeljkov začetek
  const cells: { iso: string; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, monthIndex, 1 - startOffset + i);
    cells.push({ iso: toISO(d), inMonth: d.getMonth() === monthIndex });
  }
  return cells;
}

export function currentMonthParam(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}
