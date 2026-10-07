// ---------------------------------------------------------------------------
// Stalni vozni red avtobusa (postaje × vožnje) — čiste funkcije, uporabne na
// strežniku in v odjemalcu.
// ---------------------------------------------------------------------------

export type TimetableRow = {
  /** oznaka vožnje, npr. »Predura« ali »1. pouk do 11:55« */
  label: string;
  depart: string;
  /** prazno = prihod ni naveden */
  arrive: string;
};

export type TimetableData = {
  /** vožnje v šolo */
  to: TimetableRow[];
  /** vožnje iz šole */
  from: TimetableRow[];
};

export const EMPTY_TIMETABLE: TimetableData = { to: [], from: [] };

export const LIMITS = { rows: 40, name: 120, subtitle: 200, note: 1000, label: 60 } as const;

/**
 * Prijazen vnos časa: »7:10«, »07.10«, »710«, »0710«, »7« → »HH:MM«.
 * Neveljaven vnos vrne prazen niz.
 */
export function normalizeTime(input: string): string {
  const raw = String(input ?? "").trim().replace(/[.,hH]/g, ":").replace(/\s+/g, "");
  if (!raw) return "";
  let h: number;
  let m: number;
  if (/^\d{1,2}:\d{1,2}$/.test(raw)) {
    const [a, b] = raw.split(":");
    h = Number(a);
    m = Number(b);
  } else if (/^\d{3,4}$/.test(raw)) {
    h = Number(raw.slice(0, raw.length - 2));
    m = Number(raw.slice(-2));
  } else if (/^\d{1,2}:?$/.test(raw)) {
    h = Number(raw.replace(":", ""));
    m = 0;
  } else {
    return "";
  }
  if (!Number.isInteger(h) || !Number.isInteger(m) || h > 23 || m > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function timeToMinutes(t: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function minutesToTime(n: number): string {
  const v = ((Math.round(n) % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
}

function sanitizeRows(input: unknown): TimetableRow[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, LIMITS.rows).map((r) => {
    const o = (r && typeof r === "object" ? r : {}) as Partial<TimetableRow>;
    return {
      label: String(o.label ?? "").trim().slice(0, LIMITS.label),
      depart: normalizeTime(String(o.depart ?? "")),
      arrive: normalizeTime(String(o.arrive ?? "")),
    };
  });
}

/** Očisti podatke. Staro obliko (postaje × vožnje) obravnava kot prazen vozni red. */
export function sanitizeTimetable(input: unknown): TimetableData {
  const obj = (input && typeof input === "object" ? input : {}) as Partial<TimetableData>;
  return { to: sanitizeRows(obj.to), from: sanitizeRows(obj.from) };
}

export function parseTimetable(json: string): TimetableData {
  try {
    return sanitizeTimetable(JSON.parse(json));
  } catch {
    return { to: [], from: [] };
  }
}

/** Trajanje vožnje v minutah (null, če časa nista veljavna ali je prihod pred odhodom). */
export function durationMinutes(depart: string, arrive: string): number | null {
  const a = timeToMinutes(depart);
  const b = timeToMinutes(arrive);
  if (a === null || b === null || b < a) return null;
  return b - a;
}

/** »10 min«, »1 h 5 min«, »1 h«. */
export function formatDuration(depart: string, arrive: string): string {
  const d = durationMinutes(depart, arrive);
  if (d === null) return "";
  if (d < 60) return `${d} min`;
  const h = Math.floor(d / 60);
  const m = d % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Razvrsti vožnje po odhodu (vožnje brez odhoda na konec). */
export function sortRows(rows: TimetableRow[]): TimetableRow[] {
  return [...rows].sort((a, b) => (timeToMinutes(a.depart) ?? 1e9) - (timeToMinutes(b.depart) ?? 1e9));
}
