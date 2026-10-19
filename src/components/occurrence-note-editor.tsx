"use client";

import { useState, useTransition } from "react";
import { StickyNote } from "lucide-react";
import { setOccurrenceNoteAction } from "@/app/actions/events";

/**
 * »Dodaj/Uredi opombo«. Pri ponavljajočem dogodku velja samo za en termin
 * (npr. GASILCI: »obvezno športna obutev«), pri enkratnem pa je to opis dogodka v meniju Dogodki.
 */
export function OccurrenceNoteEditor({
  eventId,
  occDate,
  recurring,
  baseNote,
  dayNote,
  dateLabel,
  variant,
  onDone,
}: {
  eventId: number;
  occDate: string;
  /** ponavljajoč dogodek: opomba velja samo za ta termin; enkratni: opomba je opis dogodka */
  recurring: boolean;
  /** opis dogodka (iz menija Dogodki) */
  baseNote: string | null;
  /** opomba samo za ta termin (samo ponavljajoči) */
  dayNote: string | null;
  dateLabel: string;
  variant: "chip" | "block";
  /** po uspešnem shranjevanju (npr. osvežitev lokalnega tedna) */
  onDone?: () => Promise<void> | void;
}) {
  // enkratni dogodek: urejamo kar opis dogodka (združimo morebitno starejšo opombo za dan)
  const current = recurring ? dayNote : [baseNote, dayNote].filter(Boolean).join("\n\n") || null;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(current ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = (value: string) =>
    start(async () => {
      const r = await setOccurrenceNoteAction({ eventId, occurrenceDate: occDate, note: value });
      if (r.ok) {
        setEditing(false);
        setError(null);
        await onDone?.();
      } else {
        setError(r.error ?? "Shranjevanje ni uspelo.");
      }
    });

  if (!editing) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setText(current ?? "");
          setError(null);
          setEditing(true);
        }}
        className={
          variant === "chip"
            ? "chip border border-black/10 bg-white/80 px-2.5 py-1 text-[11.5px] font-semibold text-ink-soft hover:bg-white disabled:opacity-50"
            : "btn btn-ghost mt-2 w-full !text-[#6b7480]"
        }
        title={recurring ? "Velja samo za ta termin" : "Opomba je shranjena v dogodku"}
      >
        <StickyNote className={variant === "chip" ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2.4} />
        {current ? "Uredi opombo" : "Dodaj opombo"}
      </button>
    );
  }

  return (
    <div className={variant === "chip" ? "w-full basis-full rounded-xl bg-white/80 p-2.5" : "mt-2 rounded-2xl border border-line bg-white p-3"}>
      <p className="mb-1.5 text-[11px] font-semibold text-ink-soft">
        {recurring ? `Opomba samo za ${dateLabel}` : "Opomba dogodka (shranjena tudi v meniju Dogodki)"}
      </p>
      {recurring && baseNote ? (
        <p className="mb-1.5 rounded-lg bg-black/5 px-2 py-1.5 text-[11.5px] leading-snug whitespace-pre-line text-ink-soft">
          <span className="font-bold">Opomba dogodka: </span>
          {baseNote}
        </p>
      ) : null}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        rows={3}
        autoFocus
        className="input w-full resize-y !py-2 text-[13px]"
        placeholder="npr. obvezno športna obutev"
      />
      {error ? <p className="mt-1.5 text-xs font-medium text-[#b3173a]">{error}</p> : null}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" disabled={pending || !text.trim()} onClick={() => save(text)} className="btn btn-primary !px-3 !py-1.5 text-xs">
          {pending ? "Shranjujem …" : "Shrani"}
        </button>
        <button type="button" disabled={pending} onClick={() => setEditing(false)} className="btn btn-ghost !px-3 !py-1.5 text-xs">
          Prekliči
        </button>
        {current ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => save("")}
            className="btn btn-ghost ml-auto !px-3 !py-1.5 text-xs !text-[#d41f45]"
          >
            {recurring ? "Odstrani opombo za ta dan" : "Odstrani opombo"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
