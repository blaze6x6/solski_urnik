import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  busRoutes,
  children,
  eventReminders,
  events,
  grades,
  notes,
  schoolBreaks,
  schoolYears,
  subjects,
  timeSlots,
  timetableEntries,
  users,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { addDaysISO, mondayOfWeekISO, todayISO, weekdayIndex } from "@/lib/time";

type SlotDef = {
  period: number;
  label: string;
  kind: "lesson" | "break";
  start: string;
  end: string;
  show?: boolean;
};

/** Privzet vrstni red: predura, ure, malica in kosilo. */
const DEFAULT_SLOTS: SlotDef[] = [
  { period: 0, label: "Predura", kind: "lesson", start: "06:20", end: "07:05", show: false },
  { period: 1, label: "1. ura", kind: "lesson", start: "07:10", end: "07:55" },
  { period: 2, label: "2. ura", kind: "lesson", start: "08:00", end: "08:45" },
  { period: 3, label: "3. ura", kind: "lesson", start: "08:55", end: "09:40" },
  { period: 4, label: "Malica", kind: "break", start: "09:40", end: "10:00" },
  { period: 5, label: "4. ura", kind: "lesson", start: "10:00", end: "10:45" },
  { period: 6, label: "5. ura", kind: "lesson", start: "10:50", end: "11:35" },
  { period: 7, label: "6. ura", kind: "lesson", start: "11:40", end: "12:25" },
  { period: 8, label: "Kosilo", kind: "break", start: "12:25", end: "12:55" },
  { period: 9, label: "7. ura", kind: "lesson", start: "12:55", end: "13:40" },
  { period: 10, label: "8. ura", kind: "lesson", start: "13:45", end: "14:30" },
  { period: 11, label: "9. ura", kind: "lesson", start: "14:35", end: "15:20" },
];

/** Zaporedja učnih ur (brez odmorov) — n-ta vrstica urnika. */
const LESSON_PERIODS = DEFAULT_SLOTS.filter((s) => s.kind === "lesson" && s.period > 0).map((s) => s.period);

const SUBJECT_DEFS: Array<[string, string]> = [
  ["Slovenščina", "SLO"],
  ["Matematika", "MAT"],
  ["Angleščina", "ANG"],
  ["Nemščina", "NEM"],
  ["Naravoslovje in tehnika", "NIT"],
  ["Naravoslovje", "NAR"],
  ["Družba", "DRU"],
  ["Zgodovina", "ZGO"],
  ["Geografija", "GEO"],
  ["Fizika", "FIZ"],
  ["Kemija", "KEM"],
  ["Biologija", "BIO"],
  ["Likovna umetnost", "LUM"],
  ["Glasbena umetnost", "GUM"],
  ["Šport", "ŠPO"],
  ["Razredna ura", "RAZ"],
  ["Gospodinjstvo", "GOS"],
  ["Informatika", "INF"],
];

/** Naslednji dan z želenim delavniškim indeksom (0=pon..4=pet), strogo po `iso`. */
function nextWeekday(iso: string, wd: number): string {
  let d = addDaysISO(iso, 1);
  while (weekdayIndex(d) !== wd) d = addDaysISO(d, 1);
  return d;
}

const bootstrapped = { done: false };

/**
 * Ustvari privzetega administratorja in demo vsebino ob prvem zagonu
 * (če v bazi še ni nobenega uporabnika).
 */
export async function ensureSeed(): Promise<boolean> {
  if (bootstrapped.done) return false;
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length > 0) {
    bootstrapped.done = true;
    return false;
  }

  const email = process.env.ADMIN_EMAIL ?? "admin@urnik.si";
  const password = process.env.ADMIN_PASSWORD ?? "urnik123";

  const [admin] = await db
    .insert(users)
    .values({ name: "Administrator", email, passwordHash: hashPassword(password), isSuperadmin: true })
    .returning();

  // --- Predmeti -------------------------------------------------------------
  const subjectRows = await db
    .insert(subjects)
    .values(SUBJECT_DEFS.map(([name, abbr], i) => ({ userId: admin.id, name, abbr, colorIdx: i })))
    .returning();
  const byAbbr = new Map(subjectRows.map((s) => [s.abbr, s]));

  // --- Otroci ---------------------------------------------------------------
  const [maja, luka] = await db
    .insert(children)
    .values([
      { userId: admin.id, name: "Maja Novak", className: "3. b", school: "OŠ Danile Kumar", color: "#b4652a" },
      { userId: admin.id, name: "Luka Novak", className: "8. a", school: "OŠ Danile Kumar", color: "#2d5d89" },
    ])
    .returning();

  // --- Vrstni red ur --------------------------------------------------------
  const slotIds = new Map<string, number>();
  for (const child of [maja, luka]) {
    const rows = await db
      .insert(timeSlots)
      .values(
        DEFAULT_SLOTS.map((d) => ({
          childId: child.id,
          period: d.period,
          label: d.label,
          kind: d.kind,
          start: d.start,
          end: d.end,
          showInTimetable: d.show ?? true,
        })),
      )
      .returning();
    for (const r of rows) slotIds.set(`${child.id}:${r.period}`, r.id);
  }

  // --- Urniki ---------------------------------------------------------------
  const majaGrid: Array<Array<string | null>> = [
    ["RAZ", "MAT", "SPO", "SLO", "MAT"],
    ["SLO", "ANG", "NAR", "MAT", "NIT"],
    ["MAT", "NAR", "SLO", "SPO", "SLO"],
    ["NIT", "SLO", "MAT", "LUM", "GUM"],
    ["GUM", "SPO", "ANG", "INF", "DRU"],
    ["SPO", "GOS", "LUM", "GUM", null],
    [null, "INF", null, "SPO", null],
  ];

  const lukaGrid: Array<Array<string | null>> = [
    ["MAT", "SLO", "FIZ", "ZGO", "MAT"],
    ["SLO", "GEO", "SLO", "MAT", "KEM"],
    ["ANG", "MAT", "GEO", "SLO", "FIZ"],
    ["FIZ", "ZGO", "NEM", "BIO", "SLO"],
    ["BIO", "KEM", "ANG", "NEM", "GEO"],
    ["NEM", "INF", "MAT", "SPO", "ZGO"],
    ["INF", "SPO", "BIO", "RAZ", "LUM"],
    ["SPO", null, "NEM", null, null],
    [null, "INF", null, null, null],
  ];

  const entryValues: Array<typeof timetableEntries.$inferInsert> = [];
  const addGrid = (childId: number, grid: Array<Array<string | null>>) => {
    grid.forEach((row, rowIdx) => {
      row.forEach((abbr, weekday) => {
        if (!abbr) return;
        const subject = byAbbr.get(abbr);
        const slotId = slotIds.get(`${childId}:${LESSON_PERIODS[rowIdx]}`);
        if (!subject || !slotId) return;
        entryValues.push({ childId, weekday, slotId, subjectId: subject.id });
      });
    });
  };
  addGrid(maja.id, majaGrid);
  addGrid(luka.id, lukaGrid);

  // Luka ima v sredo preduro iz informatike — vrstico zato prikažemo
  const lukaPredura = slotIds.get(`${luka.id}:0`);
  if (lukaPredura) {
    await db
      .update(timeSlots)
      .set({ showInTimetable: true })
      .where(eq(timeSlots.id, lukaPredura));
    entryValues.push({ childId: luka.id, weekday: 2, slotId: lukaPredura, subjectId: byAbbr.get("INF")!.id });
  }

  await db.insert(timetableEntries).values(entryValues);

  // --- Vozni red avtobusa ---------------------------------------------------
  await db.insert(busRoutes).values([
    { childId: maja.id, direction: "to", stop: "Trg mladosti", time: "07:02", arrivalTime: "07:27", days: [0, 1, 2, 3, 4], note: "prehod na postajo s spremljevalcem" },
    { childId: maja.id, direction: "from", stop: "Šolska postaja", time: "12:40", arrivalTime: "13:05", days: [0, 1, 3, 4], note: "po kosilu v šoli" },
    { childId: maja.id, direction: "from", stop: "Šolska postaja", time: "11:45", arrivalTime: "12:10", days: [2], note: "sreda — krajši pouk" },
    { childId: luka.id, direction: "to", stop: "Železniška postaja", time: "06:58", arrivalTime: "07:23", days: [0, 1, 2, 3, 4], note: "" },
    { childId: luka.id, direction: "from", stop: "Šolska postaja", time: "13:30", arrivalTime: "13:55", days: [0, 2, 4], note: "" },
    { childId: luka.id, direction: "from", stop: "Šolska postaja", time: "14:25", arrivalTime: "14:50", days: [1, 3], note: "po podaljšanem pouku" },
  ]);

  // --- Šolsko leto in počitnice --------------------------------------------
  const now = new Date();
  const cy = now.getFullYear();
  const sy = now.getMonth() + 1 >= 9 ? cy : cy - 1;
  const [year] = await db
    .insert(schoolYears)
    .values({ userId: admin.id, name: `${sy}/${sy + 1}`, startDate: `${sy}-09-01`, endDate: `${sy + 1}-06-24`, isActive: true })
    .returning();
  await db.insert(schoolBreaks).values([
    { schoolYearId: year.id, name: "Jesenske počitnice", startDate: `${sy}-10-27`, endDate: `${sy}-11-02` },
    { schoolYearId: year.id, name: "Novoletne počitnice", startDate: `${sy}-12-20`, endDate: `${sy + 1}-01-02` },
    { schoolYearId: year.id, name: "Zimske počitnice", startDate: `${sy + 1}-02-16`, endDate: `${sy + 1}-02-22` },
    { schoolYearId: year.id, name: "Prvomajske počitnice", startDate: `${sy + 1}-04-27`, endDate: `${sy + 1}-05-02` },
    { schoolYearId: year.id, name: "Poletne počitnice", startDate: `${sy + 1}-06-25`, endDate: `${sy + 1}-08-31` },
  ]);

  // --- Dogodki --------------------------------------------------------------
  const t = todayISO();
  const friday = nextWeekday(t, 4);
  const dentistDay = nextWeekday(t, 2); // sreda
  const natSci = nextWeekday(t, 1);
  const naravaMon = mondayOfWeekISO(addDaysISO(t, 7));
  const slot2 = slotIds.get(`${luka.id}:2`) ?? null;

  const insertedEvents = await db
    .insert(events)
    .values([
      { childId: maja.id, scopeId: admin.id, title: "Športni dan", description: "Pohod na Rašico — športna oprema, zajtrk in pijača.", startDate: friday, endDate: null, allDay: true, color: "green" },
      { childId: luka.id, scopeId: admin.id, title: "Zobozdravnik", description: "Preventivni pregled — 2. šolska ura odpade.", startDate: dentistDay, endDate: null, allDay: false, slotId: slot2, color: "rose" },
      { childId: null, scopeId: admin.id, title: "Naravoslovni dan", description: "Eksperimenti v šolskem laboratoriju.", startDate: natSci, endDate: null, allDay: true, color: "sky" },
      { childId: maja.id, scopeId: admin.id, title: "Šola v naravi — Cerkno", description: "Tridnevno bivanje; s seboj vse po seznamu.", startDate: naravaMon, endDate: addDaysISO(naravaMon, 2), allDay: true, color: "violet" },
      { childId: luka.id, scopeId: admin.id, title: "Kulturni dan — gledališče", description: "Predstava v MGL, odhod peš po 2. uri.", startDate: addDaysISO(t, 10), endDate: null, allDay: true, color: "amber" },
      // ponavljajoči se dogodki z ročno nastavljenim časom
      { childId: luka.id, scopeId: admin.id, title: "Nogometni trening", description: "Dvorana OŠ — kopalke in brisača nista potrebni.", location: "Športna dvorana", startDate: nextWeekday(t, 1), endDate: null, allDay: false, startTime: "17:00", endTime: "18:30", recurrence: "weekly", recurrenceUntil: addDaysISO(t, 120), color: "lime" },
      { childId: maja.id, scopeId: admin.id, title: "Klavir", description: "Glasbena šola — s seboj notni zvezek.", location: "Glasbena šola", startDate: nextWeekday(t, 3), endDate: null, allDay: false, startTime: "16:15", endTime: "17:00", recurrence: "weekly", color: "magenta" },
      { childId: null, scopeId: admin.id, title: "Roditeljski sestanek", description: "Skupni del v jedilnici, nato po razredih.", location: "OŠ Danile Kumar", startDate: addDaysISO(t, 14), endDate: null, allDay: false, startTime: "17:30", endTime: "19:00", recurrence: "monthly", color: "indigo" },
      { childId: luka.id, scopeId: admin.id, title: "Plavanje", description: "Bazen Kodeljevo.", location: "Bazen Kodeljevo", startDate: nextWeekday(t, 4), endDate: null, allDay: false, startTime: "18:00", endTime: "19:15", recurrence: "biweekly", color: "cyan" },
      // dogodka, ki se v urniku pokažeta tudi tam, kjer ni predmeta
      { childId: maja.id, scopeId: admin.id, title: "Dodatni pouk MAT", description: "Priprava na tekmovanje Vegovo.", location: "Učilnica 12", startDate: nextWeekday(t, 1), endDate: null, allDay: false, startTime: "13:45", endTime: "14:30", recurrence: "weekly", color: "orange" },
      { childId: luka.id, scopeId: admin.id, title: "Šolska skupnost", description: "Sestanek predstavnikov razredov med malico.", location: "Zbornica", startDate: nextWeekday(t, 3), endDate: null, allDay: false, startTime: "09:40", endTime: "10:00", recurrence: "monthly", color: "violet" },
    ])
    .returning();

  // e-poštni opomniki za nekaj dogodkov
  const byTitle = new Map(insertedEvents.map((e) => [e.title, e.id]));
  const rem: Array<{ eventId: number; minutesBefore: number }> = [];
  const addRem = (title: string, mins: number[]) => {
    const id = byTitle.get(title);
    if (id) for (const m of mins) rem.push({ eventId: id, minutesBefore: m });
  };
  addRem("Športni dan", [1440, 60]);
  addRem("Zobozdravnik", [1440, 120]);
  addRem("Nogometni trening", [60]);
  addRem("Klavir", [60]);
  addRem("Šola v naravi — Cerkno", [10080, 1440]);
  addRem("Roditeljski sestanek", [1440, 120]);
  addRem("Dodatni pouk MAT", [60]);
  if (rem.length) await db.insert(eventReminders).values(rem);

  // --- Ocene ----------------------------------------------------------------
  const g = (childId: number, abbr: string, grade: number, daysAgo: number, type: string, note = "") => ({
    childId,
    subjectId: byAbbr.get(abbr)!.id,
    grade,
    gradeDate: addDaysISO(t, -daysAgo),
    type,
    note,
  });
  await db.insert(grades).values([
    g(maja.id, "MAT", 5, 7, "pisni izpit", "Decimalna števila"),
    g(maja.id, "SLO", 4, 12, "ustno ocenjevanje", "Bralna značka"),
    g(maja.id, "ANG", 5, 3, "krajši pisni izpit", "Besedišče 3. sklop"),
    g(maja.id, "NIT", 4, 20, "praktična naloga", "Meritve dolžine"),
    g(luka.id, "FIZ", 5, 5, "pisni izpit", "Gibanje in sila"),
    g(luka.id, "MAT", 4, 9, "pisni izpit", "Linearne enačbe"),
    g(luka.id, "ZGO", 3, 15, "ustno ocenjevanje", "Srednji vek"),
    g(luka.id, "SLO", 4, 2, "esej", "Ljudska pripovedka"),
    g(luka.id, "INF", 5, 25, "projektna naloga", "Spletna stran v HTML/CSS"),
  ]);

  // --- Beležke ----------------------------------------------------------------
  await db.insert(notes).values([
    { childId: maja.id, subjectId: byAbbr.get("LUM")!.id, title: "Portfelj (likum)", content: "Oddati do petka — 5 listov A4 z motivi jeseni.", noteDate: t, pinned: true },
    { childId: maja.id, subjectId: null, title: "Športni dan — oprema", content: "Nahrbtnik, pijača, zajtrk, pokrivalo, vetrovka.", noteDate: addDaysISO(t, -2), pinned: false },
    { childId: luka.id, subjectId: byAbbr.get("ZGO")!.id, title: "Seminarka iz zgodovine", content: "Tema: prva svetovna vojna — oris oddati do konca meseca.", noteDate: addDaysISO(t, -4), pinned: true },
    { childId: luka.id, subjectId: null, title: "Kalkulator", content: "Kupiti znanstveni kalkulator za fiziko (Casio fx-991).", noteDate: addDaysISO(t, -1), pinned: false },
  ]);

  bootstrapped.done = true;
  return true;
}
