"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BusFront,
  CalendarDays,
  CircleDot,
  Coffee,
  Flag,
  Palmtree,
} from "lucide-react";
import { cn, eventColor, subjectColor } from "@/lib/colors";
import { findNowSlot, toMinutes } from "@/lib/time";
import { ChildDetailsTrigger, type ChildDetails } from "@/components/child-details-modal";

export type LessonItem = {
  slotId: number;
  period: number;
  title: string;
  kind: "lesson" | "break";
  start: string;
  end: string;
  name: string | null;
  abbr: string | null;
  colorIdx: number | null;
  /** vsi dogodki, ki prekrivajo to uro */
  events: Array<{ title: string; color: string; time: string; cancelled: boolean }>;
};

export type BusItem = { id: number; time: string; arrivalTime: string | null; stop: string };
export type DayEventItem = {
  id: number;
  title: string;
  /** čas dogodka danes, npr. "15:00–16:30" ali "cel dan" */
  timeText: string;
  color: string;
  allDay: boolean;
  cancelled: boolean;
};

type Props = {
  child: ChildDetails;
  dateLabel: string;
  status: "school" | "weekend" | "break" | "holiday";
  statusText: string | null;
  nextSchoolDayLabel: string | null;
  lessons: LessonItem[];
  busTo: BusItem[];
  busFrom: BusItem[];
  eventsToday: DayEventItem[];
};

export function TodayCard({
  child,
  dateLabel,
  status,
  statusText,
  nextSchoolDayLabel,
  lessons,
  busTo,
  busFrom,
  eventsToday,
}: Props) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(id);
  }, []);

  const nowMin = now ? now.getHours() * 60 + now.getMinutes() : null;
  const nowSlot =
    now && status === "school"
      ? findNowSlot(
          lessons.map((l) => ({ id: l.slotId, period: l.period, start: l.start, end: l.end })),
          now,
        )
      : null;

  // ime ure iz urnika (npr. »3. ura«, »Malica«): zaporedna številka v bazi ni isto kot ime ure
  const nowTitle =
    nowSlot && (nowSlot.kind === "active" || nowSlot.kind === "upcoming")
      ? (lessons.find((l) => l.slotId === nowSlot.slotId)?.title ?? `${nowSlot.period}. ura`)
      : "";

  const initials = child.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <section className="card flex min-w-0 flex-col overflow-hidden">
      {/* Glava */}
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <ChildDetailsTrigger
          child={child}
          className="group flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white transition-transform group-hover:scale-105"
            style={{ background: child.color }}
          >
            {initials}
          </span>
          <span className="block min-w-0 flex-1">
            <span className="font-display block text-lg leading-tight font-semibold underline-offset-4 group-hover:underline">
              {child.name}
            </span>
            <span className="block truncate text-xs text-ink-soft">
              {child.className}
              {child.school ? ` · ${child.school}` : ""}
            </span>
          </span>
        </ChildDetailsTrigger>
        <Link
          href={`/urnik?otrok=${child.id}`}
          className="btn btn-ghost no-print !px-3 !py-2 text-xs"
        >
          Urnik
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
        </Link>
      </div>

      <div className="grid min-w-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* Današnji pouk */}
        <div className="min-w-0 border-b border-line px-5 py-4 lg:border-r lg:border-b-0">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-bold tracking-[0.14em] text-ink-faint uppercase">
              Danes · {dateLabel}
            </p>
            {nowSlot?.kind === "active" ? (
              <span className="chip bg-amber text-on-amber">
                <CircleDot className="pulse-dot h-3 w-3" strokeWidth={3} />
                {nowTitle} poteka
              </span>
            ) : nowSlot?.kind === "upcoming" ? (
              <span className="chip bg-paper-deep text-ink-soft">Sledi: {nowTitle}</span>
            ) : status === "school" && now ? (
              <span className="chip bg-paper-deep text-ink-soft">Pouk je končan</span>
            ) : null}
          </div>

          {status !== "school" ? (
            <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-paper/60 px-6 py-8 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef4e4] text-[#4e5c18]">
                {status === "holiday" ? (
                  <Flag className="h-6 w-6" strokeWidth={2} />
                ) : (
                  <Palmtree className="h-6 w-6" strokeWidth={2} />
                )}
              </span>
              <p className="font-display text-lg font-semibold">{statusText ?? "Prost dan"}</p>
              {nextSchoolDayLabel ? (
                <p className="mt-1 text-xs text-ink-soft">Naslednji šolski dan: {nextSchoolDayLabel}</p>
              ) : null}
            </div>
          ) : lessons.length === 0 ? (
            <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-paper/60 px-6 py-8 text-center">
              <Coffee className="mb-3 h-7 w-7 text-ink-faint" strokeWidth={1.8} />
              <p className="font-display text-lg font-semibold">Danes ni vpisanih ur</p>
              <p className="mt-1 text-xs text-ink-soft">Ure dodate na strani urnika.</p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {lessons.map((l) => {
                const pal = l.colorIdx !== null ? subjectColor(l.colorIdx) : null;
                const isActive = nowSlot?.kind === "active" && nowSlot.slotId === l.slotId;
                const past = nowMin !== null && toMinutes(l.end) <= nowMin;
                const activeEv = l.events.filter((e) => !e.cancelled);
                const evPal = activeEv[0] ? eventColor(activeEv[0].color) : null;
                const onlyEvent = l.name === null && l.events.length > 0;
                const accent =
                  onlyEvent && activeEv.length === 0
                    ? "#c9cfd6"
                    : onlyEvent
                      ? (evPal?.solid ?? "var(--color-amber)")
                      : (pal?.solid ?? "#cbd5e1");
                return (
                  <li
                    key={l.slotId}
                    className={cn(
                      "relative flex items-center gap-3 overflow-hidden rounded-xl border px-3 py-2 transition-all",
                      isActive
                        ? "border-amber/60 bg-amber-soft/60 shadow-[0_8px_24px_-14px_rgba(245,131,22,0.6)]"
                        : "border-line/70",
                      l.kind === "break" && "bg-amber-soft/30",
                      past && !isActive && "opacity-45",
                    )}
                  >
                    {isActive && nowSlot?.kind === "active" ? (
                      <span
                        className="absolute bottom-0 left-0 h-[3px] bg-amber transition-all duration-1000"
                        style={{ width: `${Math.round(nowSlot.progress * 100)}%` }}
                      />
                    ) : null}
                    <span className="w-14 shrink-0 text-center">
                      <span className="block truncate text-[11px] font-bold" title={l.title}>
                        {l.title}
                      </span>
                    </span>
                    <span className="w-[46px] shrink-0 text-[10.5px] leading-tight text-ink-faint tabular-nums">
                      {l.start}
                      <br />
                      {l.end}
                    </span>
                    <span className="h-8 w-[3px] shrink-0 rounded-full" style={{ background: accent }} />
                    <span className="min-w-0 flex-1 overflow-hidden">
                      {l.name ? (
                        <span
                          className={cn(
                            "block truncate",
                            activeEv.length > 0
                              ? "text-[12.5px] font-medium text-ink-faint line-through"
                              : "text-[13px] font-semibold",
                          )}
                        >
                          {l.name}
                        </span>
                      ) : null}
                      {l.events.map((e, i) => {
                        const pe = eventColor(e.color);
                        return e.cancelled ? (
                          <span key={i} className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1">
                            <span className="inline-flex min-w-0 max-w-full items-center rounded-full bg-[#c9cfd6] px-2 py-[1px] text-[10.5px] font-bold text-[#6b7480] line-through">
                              <span className="min-w-0 truncate" title={e.title}>{e.title}</span>
                            </span>
                            <span className="text-[10px] font-bold tracking-wide text-[#8a939e] uppercase">Odpade</span>
                          </span>
                        ) : (
                          <span key={i} className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1">
                            <span
                              className="inline-flex min-w-0 max-w-full items-center rounded-full px-2 py-[1px] text-[10.5px] font-bold text-white"
                              style={{ background: pe.solid }}
                            >
                              <span className="min-w-0 truncate" title={e.title}>{e.title}</span>
                            </span>
                            {e.time ? <span className="text-[10px] text-ink-faint">{e.time}</span> : null}
                          </span>
                        );
                      })}
                    </span>
                    {isActive ? (
                      <span className="chip shrink-0 bg-gradient-to-r from-amber to-amber-2 text-[10px] text-white">
                        ZDAJ
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Avtobus + dogodki */}
        <div className="flex min-w-0 flex-col">
          <div className="border-b border-line px-5 py-4">
            <p className="mb-3 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.14em] text-ink-faint uppercase">
              <BusFront className="h-3.5 w-3.5" strokeWidth={2.4} />
              Avtobus danes
            </p>
            {busTo.length + busFrom.length === 0 ? (
              <p className="text-xs text-ink-faint">Ni vnesenih linij za ta dan.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "V šolo", list: busTo },
                  { label: "Iz šole", list: busFrom },
                ].map((dir) => (
                  <div key={dir.label} className="rounded-xl bg-paper/80 p-3">
                    <p className="mb-1.5 text-[10px] font-bold tracking-wide text-ink-soft uppercase">
                      {dir.label}
                    </p>
                    {dir.list.length === 0 ? (
                      <p className="text-[11px] text-ink-faint">—</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {dir.list.map((b) => {
                          const passed = nowMin !== null && toMinutes(b.time) <= nowMin;
                          return (
                            <li key={b.id} className={cn(passed && "opacity-40")}>
                              <span className="text-[15px] leading-none font-bold tabular-nums">
                                {b.time}
                                {b.arrivalTime ? (
                                  <span className="text-ink-faint"> → {b.arrivalTime}</span>
                                ) : null}
                              </span>
                              {b.stop ? (
                                <span className="mt-0.5 block truncate text-[10.5px] text-ink-soft">{b.stop}</span>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 px-5 py-4">
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.14em] text-ink-faint uppercase">
              <CalendarDays className="h-3.5 w-3.5" strokeWidth={2.4} />
              Dogodki ta dan
            </p>
            {eventsToday.length === 0 ? (
              <p className="text-xs text-ink-faint">Danes ni dogodkov.</p>
            ) : (
              <ul className="space-y-1.5">
                {eventsToday.map((e) => {
                  const pal = e.cancelled
                    ? { soft: "#eceff2", ink: "#6b7480", solid: "#b4bcc5" }
                    : eventColor(e.color);
                  return (
                    <li
                      key={e.id}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-medium"
                      style={{ background: pal.soft, color: pal.ink }}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: pal.solid }} />
                      <span className={cn("min-w-0 flex-1 truncate", e.cancelled && "line-through")}>{e.title}</span>
                      {e.cancelled ? (
                        <span className="shrink-0 text-[10px] font-bold tracking-wide uppercase">Odpade</span>
                      ) : null}
                      <span className="shrink-0 text-[10px] font-bold opacity-70">{e.timeText}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
