// ---------------------------------------------------------------------------
// Slovenski državni prazniki (dela prosti dnevi) — fiksni + velikonočni izračun
// ---------------------------------------------------------------------------

import { addDaysISO, pad2 } from "./time";

export type Holiday = { iso: string; name: string };

/** Velikonočna nedelja po Meeus/Jones/Butcherjevem algoritmu. */
function easterSundayISO(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function slovenianHolidays(year: number): Holiday[] {
  const list: Holiday[] = [
    { iso: `${year}-01-01`, name: "Novo leto" },
    { iso: `${year}-01-02`, name: "Novo leto" },
    { iso: `${year}-02-08`, name: "Prešernov dan, slovenski kulturni praznik" },
    { iso: `${year}-04-27`, name: "Dan upora proti okupatorju" },
    { iso: `${year}-05-01`, name: "Praznik dela" },
    { iso: `${year}-05-02`, name: "Praznik dela" },
    { iso: `${year}-06-25`, name: "Dan državnosti" },
    { iso: `${year}-08-15`, name: "Marijino vnebovzetje" },
    { iso: `${year}-10-31`, name: "Dan reformacije" },
    { iso: `${year}-11-01`, name: "Dan spomina na mrtve" },
    { iso: `${year}-12-25`, name: "Božič" },
    { iso: `${year}-12-26`, name: "Dan samostojnosti in enotnosti" },
  ];
  const easter = easterSundayISO(year);
  list.push({ iso: easter, name: "Velika noč" });
  list.push({ iso: addDaysISO(easter, 1), name: "Velikonočni ponedeljek" });
  list.push({ iso: addDaysISO(easter, 49), name: "Binkošti" });
  return list;
}

/** Map iso→ime praznika za vse leta, ki se dotikajo obdobja [start, end]. */
export function holidayMapForRange(startISO: string, endISO: string): Map<string, string> {
  const y1 = Number(startISO.slice(0, 4));
  const y2 = Number(endISO.slice(0, 4));
  const map = new Map<string, string>();
  for (let y = y1; y <= y2; y++) {
    for (const h of slovenianHolidays(y)) {
      if (h.iso >= startISO && h.iso <= endISO) map.set(h.iso, h.name);
    }
  }
  return map;
}
