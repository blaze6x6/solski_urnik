"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CalendarOff,
  CaseSensitive,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eraser,
  Flag,
  Palmtree,
  Printer,
  Sparkles,
  StickyNote,
  Undo2,
  X,
  XCircle,
} from "lucide-react";
import { cn, eventColor, subjectColor } from "@/lib/colors";
import { findNowSlot, toISO } from "@/lib/time";
import { setEntryAction } from "@/app/actions/timetable";
import { setOccurrenceCancelledAction } from "@/app/actions/events";
import { loadChildWeekAction } from "@/app/actions/week";
import { PdfMenu, type PdfStyle } from "@/components/pdf-menu";
import { exportTimetablePdf, type PdfPayload } from "@/lib/pdf";
import { useIsMobile, useIsTouch, useSwipeNavigation } from "@/components/use-swipe";

export type GridCell = {
  subject: { id: number; name: string; abbr: string; colorIdx: number } | null;
  /** vsi dogodki, ki prekrivajo to celico (po času začetka) */
  events: GridEvent[];
} | null;

export type GridEvent = {
  id: number;
  title: string;
  color: string;
  time: string;
  location: string | null;
  /** točen čas, npr. "15:00 - 16:30" (null pri celodnevnih / vezanih na uro) */
  clock: string | null;
  /** začetni datum ponovitve (ključ za »odpade«) */
  occDate: string;
  cancelled: boolean;
  /** opombe (opis) dogodka — null, če jih ni */
  note: string | null;
};

export type GridDay = {
  iso: string;
  wd: number;
  name: string;
  /** kratko ime dneva za mobilni pogled, npr. "Pon" */
  shortName: string;
  dateLabel: string;
  /** kratek datum za mobilni pogled, npr. "12. 2." */
  shortDate: string;
  isToday: boolean;
  holiday: string | null;
  breakName: string | null;
  /** dan je po koncu aktivnega šolskega leta (predmeti se ne prikazujejo) */
  afterYear: boolean;
};

export type GridSlot = {
  id: number;
  period: number;
  /** poljubno ime vrstice: "Predura", "1. ura", "Malica" … */
  title: string;
  /** kratka oznaka za ozek stolpec */
  short: string;
  kind: "lesson" | "break";
  start: string;
  end: string;
};
export type SubjectOption = { id: number; name: string; abbr: string; colorIdx: number };

/** Dogodek tedna v obliki »čip«, primerni za prenos iz strežnika. */
export type WeekEventChip = {
  key: string;
  title: string;
  color: string;
  cancelled: boolean;
  range: string;
  time: string;
  repeat: string | null;
  /** opombe (opis) dogodka — null, če jih ni */
  note: string | null;
};

/** Vsi podatki enega prikazanega tedna. */
export type WeekPayload = {
  weekOffset: number;
  weekLabel: string;
  days: GridDay[];
  slots: GridSlot[];
  cells: Record<string, GridCell>;
  eventChips: WeekEventChip[];
};

type Props = {
  childId: number;
  /** ime učenca — izpiše se na vrhu izvoza PDF */
  studentName: string;
  /** teden, ki ga je strežnik pripravil (odmik od tekočega tedna) */
  weekOffset: number;
  weekLabel: string;
  days: GridDay[];
  slots: GridSlot[];
  cells: Record<string, GridCell>;
  eventChips: WeekEventChip[];
  subjects: SubjectOption[];
  initialMode: "full" | "abbr";
  /** poti za pomik tedna (uporabljeni, ko se urnik ne pomika neodvisno) */
  prevHref: string;
  nextHref: string;
  todayHref: string;
  /**
   * Neodvisen pomik: poteg ali puščica pomakne samo ta urnik (podatke naloži
   * brez menjave strani), ostali urniki in položaj drsenja ostanejo nespremenjeni.
   * Uporabno pri prikazu vseh urnikov hkrati.
   */
  independent?: boolean;
};

export function TimetableGrid({
  childId,
  studentName,
  weekOffset,
  weekLabel: serverWeekLabel,
  days: serverDays,
  slots: serverSlots,
  cells: serverCells,
  eventChips: serverChips,
  subjects,
  initialMode,
  prevHref,
  nextHref,
  todayHref,
  independent = false,
}: Props) {
  const compactToolbar = independent;
  const router = useRouter();
  const isMobile = useIsMobile();
  const isTouch = useIsTouch();

  // Lokalno naložen teden (samo pri neodvisnem pomiku); sicer veljajo podatki strežnika.
  const [local, setLocal] = useState<WeekPayload | null>(null);
  const [slideDir, setSlideDir] = useState<"next" | "prev" | null>(null);
  const [navPending, startNav] = useTransition();
  const reqId = useRef(0);

  const days = local?.days ?? serverDays;
  const slots = local?.slots ?? serverSlots;
  const cells = local?.cells ?? serverCells;
  const eventChips = local?.eventChips ?? serverChips;
  const weekLabel = local?.weekLabel ?? serverWeekLabel;
  const currentOffset = local?.weekOffset ?? weekOffset;
  /** null = samodejno (mobilno => kratice), sicer ročna izbira */
  const [manualMode, setManualMode] = useState<"full" | "abbr" | null>(
    initialMode === "abbr" ? "abbr" : null,
  );
  const mode: "full" | "abbr" = manualMode ?? (isMobile ? "abbr" : "full");

  const [now, setNow] = useState<Date | null>(null);
  const [detail, setDetail] = useState<{ wd: number; slotId: number } | null>(null);
  const [picking, setPicking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [cancelPending, startCancelTransition] = useTransition();
  const [, startTransition] = useTransition();

  /** Pomik na izbrani teden (0 = ta teden) — brez pomika strani na vrh. */
  function goTo(target: number, href: string) {
    const clamped = Math.max(-52, Math.min(52, target));
    if (clamped === currentOffset) return;
    setSlideDir(clamped > currentOffset ? "next" : "prev");
    if (!independent) {
      startNav(() => {
        router.push(href, { scroll: false });
      });
      return;
    }
    const my = ++reqId.current;
    startNav(async () => {
      const res = await loadChildWeekAction({ childId, weekOffset: clamped });
      if (res && my === reqId.current) setLocal(res);
    });
  }
  const goWeek = (delta: 1 | -1) => goTo(currentOffset + delta, delta > 0 ? nextHref : prevHref);
  const goToday = () => goTo(0, todayHref);

  /** Ponovno naloži lokalni teden po spremembi (podatki strežnika se osvežijo sami). */
  async function refreshLocal() {
    if (!local) return;
    const res = await loadChildWeekAction({ childId, weekOffset: local.weekOffset });
    if (res) setLocal(res);
  }

  const { ref: swipeRef, hint } = useSwipeNavigation<HTMLDivElement>({
    onPrev: () => goWeek(-1),
    onNext: () => goWeek(1),
    // dotikov z miško ni, zato ga ni treba omejevati na ozek zaslon (ležeči položaj!)
    enabled: detail === null,
  });

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(id);
  }, []);

  // zapiranje modala s tipko Esc
  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDetail(null);
        setPicking(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail]);

  const todayIso = now ? toISO(now) : null;
  const isCurrentWeek = todayIso !== null && days.some((d) => d.iso === todayIso);
  const nowSlot = now && isCurrentWeek ? findNowSlot(slots, now) : null;
  // »Zdaj« samo med trajanjem ure po urniku (ne že pred začetkom prve ure)
  const activeSlotId = nowSlot && nowSlot.kind === "active" ? nowSlot.slotId : null;

  const usedSubjects = useMemo(() => {
    const ids = new Set<number>();
    for (const c of Object.values(cells)) if (c?.subject) ids.add(c.subject.id);
    return subjects.filter((s) => ids.has(s.id));
  }, [cells, subjects]);

  const weekNotes = useMemo(() => {
    const notes: string[] = [];
    for (const d of days) {
      if (d.breakName) notes.push(`${d.name} ${d.dateLabel}: ${d.breakName}`);
      if (d.holiday) notes.push(`${d.name} ${d.dateLabel}: ${d.holiday} (praznik)`);
    }
    return [...new Set(notes)];
  }, [days]);

  function pickSubject(subjectId: number | null) {
    if (!detail) return;
    const { wd, slotId } = detail;
    setPicking(false);
    setDetail(null);
    startTransition(async () => {
      await setEntryAction({ childId, weekday: wd, slotId, subjectId });
      await refreshLocal();
    });
  }

  function toggleCancelled(eventId: number, occurrenceDate: string, cancelled: boolean) {
    startCancelTransition(async () => {
      await setOccurrenceCancelledAction({ eventId, occurrenceDate, cancelled });
      await refreshLocal();
    });
  }

  async function handlePdf(style: PdfStyle) {
    setExporting(true);
    try {
      const pdfCells: PdfPayload["cells"] = {};
      for (const [key, cell] of Object.entries(cells)) {
        pdfCells[key] = cell
          ? {
              hasSubject: cell.subject !== null,
              text: cell.subject ? (mode === "full" ? cell.subject.name : cell.subject.abbr) : "",
              colorIdx: cell.subject?.colorIdx ?? 0,
              events: cell.events.map((e) => ({ title: e.title, clock: e.clock, cancelled: e.cancelled, color: e.color })),
            }
          : null;
      }
      await exportTimetablePdf({
        title: studentName,
        fileName: `urnik-${studentName}${style === "color" ? "-barvni" : ""}`,
        days: days.map((d) => ({
          iso: d.iso,
          wd: d.wd,
          label: d.name, // datum se v PDF ne izpiše
          holiday: d.holiday,
          breakName: d.breakName,
          afterYear: d.afterYear,
        })),
        slots: slots.map((s) => ({
          id: s.id,
          period: s.period,
          title: s.title,
          kind: s.kind,
          start: s.start,
          end: s.end,
        })),
        cells: pdfCells,
        legend: usedSubjects.map((s) => `${s.abbr} = ${s.name}`),
        mode,
        style,
      });
    } finally {
      setExporting(false);
    }
  }

  const detailDay = detail ? days.find((d) => d.wd === detail.wd) ?? null : null;
  const detailSlot = detail ? slots.find((s) => s.id === detail.slotId) ?? null : null;
  const detailCell = detail ? cells[`${detail.wd}-${detail.slotId}`] ?? null : null;

  return (
    <div>
      {/* Orodna vrstica — na ozkem zaslonu vse v eni vrstici (manjši gumbi, samo ikone) */}
      <div
        className={cn(
          // na ≥ 360 px vse v eni vrstici; na zelo ozkih zaslonih (320 px) se desna skupina prelomi
          "no-print flex flex-wrap items-center gap-1 sm:gap-2",
          compactToolbar ? "mb-2" : "mb-4",
        )}
      >
        <div className="flex shrink-0 rounded-full border border-line-strong bg-white p-0.5 sm:p-1">
          <button
            onClick={() => setManualMode("full")}
            className={cn("tab-link !gap-1 !px-2 !py-1.5 sm:!px-4 sm:!py-[0.45rem]", mode === "full" && "tab-link-active")}
            title="Polna imena"
            aria-label="Polna imena"
          >
            <CaseSensitive className="h-4 w-4" strokeWidth={2.2} />
            <span className="hidden sm:inline">Polna imena</span>
          </button>
          <button
            onClick={() => setManualMode("abbr")}
            className={cn("tab-link !gap-1 !px-2 !py-1.5 sm:!px-4 sm:!py-[0.45rem]", mode === "abbr" && "tab-link-active")}
            title="Kratice"
            aria-label="Kratice"
          >
            <span className="text-[10px] font-bold tracking-wide sm:text-[11px] sm:tracking-wider">ABC</span>
            <span className="hidden sm:inline">Kratice</span>
          </button>
        </div>

        <div className="ml-auto flex items-center justify-end gap-1 sm:flex-wrap sm:gap-2">
          {/* pomik tedna — za vsak urnik posebej */}
          <div className="flex shrink-0 items-center rounded-full border border-line-strong bg-white p-0.5 sm:gap-0.5 sm:p-1">
            <button
              onClick={() => goWeek(-1)}
              className="tab-link !px-1.5 !py-1.5 sm:!px-2.5 sm:!py-[0.45rem]"
              title="Prejšnji teden"
              aria-label="Prejšnji teden"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.4} />
            </button>
            <button
              onClick={goToday}
              className={cn(
                "tab-link !px-2 !py-1.5 text-[11px] sm:!px-3 sm:!py-[0.45rem] sm:text-[13px]",
                currentOffset === 0 && "tab-link-active",
              )}
              title="Skoči na ta teden"
            >
              Ta teden
            </button>
            <button
              onClick={() => goWeek(1)}
              className="tab-link !px-1.5 !py-1.5 sm:!px-2.5 sm:!py-[0.45rem]"
              title="Naslednji teden"
              aria-label="Naslednji teden"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
            </button>
          </div>
          <button
            onClick={() => window.print()}
            className="btn btn-ghost shrink-0 !px-2 !py-1.5 sm:!px-[1.1rem] sm:!py-[0.55rem]"
            title="Natisni"
            aria-label="Natisni"
          >
            <Printer className="h-4 w-4" strokeWidth={2.2} />
            <span className="hidden sm:inline">Natisni</span>
          </button>
          <PdfMenu
            busy={exporting}
            compact
            onPick={handlePdf}
            className="btn btn-amber shrink-0 !gap-1 !px-2 !py-1.5 text-[11px] sm:!gap-2 sm:!px-[1.1rem] sm:!py-[0.55rem] sm:text-[13px]"
          />
        </div>
      </div>

      {independent ? (
        <p className="no-print mb-2 text-xs font-medium text-ink-soft tabular-nums">{weekLabel}</p>
      ) : null}

      {/* Namig za poteg prsta */}
      <p
        className={cn(
          "no-print mb-2 items-center justify-center gap-1.5 text-[11px] font-medium text-ink-faint",
          isTouch ? "flex" : "hidden",
        )}
      >
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.4} />
        {independent ? "povlecite urnik za menjavo njegovega tedna" : "povlecite za menjavo tedna"} · tapnite uro za podrobnosti
        <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.4} />
      </p>

      {/* Mreža urnika */}
      <div
        ref={swipeRef}
        className={cn(
          "card touch-pan-y overflow-hidden",
          hint && "ring-2 ring-amber/40",
          navPending && "opacity-70 transition-opacity",
        )}
      >
        <div
          key={days[0]?.iso}
          className={cn(slideDir === "next" && "week-slide-next", slideDir === "prev" && "week-slide-prev")}
        >
        <div className="grid" style={{ gridTemplateColumns: "clamp(42px, 11vw, 74px) repeat(5, minmax(0, 1fr))" }}>
          {/* glava */}
          <div className="border-b border-line bg-paper-deep/70 px-1 py-2.5">
            <p className="text-center text-[9px] font-bold tracking-[0.1em] text-ink-faint uppercase sm:text-[10px]">
              Ura
            </p>
          </div>
          {days.map((d) => (
            <div
              key={d.iso}
              className={cn(
                "border-b border-l border-line px-0.5 py-2 text-center sm:px-2 sm:py-2.5",
                d.isToday
                  ? "bg-gradient-to-br from-spruce to-spruce-2 text-white"
                  : "bg-paper-deep/70",
              )}
            >
              <p className={cn("text-[11px] font-bold sm:text-[13px]", d.isToday ? "text-white" : "text-ink")}>
                <span className="sm:hidden">{d.shortName}</span>
                <span className="hidden sm:inline">{d.name}</span>
              </p>
              <p className={cn("text-[9.5px] tabular-nums sm:text-[11px]", d.isToday ? "text-white/85" : "text-ink-faint")}>
                <span className="sm:hidden">{d.shortDate}</span>
                <span className="hidden sm:inline">{d.dateLabel}</span>
              </p>
              <div className="mt-1 flex min-h-[8px] flex-wrap items-center justify-center gap-1 sm:min-h-[18px]">
                {d.holiday ? (
                  <span
                    className={cn(
                      "chip gap-1 !px-1 !py-0.5 sm:!px-2",
                      d.isToday ? "bg-white/20 text-white" : "bg-[#ffe3e9] text-[#c21742]",
                    )}
                    title={d.holiday}
                  >
                    <Flag className="h-2.5 w-2.5 sm:h-3 sm:w-3" strokeWidth={2.6} />
                    <span className="hidden max-w-[110px] truncate sm:inline">Praznik</span>
                  </span>
                ) : null}
                {d.breakName ? (
                  <span
                    className={cn(
                      "chip gap-1 !px-1 !py-0.5 sm:!px-2",
                      d.isToday ? "bg-white/20 text-white" : "bg-[#eef8d6] text-[#587f0a]",
                    )}
                    title={d.breakName}
                  >
                    <Palmtree className="h-2.5 w-2.5 sm:h-3 sm:w-3" strokeWidth={2.6} />
                    <span className="hidden max-w-[110px] truncate sm:inline">{d.breakName}</span>
                  </span>
                ) : null}
              </div>
            </div>
          ))}

          {/* vrstice ur */}
          {slots.map((slot) => (
            <SlotRow
              key={slot.id}
              slot={slot}
              days={days}
              cells={cells}
              mode={mode}
              todayIso={todayIso}
              activeSlotId={activeSlotId}
              firstLessonId={slots.find((s) => s.kind === "lesson")?.id ?? null}
              onOpen={(wd, slotId) => {
                setPicking(false);
                setDetail({ wd, slotId });
              }}
            />
          ))}
        </div>
        </div>
      </div>

      {/* Legenda kratic */}
      {mode === "abbr" && usedSubjects.length > 0 ? (
        <div className="no-print mt-4 flex flex-wrap gap-1.5">
          {usedSubjects.map((s) => {
            const pal = subjectColor(s.colorIdx);
            return (
              <span
                key={s.id}
                className="chip px-2.5 py-1 text-[11px]"
                style={{ background: pal.soft, color: pal.ink }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: pal.solid }} />
                <strong>{s.abbr}</strong> {s.name}
              </span>
            );
          })}
        </div>
      ) : usedSubjects.length > 0 ? (
        <p className="no-print mt-4 text-xs leading-relaxed text-ink-faint">
          <Sparkles className="mr-1 inline h-3.5 w-3.5 text-amber-strong" strokeWidth={2.2} />
          {usedSubjects.map((s) => `${s.abbr} = ${s.name}`).join("   ·   ")}
        </p>
      ) : null}

      {/* Dogodki tedna za tega otroka */}
      {eventChips.length > 0 ? (
        <div className="card no-print mt-4 px-5 py-4">
          <p className="mb-3 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.14em] text-ink-faint uppercase">
            <CalendarDays className="h-3.5 w-3.5" strokeWidth={2.4} />
            Dogodki v tem tednu
          </p>
          <div className="flex flex-wrap gap-2">
            {eventChips.map((o) => {
              const pal = o.cancelled
                ? { soft: "#eceff2", ink: "#6b7480", solid: "#b4bcc5" }
                : eventColor(o.color);
              return (
                <span
                  key={o.key}
                  className="chip px-3 py-1.5 text-[11.5px]"
                  style={{ background: pal.soft, color: pal.ink }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: pal.solid }} />
                  <span className={o.cancelled ? "line-through" : undefined}>{o.title}</span>
                  {o.cancelled ? <strong className="text-[10px] tracking-wide uppercase">Odpade</strong> : null}
                  <span className="opacity-60">
                    {o.range}
                    {" · "}
                    {o.time}
                    {o.repeat ? ` · ${o.repeat}` : ""}
                  </span>
                  {o.note ? (
                    <span className="flex max-w-[260px] items-center gap-1 truncate font-medium italic opacity-80" title={o.note}>
                      <StickyNote className="h-3 w-3 shrink-0" strokeWidth={2.4} />
                      <span className="truncate">{o.note}</span>
                    </span>
                  ) : null}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ----------------------- MODALNO OKNO ----------------------- */}
      {detail && detailDay && detailSlot ? (
        <div
          className="no-print fixed inset-0 z-50 flex items-end justify-center bg-[#16202b]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
          onClick={() => {
            setDetail(null);
            setPicking(false);
          }}
        >
          <div
            className="sheet-in w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <DetailHeader
              day={detailDay}
              slot={detailSlot}
              cell={detailCell}
              onClose={() => {
                setDetail(null);
                setPicking(false);
              }}
            />

            <div className="max-h-[52vh] overflow-y-auto px-5 pb-5">
              {!picking ? (
                <>
                  <div className="space-y-3">
                    <InfoRow label="Vrstica" value={`${detailSlot.title}${detailSlot.kind === "break" ? " (odmor)" : ""}`} />
                    <InfoRow label="Čas" value={`${detailSlot.start} – ${detailSlot.end}`} />
                    <InfoRow label="Dan" value={`${detailDay.name}, ${detailDay.dateLabel}`} />

                    {detailCell?.subject ? (
                      <>
                        <InfoRow
                          label="Predmet"
                          value={detailCell.subject.name}
                          accent={subjectColor(detailCell.subject.colorIdx).solid}
                        />
                        <InfoRow label="Kratica" value={detailCell.subject.abbr} />
                      </>
                    ) : detailSlot.kind === "lesson" && !(detailCell?.events.length) ? (
                      <p className="rounded-2xl border border-dashed border-line-strong bg-paper/70 p-4 text-center text-sm text-ink-faint">
                        Ta termin je prost.
                      </p>
                    ) : null}

                    {detailCell?.events.map((ev) => {
                      const pal = eventColor(ev.color);
                      return (
                        <div key={`${ev.id}-${ev.occDate}`}>
                          {ev.cancelled ? (
                            <div className="rounded-2xl border border-line-strong bg-[#eceff2] p-3.5 text-[#6b7480]">
                              <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase">
                                <XCircle className="h-3.5 w-3.5" strokeWidth={2.6} />
                                Odpade
                              </p>
                              <p className="mt-0.5 text-[15px] font-semibold line-through">{ev.title}</p>
                              <p className="mt-1 text-[12px] font-medium line-through opacity-85">
                                {ev.time}
                                {ev.location ? ` · ${ev.location}` : ""}
                              </p>
                              {ev.note ? <EventNote note={ev.note} ink="#6b7480" /> : null}
                              {detailCell.subject ? (
                                <p className="mt-2 text-[12px] font-medium">Ura poteka po urniku.</p>
                              ) : null}
                            </div>
                          ) : (
                            <div className="rounded-2xl p-3.5" style={{ background: pal.soft }}>
                              <p className="text-[11px] font-bold tracking-wide uppercase" style={{ color: pal.ink }}>
                                {detailCell.subject ? "Ura je prekrita z dogodkom" : "Dogodek"}
                              </p>
                              <p className="mt-0.5 text-[15px] font-semibold" style={{ color: pal.ink }}>
                                {ev.title}
                              </p>
                              <p className="mt-1 text-[12px] font-medium" style={{ color: pal.ink, opacity: 0.85 }}>
                                {ev.time}
                                {ev.location ? ` · ${ev.location}` : ""}
                              </p>
                              {ev.note ? <EventNote note={ev.note} ink={pal.ink} /> : null}
                            </div>
                          )}
                          <button
                            disabled={cancelPending}
                            onClick={() => toggleCancelled(ev.id, ev.occDate, !ev.cancelled)}
                            className={cn("btn btn-ghost mt-2 w-full", !ev.cancelled && "!text-[#6b7480]")}
                          >
                            {ev.cancelled ? (
                              <Undo2 className="h-4 w-4" strokeWidth={2.4} />
                            ) : (
                              <XCircle className="h-4 w-4" strokeWidth={2.4} />
                            )}
                            {cancelPending ? "Shranjujem …" : ev.cancelled ? "Povrni dogodek" : "Dogodek odpade"}
                          </button>
                        </div>
                      );
                    })}
                    {detailCell && detailCell.events.length > 0 ? (
                      <p className="text-center text-[11px] text-ink-faint">
                        »Dogodek odpade« velja samo za ta termin — ostale ponovitve ostanejo.
                      </p>
                    ) : null}

                    {detailDay.holiday ? (
                      <div className="rounded-2xl bg-[#ffe3e9] p-3.5 text-[13px] font-semibold text-[#a4123a]">
                        Praznik: {detailDay.holiday}
                      </div>
                    ) : null}
                    {detailDay.breakName ? (
                      <div className="rounded-2xl bg-[#eef8d6] p-3.5 text-[13px] font-semibold text-[#4f7a08]">
                        {detailDay.breakName}
                      </div>
                    ) : null}
                  </div>

                  {detailSlot.kind === "lesson" ? (
                    <button onClick={() => setPicking(true)} className="btn btn-primary mt-5 w-full">
                      {detailCell?.subject ? "Spremeni predmet" : "Dodaj predmet"}
                    </button>
                  ) : null}
                </>
              ) : (
                <div className="space-y-1">
                  <p className="pb-2 text-[11px] font-bold tracking-[0.14em] text-ink-faint uppercase">
                    Izberite predmet
                  </p>
                  {subjects.map((s) => {
                    const p = subjectColor(s.colorIdx);
                    const selected = detailCell?.subject?.id === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => pickSubject(s.id)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13.5px] font-medium transition-colors",
                          selected ? "bg-paper" : "hover:bg-paper",
                        )}
                      >
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.solid }} />
                        <span className="flex-1 truncate">{s.name}</span>
                        <span className="text-[11px] font-bold text-ink-faint">{s.abbr}</span>
                        {selected ? <Check className="h-4 w-4 text-spruce" strokeWidth={3} /> : null}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => pickSubject(null)}
                    className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13.5px] font-medium text-[#d41f45] hover:bg-[#ffe3e9]"
                  >
                    <Eraser className="h-4 w-4" strokeWidth={2.4} />
                    Počisti termin
                  </button>
                  <button onClick={() => setPicking(false)} className="btn btn-ghost mt-3 w-full">
                    Prekliči
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function DetailHeader({
  day,
  slot,
  cell,
  onClose,
}: {
  day: GridDay;
  slot: GridSlot;
  cell: GridCell;
  onClose: () => void;
}) {
  const pal = cell?.subject ? subjectColor(cell.subject.colorIdx) : null;
  const events = cell?.events ?? [];
  const activeEvents = events.filter((e) => !e.cancelled);
  const evPal = eventColor((activeEvents[0] ?? events[0])?.color ?? "amber");
  const onlyEvent = cell !== null && cell.subject === null && events.length > 0;
  const cancelledOnly = onlyEvent && activeEvents.length === 0;

  const gradient = cancelledOnly
    ? "linear-gradient(135deg, #9aa3ad 0%, #66707c 130%)"
    : onlyEvent
    ? `linear-gradient(135deg, ${evPal.solid} 0%, ${evPal.ink} 130%)`
    : pal
      ? `linear-gradient(135deg, ${pal.solid} 0%, ${pal.ink} 130%)`
      : slot.kind === "break"
        ? "linear-gradient(135deg, var(--color-amber) 0%, var(--color-amber-ink) 130%)"
        : "linear-gradient(135deg, #51708f 0%, #334c66 130%)";

  const heading = onlyEvent
    ? events.length === 1
      ? events[0].title
      : `Dogodki (${events.length})`
    : cell?.subject
      ? cell.subject.name
      : slot.kind === "break"
        ? slot.title
        : "Prost termin";

  return (
    <div className="relative px-5 pt-5 pb-4 text-white" style={{ background: gradient }}>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
      >
        <X className="h-4 w-4" strokeWidth={2.6} />
      </button>
      <p className="text-[11px] font-bold tracking-[0.16em] text-white/80 uppercase">
        {day.name} · {day.dateLabel}
      </p>
      <h3
        className={cn(
          "font-display mt-1 pr-10 text-2xl leading-tight font-semibold",
          cancelledOnly && "line-through decoration-2",
        )}
      >
        {heading}
      </h3>
      {cancelledOnly ? (
        <span className="chip mt-2 bg-white/25 text-[11px] font-bold text-white">
          <XCircle className="h-3 w-3" strokeWidth={2.6} />
          Odpade
        </span>
      ) : null}
      <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-white/90">
        <Clock3 className="h-3.5 w-3.5" strokeWidth={2.4} />
        {slot.title} · {slot.start} – {slot.end}
      </p>
    </div>
  );
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper/50 px-3.5 py-2.5">
      <span className="text-[11px] font-bold tracking-wide text-ink-faint uppercase">{label}</span>
      <span className="flex items-center gap-2 text-right text-[13.5px] font-semibold">
        {accent ? <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} /> : null}
        {value}
      </span>
    </div>
  );
}

function SlotRow(props: {
  slot: GridSlot;
  days: GridDay[];
  cells: Record<string, GridCell>;
  mode: "full" | "abbr";
  todayIso: string | null;
  activeSlotId: number | null;
  firstLessonId: number | null;
  onOpen: (wd: number, slotId: number) => void;
}) {
  const { slot, days, cells, mode, todayIso, activeSlotId, firstLessonId, onOpen } = props;
  const isBreak = slot.kind === "break";

  return (
    <>
      {/* oznaka vrstice */}
      <div
        className={cn(
          "border-b border-line px-0.5 text-center sm:px-1.5",
          isBreak ? "bg-amber-soft py-1" : "bg-paper-deep/50 py-2",
        )}
      >
        <p
          className={cn(
            "font-bold tabular-nums",
            isBreak ? "text-[10px] text-amber-ink" : "text-[12px] text-ink sm:text-[13px]",
          )}
          title={slot.title}
        >
          <span className="sm:hidden">{slot.short}</span>
          <span className="hidden sm:inline">{slot.title}</span>
        </p>
        <p
          className={cn(
            "leading-tight tabular-nums",
            isBreak ? "text-[8px] text-amber-ink/80" : "text-[8.5px] text-ink-faint sm:text-[10px]",
          )}
        >
          {slot.start}
          <span className={isBreak ? "" : "hidden sm:inline"}>{isBreak ? "–" : ""}</span>
          <span className={isBreak ? "" : "block"}>{slot.end}</span>
        </p>
      </div>

      {days.map((d) => {
        const cell = cells[`${d.wd}-${slot.id}`] ?? null;
        const isNow = todayIso === d.iso && activeSlotId === slot.id;
        const pal = cell?.subject ? subjectColor(cell.subject.colorIdx) : null;
        const activeEvents = cell?.events.filter((e) => !e.cancelled) ?? [];
        const hasActive = activeEvents.length > 0;
        const evPal = hasActive ? eventColor(activeEvents[0].color) : null;

        // dan brez pouka: počitnice, praznik ali konec šolskega leta
        const offKind: "break" | "holiday" | "ended" | null = d.breakName
          ? "break"
          : d.holiday
            ? "holiday"
            : d.afterYear
              ? "ended"
              : null;
        const offLabel = d.breakName ?? d.holiday ?? (d.afterYear ? "Konec šolskega leta" : null);
        const onVacation = offKind !== null && cell === null;
        const offText = offKind === "holiday" ? "text-[#c21742]" : offKind === "ended" ? "text-[#6b7480]" : "text-[#587f0a]";

        const background = cell
          ? cell.subject
            ? hasActive
              ? evPal!.soft
              : pal!.soft
            : hasActive
              ? evPal!.soft
              : "#eceff2"
          : undefined;

        return (
          <div
            key={d.iso}
            className={cn(
              "relative border-b border-l border-line",
              isBreak ? "p-0.5" : "p-1 sm:p-1.5",
              d.isToday && (isBreak ? "bg-amber-soft/60" : "bg-brand-tint/70"),
              isBreak && !d.isToday && "bg-amber-soft/30",
              offKind === "break" && "bg-[#f1f8dc]",
              offKind === "holiday" && "bg-[#fff0f3]",
              offKind === "ended" && "bg-[#f1f3f5]",
            )}
          >
            <button
              onClick={() => onOpen(d.wd, slot.id)}
              className={cn(
                "flex w-full cursor-pointer flex-col justify-center rounded-lg px-1 text-center transition-all active:scale-[0.97] sm:rounded-xl sm:px-2",
                isBreak ? "min-h-[22px] py-0.5" : "h-full min-h-[52px] py-1 sm:min-h-[64px] sm:py-1.5",
                cell && "hover:shadow-[0_8px_20px_-10px_rgba(22,32,43,0.4)]",
                isNow && "ring-2 ring-amber ring-offset-1 ring-offset-white",
              )}
              style={background ? { background } : undefined}
              title={
                cell
                  ? `${cell.subject ? cell.subject.name : slot.title}${cell.events
                      .map((e) => ` — ${e.title}${e.cancelled ? " (odpade)" : ""}${e.note ? ` (${e.note})` : ""}`)
                      .join("")} · ${slot.start}–${slot.end}`
                  : `${slot.title} · ${slot.start}–${slot.end}`
              }
            >
              {onVacation ? (
                slot.id === firstLessonId ? (
                  <div className={cn("flex flex-col items-center gap-0.5", offText)}>
                    {offKind === "holiday" ? (
                      <Flag className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.2} />
                    ) : offKind === "ended" ? (
                      <CalendarOff className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.2} />
                    ) : (
                      <Palmtree className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.2} />
                    )}
                    <p className="text-[9px] leading-tight font-bold sm:text-[11.5px]">{offLabel}</p>
                  </div>
                ) : (
                  <p
                    className={cn(
                      "text-[13px]",
                      offKind === "holiday" ? "text-[#f3b9c6]" : offKind === "ended" ? "text-[#cfd4da]" : "text-[#c9dd9a]",
                    )}
                  >
                    ·
                  </p>
                )
              ) : cell === null ? (
                <p className={cn(isBreak ? "text-[9px] text-amber-ink/45" : "text-[13px] text-line-strong")}>
                  {isBreak ? slot.title : "·"}
                </p>
              ) : cell.subject && hasActive ? (
                /* predmet, prekrit z dogodki */
                <div className="stripes space-y-1 rounded-md py-0.5">
                  <p className="truncate text-[9.5px] font-medium text-ink-faint line-through sm:text-[11px]">
                    {mode === "full" ? cell.subject.name : cell.subject.abbr}
                  </p>
                  <EventChips events={cell.events} small />
                </div>
              ) : cell.subject ? (
                /* predmet poteka normalno (dogodki so odpadli) */
                <div className="space-y-1">
                  <p
                    className={cn(
                      "leading-tight font-bold",
                      mode === "full"
                        ? "text-[10px] sm:text-[12.5px] sm:font-semibold"
                        : "text-[12px] tracking-wide sm:text-[13px]",
                    )}
                    style={{ color: pal!.ink }}
                  >
                    {mode === "full" ? cell.subject.name : cell.subject.abbr}
                  </p>
                  {cell.events.length > 0 ? <EventChips events={cell.events} small /> : null}
                </div>
              ) : (
                /* samo dogodki — brez predmeta v urniku */
                <EventChips events={cell.events} small={isBreak} />
              )}

              {isNow ? (
                <span className="no-print absolute -top-1.5 left-1/2 z-10 -translate-x-1/2">
                  <span className="chip bg-gradient-to-r from-amber to-amber-2 !px-1.5 !py-0.5 text-[9px] text-white shadow-md sm:!px-2 sm:text-[10px]">
                    <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-white" />
                    Zdaj
                  </span>
                </span>
              ) : null}
            </button>
          </div>
        );
      })}
    </>
  );
}

/** Ikona, ki pove, da ima dogodek opombe (besedilo je v podrobnostih ure). */
function NoteMark() {
  return <StickyNote className="mr-0.5 inline h-2.5 w-2.5 -translate-y-px align-middle opacity-90" strokeWidth={2.6} />;
}

/** Več dogodkov v isti celici: vsak s svojim imenom in časom (največ 4, ostali »+N«). */
function EventChips({ events, small }: { events: GridEvent[]; small?: boolean }) {
  const MAX = 4;
  const shown = events.slice(0, MAX);
  const extra = events.length - shown.length;
  const pill = small
    ? "px-1.5 py-[1px] text-[8.5px] sm:px-2 sm:text-[10px]"
    : "px-1.5 py-0.5 text-[9.5px] sm:px-2 sm:text-[11px]";
  return (
    <div className="space-y-1">
      {shown.map((ev) => {
        const pal = eventColor(ev.color);
        return ev.cancelled ? (
          <div key={`${ev.id}-${ev.occDate}`} className="space-y-0.5">
            <p
              className={cn(
                "mx-auto inline-block max-w-full truncate rounded-full bg-[#c9cfd6] font-bold text-[#6b7480] line-through",
                pill,
              )}
            >
              {ev.note ? <NoteMark /> : null}
              {ev.title}
            </p>
            {ev.clock ? (
              <p className="text-[8px] leading-tight font-semibold text-[#8a939e] tabular-nums line-through sm:text-[9.5px]">
                {ev.clock}
              </p>
            ) : null}
            <p className="text-[8px] font-bold tracking-wide text-[#8a939e] uppercase sm:text-[9px]">Odpade</p>
          </div>
        ) : (
          <div key={`${ev.id}-${ev.occDate}`} className="space-y-0.5">
            <p
              className={cn("mx-auto inline-block max-w-full truncate rounded-full font-bold text-white", pill)}
              style={{ background: pal.solid }}
            >
              {ev.note ? <NoteMark /> : null}
              {ev.title}
            </p>
            {ev.clock ? (
              <p
                className="text-[8px] leading-tight font-semibold tabular-nums sm:text-[9.5px]"
                style={{ color: pal.ink }}
              >
                {ev.clock}
              </p>
            ) : null}
          </div>
        );
      })}
      {extra > 0 ? (
        <p className="text-[8.5px] font-bold text-ink-faint sm:text-[10px]">+{extra} več</p>
      ) : null}
    </div>
  );
}

/** Opombe dogodka v podrobnostih ure. */
function EventNote({ note, ink }: { note: string; ink: string }) {
  return (
    <p
      className="mt-2 flex items-start gap-1.5 rounded-xl bg-white/60 px-2.5 py-2 text-[12.5px] leading-snug whitespace-pre-line"
      style={{ color: ink }}
    >
      <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
      <span>
        <span className="font-bold">Opombe: </span>
        {note}
      </span>
    </p>
  );
}
