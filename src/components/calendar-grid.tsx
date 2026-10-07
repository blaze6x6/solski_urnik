"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Flag, Palmtree, Pencil, Plus, Trash2, Undo2, X, XCircle } from "lucide-react";
import Link from "next/link";
import { deleteEventAction, setOccurrenceCancelledAction } from "@/app/actions/events";
import { cn, eventColor } from "@/lib/colors";
import { EventForm, type KidOption, type SlotOption } from "@/components/event-form";
import { useIsTouch, useSwipeNavigation } from "@/components/use-swipe";

export type CalCell = {
  iso: string;
  day: number;
  wd: number;
  inMonth: boolean;
  isToday: boolean;
  holiday: string | null;
  breakName: string | null;
  events: Array<{
    id: number;
    /** pravi id dogodka v bazi */
    eventId: number;
    /** začetni datum te ponovitve (ključ za »odpade«) */
    occDate: string;
    recurring: boolean;
    title: string;
    color: string;
    who: string | null;
    allDay: boolean;
    time: string;
    repeat: string | null;
    range: string;
    cancelled: boolean;
  }>;
};

const DNI_KRATKO = ["P", "T", "S", "Č", "P", "S", "N"];
const DNI_SREDNJE = ["Pon", "Tor", "Sre", "Čet", "Pet", "Sob", "Ned"];

export function CalendarGrid({
  cells,
  prevHref,
  nextHref,
  monthLabel,
  kids,
  slotsByChild,
  smtpReady,
}: {
  cells: CalCell[];
  prevHref: string;
  nextHref: string;
  monthLabel: string;
  kids: KidOption[];
  slotsByChild: Record<number, SlotOption[]>;
  smtpReady: boolean;
}) {
  const router = useRouter();
  const isTouch = useIsTouch();
  const [, startNav] = useTransition();
  // odprt dan hranimo kot datum, da se po shranitvi dogodka prikaže osvežen seznam
  const [openIso, setOpenIso] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, startBusy] = useTransition();
  const open = openIso ? (cells.find((c) => c.iso === openIso) ?? null) : null;

  const close = () => {
    setOpenIso(null);
    setAdding(false);
  };

  const toggleCancelled = (eventId: number, occDate: string, cancelled: boolean) =>
    startBusy(async () => {
      await setOccurrenceCancelledAction({ eventId, occurrenceDate: occDate, cancelled });
    });

  const removeEvent = (eventId: number, title: string, recurring: boolean) => {
    const msg = recurring
      ? `Izbrišem dogodek »${title}« z VSEMI ponovitvami? Tega ni mogoče razveljaviti.\n\n(Če želite odpovedati samo ta termin, uporabite »Odpade«.)`
      : `Izbrišem dogodek »${title}«? Tega ni mogoče razveljaviti.`;
    if (!window.confirm(msg)) return;
    startBusy(async () => {
      const fd = new FormData();
      fd.set("id", String(eventId));
      await deleteEventAction(fd);
    });
  };

  useEffect(() => {
    if (!openIso) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIso]);

  // poteg prsta za menjavo meseca — brez pomika strani na vrh
  const { ref: swipeRef } = useSwipeNavigation<HTMLDivElement>({
    onPrev: () => startNav(() => router.push(prevHref, { scroll: false })),
    onNext: () => startNav(() => router.push(nextHref, { scroll: false })),
    enabled: openIso === null,
  });

  return (
    <>
      <p
        className={cn(
          "no-print mb-2 items-center justify-center gap-1.5 text-[11px] font-medium text-ink-faint",
          isTouch ? "flex" : "hidden",
        )}
      >
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.4} />
        povlecite za menjavo meseca · tapnite dan
        <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.4} />
      </p>

      <div ref={swipeRef} className="card touch-pan-y overflow-hidden p-0">
        <div className="grid grid-cols-7 border-b border-line bg-paper-deep/70">
          {DNI_SREDNJE.map((d, i) => (
            <p
              key={d}
              className={cn(
                "px-1 py-2 text-center text-[10px] font-bold tracking-wider uppercase sm:px-2 sm:py-2.5 sm:text-[11px]",
                i >= 5 ? "text-[#d41f45]" : "text-ink-soft",
              )}
            >
              <span className="sm:hidden">{DNI_KRATKO[i]}</span>
              <span className="hidden sm:inline">{d}</span>
            </p>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-line/70">
          {cells.map((c) => (
            <button
              key={c.iso}
              onClick={() => {
                setAdding(false);
                setOpenIso(c.iso);
              }}
              className={cn(
                "min-h-[62px] bg-card p-1 text-left transition-colors active:bg-paper sm:min-h-[112px] sm:p-2",
                !c.inMonth && "bg-paper/70",
                c.breakName && c.inMonth && "bg-[#f3fadf]",
                c.holiday && c.inMonth && "bg-[#fff0f3]",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[11.5px] font-bold tabular-nums sm:text-[12px]",
                    c.isToday
                      ? "bg-gradient-to-br from-amber to-amber-2 text-white shadow-[0_4px_12px_-4px_color-mix(in_srgb,var(--color-amber)_90%,transparent)]"
                      : c.holiday || c.wd >= 5
                        ? "text-[#d41f45]"
                        : "text-ink",
                    !c.inMonth && "text-ink-faint/60",
                  )}
                >
                  {c.day}
                </span>
                {/* mobilni indikatorji s pikami */}
                {c.events.length > 0 ? (
                  <span className="flex gap-0.5 sm:hidden">
                    {c.events.slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: e.cancelled ? "#b4bcc5" : eventColor(e.color).solid }}
                      />
                    ))}
                  </span>
                ) : null}
              </div>

              {/* mobilno: samo ikone za praznik/počitnice */}
              <div className="mt-0.5 flex gap-1 sm:hidden">
                {c.holiday ? <Flag className="h-2.5 w-2.5 text-[#d41f45]" strokeWidth={3} /> : null}
                {c.breakName && c.inMonth ? <Palmtree className="h-2.5 w-2.5 text-[#5f8c0b]" strokeWidth={3} /> : null}
              </div>

              {/* namizno: polna besedila */}
              <div className="hidden sm:block">
                {c.holiday ? (
                  <p className="mt-0.5 flex items-start gap-1 text-[9.5px] leading-tight font-semibold text-[#c21742]">
                    <Flag className="mt-px h-2.5 w-2.5 shrink-0" strokeWidth={2.6} />
                    <span className="line-clamp-2">{c.holiday}</span>
                  </p>
                ) : null}
                {c.breakName && c.inMonth ? (
                  <p className="mt-0.5 flex items-center gap-1 text-[9.5px] font-semibold text-[#5f8c0b]">
                    <Palmtree className="h-2.5 w-2.5 shrink-0" strokeWidth={2.6} />
                    <span className="truncate">{c.breakName}</span>
                  </p>
                ) : null}
                <div className="mt-1 space-y-0.5">
                  {c.events.slice(0, 3).map((e) => {
                    const pal = e.cancelled
                      ? { soft: "#eceff2", ink: "#6b7480", solid: "#b4bcc5" }
                      : eventColor(e.color);
                    return (
                      <p
                        key={e.id}
                        className={cn(
                          "truncate rounded-md px-1.5 py-[2.5px] text-[9.5px] leading-tight font-bold",
                          e.cancelled && "line-through",
                        )}
                        style={{ background: pal.soft, color: pal.ink }}
                      >
                        {e.who ? <span className="opacity-70">{e.who}: </span> : null}
                        {e.title}
                      </p>
                    );
                  })}
                  {c.events.length > 3 ? (
                    <p className="px-1 text-[9px] font-bold text-ink-faint">+{c.events.length - 3} več</p>
                  ) : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Modalno okno dneva */}
      {open ? (
        <div
          className="no-print fixed inset-0 z-50 flex items-end justify-center bg-[#16202b]/45 backdrop-blur-[2px] sm:items-center sm:p-6"
          onClick={close}
        >
          <div
            className="sheet-in w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative px-5 pt-5 pb-4 text-white"
              style={{
                background: open.holiday
                  ? "linear-gradient(135deg, #f43f5e 0%, #a4123a 130%)"
                  : open.breakName
                    ? "linear-gradient(135deg, #7cb518 0%, #4f7a08 130%)"
                    : "linear-gradient(135deg, var(--color-spruce) 0%, var(--color-spruce-2) 130%)",
              }}
            >
              <button
                onClick={close}
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
              >
                <X className="h-4 w-4" strokeWidth={2.6} />
              </button>
              <p className="text-[11px] font-bold tracking-[0.16em] text-white/80 uppercase">
                {DNI_SREDNJE[open.wd]} · {monthLabel}
              </p>
              <h3 className="font-display mt-1 text-3xl font-semibold">{open.day}.</h3>
              {open.holiday ? <p className="mt-1 text-[13px] font-semibold">{open.holiday}</p> : null}
              {open.breakName ? <p className="mt-1 text-[13px] font-semibold">{open.breakName}</p> : null}
            </div>

            {adding ? (
              <div className="max-h-[68vh] overflow-y-auto px-5 py-5">
                <EventForm
                  key={open.iso}
                  kids={kids}
                  slotsByChild={slotsByChild}
                  initial={null}
                  smtpReady={smtpReady}
                  defaultDate={open.iso}
                  onSaved={() => setAdding(false)}
                  onCancel={() => setAdding(false)}
                />
              </div>
            ) : (
              <div className="max-h-[52vh] overflow-y-auto px-5 py-5">
                <p className="mb-3 text-[11px] font-bold tracking-[0.14em] text-ink-faint uppercase">
                  Dogodki ({open.events.length})
                </p>
              {open.events.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-line-strong bg-paper/70 p-5 text-center text-sm text-ink-faint">
                  Na ta dan ni dogodkov.
                </p>
              ) : (
                <ul className="space-y-2">
                  {open.events.map((e) => {
                    const pal = e.cancelled
                      ? { soft: "#eceff2", ink: "#6b7480", solid: "#b4bcc5" }
                      : eventColor(e.color);
                    return (
                      <li key={e.id} className="rounded-2xl p-3.5" style={{ background: pal.soft }}>
                        <p
                          className={cn("text-[14.5px] font-semibold", e.cancelled && "line-through")}
                          style={{ color: pal.ink }}
                        >
                          {e.title}
                          {e.cancelled ? (
                            <span className="ml-2 text-[10px] font-bold tracking-wide uppercase no-underline">
                              Odpade
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-[11.5px] font-medium" style={{ color: pal.ink, opacity: 0.8 }}>
                          {e.who ?? "Vsi otroci"} · {e.time} · {e.range}
                          {e.repeat ? ` · ponavlja se ${e.repeat}` : ""}
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => toggleCancelled(e.eventId, e.occDate, !e.cancelled)}
                            className="chip border border-black/10 bg-white/80 px-2.5 py-1 text-[11.5px] font-semibold text-ink-soft hover:bg-white disabled:opacity-50"
                            title={e.recurring ? "Velja samo za ta termin" : undefined}
                          >
                            {e.cancelled ? (
                              <Undo2 className="h-3.5 w-3.5" strokeWidth={2.4} />
                            ) : (
                              <XCircle className="h-3.5 w-3.5" strokeWidth={2.4} />
                            )}
                            {e.cancelled ? "Povrni" : "Odpade"}
                          </button>
                          <Link
                            href={`/dogodki?uredi=${e.eventId}`}
                            className="chip border border-black/10 bg-white/80 px-2.5 py-1 text-[11.5px] font-semibold text-ink-soft hover:bg-white"
                          >
                            <Pencil className="h-3.5 w-3.5" strokeWidth={2.4} />
                            Uredi
                          </Link>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => removeEvent(e.eventId, e.title, e.recurring)}
                            className="chip border border-[#fbc9d4] bg-white/80 px-2.5 py-1 text-[11.5px] font-semibold text-[#d41f45] hover:bg-[#ffe3e9] disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={2.4} />
                            Izbriši
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

                {kids.length > 0 ? (
                  <button onClick={() => setAdding(true)} className="btn btn-primary mt-4 w-full">
                    <Plus className="h-4 w-4" strokeWidth={2.6} />
                    Dodaj dogodek
                  </button>
                ) : (
                  <p className="mt-4 text-center text-xs text-ink-faint">
                    Za dodajanje dogodkov najprej dodajte otroka v nastavitvah.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
