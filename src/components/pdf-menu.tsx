"use client";

import { useRef, useState } from "react";
import { FileDown } from "lucide-react";

export type PdfStyle = "bw" | "color" | "app";

/** Gumb »Izvozi PDF« z izbiro: črno-bel (za tisk) ali barvni (kot v aplikaciji). */
export function PdfMenu({
  busy,
  onPick,
  className,
  compact = false,
}: {
  busy: boolean;
  onPick: (style: PdfStyle) => void;
  className: string;
  /** na ozkem zaslonu samo kratek napis */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // meni se odpre na tisto stran, kjer je več prostora (gumb je lahko levo ali desno na zaslonu)
  const [alignLeft, setAlignLeft] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toggle = () => {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      setAlignLeft(r.left + r.width / 2 < window.innerWidth / 2);
    }
    setOpen((v) => !v);
  };
  const choose = (s: PdfStyle) => {
    setOpen(false);
    onPick(s);
  };
  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" className={className} disabled={busy} title="Izvozi PDF" onClick={toggle} aria-haspopup="menu" aria-expanded={open}>
        <FileDown className="h-4 w-4" strokeWidth={2.2} />
        {compact ? (
          <>
            <span className="hidden sm:inline">{busy ? "Pripravljam …" : "Izvozi PDF"}</span>
            <span className="sm:hidden">{busy ? "…" : "PDF"}</span>
          </>
        ) : (
          <span>{busy ? "Pripravljam …" : "Izvozi PDF"}</span>
        )}
      </button>
      {open ? (
        <>
          <button type="button" aria-label="Zapri" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div role="menu" className={`card absolute z-50 mt-2 w-60 max-w-[calc(100vw-2rem)] overflow-hidden p-1.5 shadow-xl ${alignLeft ? "left-0" : "right-0"}`}>
            <button type="button" role="menuitem" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-paper-deep" onClick={() => choose("bw")}>
              <span className="block font-semibold">Črno-bel</span>
              <span className="block text-xs text-ink-faint">Za tisk, varčen s črnilom</span>
            </button>
            <button type="button" role="menuitem" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-paper-deep" onClick={() => choose("color")}>
              <span className="block font-semibold">Barvni</span>
              <span className="block text-xs text-ink-faint">Poenostavljene barve</span>
            </button>
            <button type="button" role="menuitem" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-paper-deep" onClick={() => choose("app")}>
              <span className="block font-semibold">Kot v aplikaciji</span>
              <span className="block text-xs text-ink-faint">Enak videz, samo ime otroka</span>
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
