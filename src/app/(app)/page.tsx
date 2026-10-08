import Link from "next/link";
import { Flag, Palmtree, Settings } from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  getActiveSchoolYear,
  getBreaksForYear,
  getBusRoutes,
  getChildren,
  getSlots,
  getCancelledLessons,
  getTimetableRows,
  lessonKey,
  occurrencesInWindow,
} from "@/lib/data";
import { holidayMapForRange } from "@/lib/holidays";
import {
  DNEVI,
  addDaysISO,
  dateInRange,
  formatDateSI,
  todayISO,
  weekdayIndex,
} from "@/lib/time";
import { eventsForSlot, timeLabel } from "@/lib/recurrence";
import { slotTitle } from "@/lib/week";
import { TodayCard } from "@/components/today-card";
import { DOGODEK, count } from "@/lib/plural";

export const metadata = { title: "Pregled" };

function greetingForHour(h: number): string {
  if (h < 5) return "Dobro jutro";
  if (h < 10) return "Dobro jutro";
  if (h < 18) return "Dober dan";
  return "Dober večer";
}

function nextSchoolDayLabel(fromISO: string): string {
  let d = fromISO;
  for (let i = 0; i < 7; i++) {
    d = addDaysISO(d, 1);
    if (weekdayIndex(d) <= 4) return formatDateSI(d);
  }
  return formatDateSI(d);
}

export default async function DashboardPage() {
  const user = await requireUser();
  const kids = await getChildren(user.scope);
  const year = await getActiveSchoolYear(user.scope);
  const breaks = year ? await getBreaksForYear(year.id) : [];

  const today = todayISO();
  const wd = weekdayIndex(today);
  const holidayToday = holidayMapForRange(today, today).get(today) ?? null;
  const breakToday = breaks.find((b) => dateInRange(today, b.startDate, b.endDate)) ?? null;

  // po koncu šolskega leta pouka ni (v novem letu je razpored predmetov drugačen)
  const yearEnded = year !== null && today > year.endDate;

  const status: "school" | "weekend" | "break" | "holiday" = yearEnded
    ? "break"
    : breakToday
      ? "break"
      : holidayToday
        ? "holiday"
        : wd > 4
          ? "weekend"
          : "school";
  const statusText = yearEnded
    ? "Šolsko leto je končano"
    : status === "break"
      ? breakToday!.name
      : status === "holiday"
        ? holidayToday!
        : status === "weekend"
          ? "Vikend"
          : null;

  const allOccurrences = await occurrencesInWindow(kids.map((k) => k.id), today, today, user.scope);

  const kidData = await Promise.all(
    kids.map(async (kid) => {
      const [slots, rows, bus, cancelledLessons] = await Promise.all([
        getSlots(kid.id),
        getTimetableRows(kid.id),
        getBusRoutes(kid.id),
        getCancelledLessons(kid.id, today, today),
      ]);

      const kidOccs = allOccurrences.filter(
        (o) => o.event.childId === null || o.event.childId === kid.id,
      );

      const subjectAt = new Map(rows.filter((r) => r.entry.weekday === wd).map((r) => [r.entry.slotId, r.subject]));

      // vse vidne vrstice dneva — dogodki se pokažejo tudi brez predmeta
      const lessons = slots
        .filter((slot) => slot.showInTimetable)
        .map((slot) => {
          const subject = subjectAt.get(slot.id) ?? null;
          const hits = eventsForSlot(kidOccs, today, {
            id: slot.id,
            start: slot.start,
            end: slot.end,
          });
          if (!subject && hits.length === 0 && slot.kind !== "break") return null;
          if (slot.kind === "break" && hits.length === 0) return null; // odmor brez dogodka ne zasede vrstice
          return {
            slotId: slot.id,
            period: slot.period,
            title: slotTitle(slot),
            kind: slot.kind === "break" ? ("break" as const) : ("lesson" as const),
            start: slot.start,
            end: slot.end,
            name: subject?.name ?? null,
            abbr: subject?.abbr ?? null,
            colorIdx: subject?.colorIdx ?? null,
            cancelled: subject !== null && cancelledLessons.has(lessonKey(slot.id, today)),
            events: hits.map((h) => ({
              title: h.event.title,
              color: h.event.color,
              time: h.event.startTime ? timeLabel(h.event) : "",
              cancelled: h.cancelled,
            })),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort((a, b) => a.period - b.period);

      const busItems = (dir: "to" | "from") =>
        bus
          .filter((b) => b.direction === dir && b.days.includes(wd))
          .map((b) => ({ id: b.id, time: b.time, arrivalTime: b.arrivalTime, stop: b.stop }));

      // samo dogodki, ki potekajo danes (odpadli ostanejo vidni, označeni)
      const eventsToday = kidOccs
        .filter((o) => o.startDate <= today && o.endDate >= today)
        .sort((x, y) => (x.event.startTime ?? "").localeCompare(y.event.startTime ?? ""))
        .map((o) => ({
          id: o.event.id * 1000 + o.index,
          title: o.event.title,
          timeText: timeLabel(o.event),
          color: o.event.color,
          allDay: o.event.allDay,
          cancelled: o.cancelled,
        }));

      return { kid, lessons, busTo: busItems("to"), busFrom: busItems("from"), eventsToday };
    }),
  );

  const firstName = user.name.split(" ")[0];
  const hour = new Date().getHours();

  return (
    <div>
      {/* Hero */}
      <header className="mb-8">
        <p className="text-xs font-bold tracking-[0.2em] text-amber-strong uppercase">
          {formatDateSI(today)}
        </p>
        <h1 className="font-display mt-2 text-4xl font-medium tracking-tight sm:text-5xl">
          {greetingForHour(hour)}, <span className="text-spruce italic">{firstName}</span>.
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {year ? <span className="chip bg-white text-ink-soft ring-1 ring-line">Šolsko leto {year.name}</span> : null}
          {status === "break" ? (
            <span className="chip bg-[#eef4e4] text-[#4e5c18]">
              <Palmtree className="h-3 w-3" strokeWidth={2.4} />
              {breakToday!.name}
            </span>
          ) : null}
          {holidayToday ? (
            <span className="chip bg-[#faeeea] text-[#a03d2e]">
              <Flag className="h-3 w-3" strokeWidth={2.4} />
              {holidayToday}
            </span>
          ) : null}
          <span className="chip bg-white text-ink-soft ring-1 ring-line">
            {count(allOccurrences.filter((o) => !o.cancelled).length, DOGODEK)} danes
          </span>
        </div>
      </header>

      {kids.length === 0 ? (
        <div className="card mx-auto max-w-xl px-8 py-14 text-center">
          <h2 className="font-display text-2xl font-semibold">Dodajte prvega otroka</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm text-ink-soft">
            Za začetek v nastavitvah dodajte otroka, predmete in urnik — pregled se nato
            zapolni samodejno.
          </p>
          <Link href="/nastavitve?tab=otroci" className="btn btn-primary mt-6">
            <Settings className="h-4 w-4" strokeWidth={2.2} />
            Odpri nastavitve
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {kidData.map(({ kid, lessons, busTo, busFrom, eventsToday }) => (
            <TodayCard
              key={kid.id}
              child={kid}
              dateLabel={`${DNEVI[wd]}`}
              status={status}
              statusText={statusText}
              nextSchoolDayLabel={yearEnded ? null : nextSchoolDayLabel(today)}
              lessons={lessons}
              busTo={busTo}
              busFrom={busFrom}
              eventsToday={eventsToday}
            />
          ))}
        </div>
      )}
    </div>
  );
}
