"use client";

import { useEffect } from "react";
import { MapPin, StickyNote, X } from "lucide-react";
import { cn, eventColor } from "@/lib/colors";

export type EventNoteData = {
  title: string;
  color: string;
  cancelled?: boolean;
  /** npr. "15:00–16:30 · 12. oktober" */
  when?: string | null;
  location?: string | null;
  note: string;
};

/** Modalno okno z vsebino opombe dogodka (besedilo se prelomi, nič ne uhaja z zaslona). */
export function EventNoteModal({ data, onClose }: { data: EventNoteData; onClose: () => void }) {
  const pal = data.cancelled ? { soft: "#eceff2", ink: "#6b7480", solid: "#b4bcc5" } : eventColor(data.color);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div
      className="no-print fixed inset-0 z-[60] flex items-end justify-center bg-[#16202b]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Opombe: ${data.title}`}
    >
      <div
        className="sheet-in w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-5 pt-5 pb-4" style={{ background: pal.soft, color: pal.ink }}>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/70 hover:bg-white"
            aria-label="Zapri"
          >
            <X className="h-4 w-4" strokeWidth={2.4} />
          </button>
          <p className="pr-10 text-[11px] font-bold tracking-wide uppercase opacity-80">
            {data.cancelled ? "Dogodek odpade" : "Dogodek"}
          </p>
          <p className={cn("mt-0.5 pr-8 text-[17px] leading-snug font-semibold", data.cancelled && "line-through")}>
            {data.title}
          </p>
          {data.when ? <p className="mt-1 pr-10 text-[12.5px] font-medium opacity-85">{data.when}</p> : null}
          {data.location ? (
            <p className="mt-1 flex items-center gap-1 pr-10 text-[12.5px] font-medium opacity-85">
              <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
              {data.location}
            </p>
          ) : null}
        </div>
        <div className="max-h-[55vh] overflow-y-auto px-5 py-5">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.14em] text-ink-faint uppercase">
            <StickyNote className="h-3.5 w-3.5" strokeWidth={2.4} />
            Opombe
          </p>
          <p className="text-[14px] leading-relaxed break-words whitespace-pre-line">{data.note}</p>
          <button type="button" onClick={onClose} className="btn btn-ghost mt-5 w-full">
            Zapri
          </button>
        </div>
      </div>
    </div>
  );
}
