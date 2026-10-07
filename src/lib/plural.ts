// ---------------------------------------------------------------------------
// Slovensko sklanjanje ob številih (ednina, dvojina, množina)
// ---------------------------------------------------------------------------

/** Oblike samostalnika: [1, 2, 3–4, 0 in 5+] (npr. otrok, otroka, otroci, otrok). */
export type Forms = readonly [one: string, two: string, few: string, many: string];

/** Izbere pravo obliko glede na število (upošteva tudi 101, 102, 103 …). */
export function pick(n: number, forms: Forms): string {
  const r = Math.abs(Math.trunc(n)) % 100;
  if (r === 1) return forms[0];
  if (r === 2) return forms[1];
  if (r === 3 || r === 4) return forms[2];
  return forms[3];
}

/** Število + pravilno sklanjan samostalnik, npr. »3 otroci«. */
export function count(n: number, forms: Forms): string {
  return `${n} ${pick(n, forms)}`;
}

// imenovalnik
export const OTROK: Forms = ["otrok", "otroka", "otroci", "otrok"];
export const DOGODEK: Forms = ["dogodek", "dogodka", "dogodki", "dogodkov"];
export const UPORABNIK: Forms = ["uporabnik", "uporabnika", "uporabniki", "uporabnikov"];
export const ADMINISTRATOR: Forms = ["administrator", "administratorja", "administratorji", "administratorjev"];
export const OCENA: Forms = ["ocena", "oceni", "ocene", "ocen"];
export const PREDMET: Forms = ["predmet", "predmeta", "predmeti", "predmetov"];
export const BELEZKA: Forms = ["beležka", "beležki", "beležke", "beležk"];
export const DAN: Forms = ["dan", "dni", "dnevi", "dni"];
export const TEDEN: Forms = ["teden", "tedna", "tedni", "tednov"];
export const MINUTA: Forms = ["minuta", "minuti", "minute", "minut"];
export const URA: Forms = ["ura", "uri", "ure", "ur"];
export const VOZNJA: Forms = ["vožnja", "vožnji", "vožnje", "voženj"];
export const OSEBA: Forms = ["oseba", "osebi", "osebe", "oseb"];

// tožilnik (npr. »1 dan prej«, »1 uro prej«, »2 uri prej«, »3 ure prej«)
export const URA_TOZ: Forms = ["uro", "uri", "ure", "ur"];
export const MINUTA_TOZ: Forms = ["minuto", "minuti", "minute", "minut"];
export const TEDEN_TOZ: Forms = ["teden", "tedna", "tedne", "tednov"];

// orodnik (npr. »pred 1 uro«, »pred 2 urama«, »pred 3 urami«)
export const URA_ORO: Forms = ["uro", "urama", "urami", "urami"];
export const MINUTA_ORO: Forms = ["minuto", "minutama", "minutami", "minutami"];
export const DAN_ORO: Forms = ["dnem", "dnevoma", "dnevi", "dnevi"];

/** Zapis »pred X …« za relativni čas (npr. »pred 5 minutami«). */
export function agoLabel(minutes: number): string {
  if (minutes < 1) return "pravkar";
  if (minutes < 60) return `pred ${minutes} ${pick(minutes, MINUTA_ORO)}`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `pred ${h} ${pick(h, URA_ORO)}`;
  const d = Math.floor(h / 24);
  return `pred ${d} ${pick(d, DAN_ORO)}`;
}
