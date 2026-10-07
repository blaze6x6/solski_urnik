import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getActiveSchoolYear, getBreaksForYear, getChildren, getSlots, occurrencesInWindow } from "@/lib/data";
import { smtpConfigured } from "@/lib/email";
import { slotTitle } from "@/lib/week";
import { holidayMapForRange } from "@/lib/holidays";
import { cn, eventColor } from "@/lib/colors";
import {
  MESECI,
  calendarCells,
  dateInRange,
  formatDayMonthSI,
  pad2,
  todayISO,
  weekdayIndex,
} from "@/lib/time";
import { isRecurring, recurrenceLabel, timeLabel } from "@/lib/recurrence";
import { CalendarGrid, type CalCell } from "@/components/calendar-grid";

export const metadata = { title: "Koledar" };

type SearchParams = { m?: string };

function shiftMonth(y: number, m: number, delta: number): string {
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export default async function KoledarPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const sp = await searchParams;

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(sp.m ?? "");
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
  }

  const kids = await getChildren(user.scope);
  const activeYear = await getActiveSchoolYear(user.scope);
  const breaks = activeYear ? await getBreaksForYear(activeYear.id) : [];

  const slotsByChild: Record<
    number,
    Array<{ id: number; period: number; title: string; kind: string; start: string; end: string }>
  > = {};
  for (const k of kids) {
    slotsByChild[k.id] = (await getSlots(k.id)).map((s) => ({
      id: s.id,
      period: s.period,
      title: slotTitle(s),
      kind: s.kind,
      start: s.start,
      end: s.end,
    }));
  }

  const rawCells = calendarCells(year, month - 1);
  const first = rawCells[0].iso;
  const last = rawCells[rawCells.length - 1].iso;
  const today = todayISO();

  const occs = await occurrencesInWindow(kids.map((k) => k.id), first, last, user.scope);
  const holidays = holidayMapForRange(first, last);

  const kidName = (childId: number | null) =>
    childId === null ? null : (kids.find((k) => k.id === childId)?.name.split(" ")[0] ?? null);

  const rangeLabel = (s: string, e: string | null) =>
    e ? `${formatDayMonthSI(s)} – ${formatDayMonthSI(e)}` : formatDayMonthSI(s);

  const cells: CalCell[] = rawCells.map((c) => {
    const b = breaks.find((br) => dateInRange(c.iso, br.startDate, br.endDate));
    return {
      iso: c.iso,
      day: Number(c.iso.slice(8, 10)),
      wd: weekdayIndex(c.iso),
      inMonth: c.inMonth,
      isToday: c.iso === today,
      holiday: holidays.get(c.iso) ?? null,
      breakName: b?.name ?? null,
      events: occs
        .filter((o) => dateInRange(c.iso, o.startDate, o.endDate))
        .map((o) => ({
          id: o.event.id * 1000 + o.index,
          eventId: o.event.id,
          occDate: o.startDate,
          recurring: isRecurring(o.event.recurrence),
          title: o.event.title,
          color: o.event.color,
          who: kidName(o.event.childId),
          allDay: o.event.allDay,
          time: timeLabel(o.event),
          repeat: isRecurring(o.event.recurrence) ? recurrenceLabel(o.event.recurrence) : null,
          range: o.endDate !== o.startDate ? rangeLabel(o.startDate, o.endDate) : rangeLabel(o.startDate, null),
          cancelled: o.cancelled,
        })),
    };
  });

  // Stranski seznam meseca
  const monthStart = `${year}-${pad2(month)}-01`;
  const monthEnd = rawCells.filter((c) => c.inMonth).at(-1)?.iso ?? last;
  const monthList: Array<{ iso: string; kind: "holiday" | "break" | "event"; label: string; sub?: string; color?: string; cancelled?: boolean }> = [];
  for (const [iso, name] of holidays) {
    if (dateInRange(iso, monthStart, monthEnd)) monthList.push({ iso, kind: "holiday", label: name });
  }
  for (const b of breaks) {
    if (b.endDate >= monthStart && b.startDate <= monthEnd) {
      monthList.push({ iso: b.startDate, kind: "break", label: b.name, sub: rangeLabel(b.startDate, b.endDate) });
    }
  }
  for (const o of occs) {
    if (o.endDate >= monthStart && o.startDate <= monthEnd) {
      monthList.push({
        iso: o.startDate,
        kind: "event",
        label: o.event.title,
        sub: `${o.cancelled ? "ODPADE · " : ""}${kidName(o.event.childId) ?? "Vsi otroci"} · ${timeLabel(o.event)}${
          o.endDate !== o.startDate ? ` · ${rangeLabel(o.startDate, o.endDate)}` : ""
        }`,
        color: o.event.color,
        cancelled: o.cancelled,
      });
    }
  }
  monthList.sort((a, b) => a.iso.localeCompare(b.iso));

  const prevHref = `/koledar?m=${shiftMonth(year, month, -1)}`;
  const nextHref = `/koledar?m=${shiftMonth(year, month, 1)}`;

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-amber-strong uppercase">Prazniki in dogodki</p>
          <h1 className="font-display mt-2 text-3xl font-medium tracking-tight sm:text-4xl">
            {MESECI[month - 1]} <span className="text-ink-soft italic">{year}</span>
          </h1>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-line-strong bg-white p-1">
          <Link href={prevHref} className="tab-link !px-3" title="Prejšnji mesec">
            <ChevronLeft className="h-4 w-4" strokeWidth={2.4} />
          </Link>
          <Link href="/koledar" className={cn("tab-link", !sp.m && "tab-link-active")}>
            Ta mesec
          </Link>
          <Link href={nextHref} className="tab-link !px-3" title="Naslednji mesec">
            <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
          </Link>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div>
          <CalendarGrid
            cells={cells}
            prevHref={prevHref}
            nextHref={nextHref}
            monthLabel={`${MESECI[month - 1]} ${year}`}
            kids={kids.map((k) => ({ id: k.id, name: k.name }))}
            slotsByChild={slotsByChild}
            smtpReady={smtpConfigured()}
          />
        </div>

        <aside className="card h-fit p-5 xl:sticky xl:top-20">
          <h3 className="font-display flex items-center gap-2 text-lg font-semibold">
            <CalendarDays className="h-4.5 w-4.5 text-amber-strong" strokeWidth={2.2} />
            Ta mesec
          </h3>
          {monthList.length === 0 ? (
            <p className="mt-3 text-sm text-ink-faint">Ni praznikov, počitnic ali dogodkov.</p>
          ) : (
            <ul className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {monthList.map((item, i) => (
                <li key={`${item.iso}-${i}`} className="flex items-start gap-2.5 text-[13px]">
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      background:
                        item.kind === "holiday"
                          ? "#f43f5e"
                          : item.kind === "break"
                            ? "#7cb518"
                            : item.cancelled
                              ? "#b4bcc5"
                              : eventColor(item.color ?? "amber").solid,
                    }}
                  />
                  <div className="min-w-0">
                    <p
                      className={`leading-tight font-semibold ${item.cancelled ? "text-ink-faint line-through" : ""}`}
                    >
                      {item.label}
                    </p>
                    <p className="text-[11px] text-ink-faint">
                      {formatDayMonthSI(item.iso)}
                      {item.sub ? ` · ${item.sub}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 space-y-1.5 border-t border-line pt-4 text-[11px] text-ink-soft">
            <p className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#f43f5e]" /> Državni praznik
            </p>
            <p className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#7cb518]" /> Šolske počitnice
            </p>
            <p className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber" /> Vaši dogodki
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
