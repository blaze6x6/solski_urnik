// Čiste funkcije za opomnike — uporabne tudi v klientskih komponentah.

import { DAN, MINUTA_TOZ, TEDEN_TOZ, URA_TOZ, pick } from "@/lib/plural";

export function reminderLabel(minutes: number): string {
  if (minutes % 10080 === 0) {
    const w = minutes / 10080;
    return `${w} ${pick(w, TEDEN_TOZ)} prej`;
  }
  if (minutes % 1440 === 0) {
    const d = minutes / 1440;
    return `${d} ${pick(d, DAN)} prej`;
  }
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return `${h} ${pick(h, URA_TOZ)} prej`;
  }
  return `${minutes} ${pick(minutes, MINUTA_TOZ)} prej`;
}

export const REMINDER_PRESETS = [
  { minutes: 15, label: reminderLabel(15) },
  { minutes: 60, label: reminderLabel(60) },
  { minutes: 120, label: reminderLabel(120) },
  { minutes: 1440, label: reminderLabel(1440) },
  { minutes: 2880, label: reminderLabel(2880) },
  { minutes: 10080, label: reminderLabel(10080) },
];
