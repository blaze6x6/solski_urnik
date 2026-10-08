// ---------------------------------------------------------------------------
// Beležke z rokom: izračun preostalih dni in besedila (strežnik + odjemalec)
// ---------------------------------------------------------------------------

import { addDaysISO, parseISO, todayISO } from "@/lib/time";

/** Možnosti »opomni X dni pred rokom«. */
export const REMIND_OPTIONS = [0, 1, 2, 3, 5, 7, 14] as const;

export function remindLabel(days: number): string {
  if (days === 0) return "na dan roka";
  if (days === 1) return "1 dan prej";
  return `${days} dni prej`;
}

/** Število dni od danes do roka (negativno = zamujeno). */
export function daysUntil(due: string, today: string = todayISO()): number {
  const ms = parseISO(due).getTime() - parseISO(today).getTime();
  return Math.round(ms / 86_400_000);
}

/** »danes«, »jutri«, »še 5 dni«, »zamuja 2 dni«. */
export function dueText(due: string, today: string = todayISO()): string {
  const d = daysUntil(due, today);
  if (d === 0) return "danes";
  if (d === 1) return "jutri";
  if (d > 1) return `še ${d} dni`;
  if (d === -1) return "zamuja 1 dan";
  return `zamuja ${-d} dni`;
}

export type NoteLike = { done: boolean; dueDate: string | null; remindDays: number };

/** Beležka je »nujna«: odprta in rok je znotraj opozorilnega okna (ali že mimo). */
export function isDueSoon(n: NoteLike, today: string = todayISO()): boolean {
  return !n.done && n.dueDate !== null && daysUntil(n.dueDate, today) <= n.remindDays;
}

/** Prvi dan, ko se beležka pokaže / pošlje opomnik. */
export function reminderStart(due: string, remindDays: number): string {
  return addDaysISO(due, -remindDays);
}
