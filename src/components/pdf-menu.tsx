"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";

export type PdfStyle = "bw" | "color";

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
  const choose = (s: PdfStyle) => {
    setOpen(false);
    onPick(s);
  };
  return (
    <div className="relative shrink-0">
      <button type="button" className={className} disabled={busy} title="Izvozi PDF" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
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
          <div role="menu" className="card absolute right-0 z-50 mt-2 w-60 overflow-hidden p-1.5 shadow-xl">
            <button type="button" role="menuitem" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-paper-deep" onClick={() => choose("bw")}>
              <span className="block font-semibold">Črno-bel</span>
              <span className="block text-xs text-ink-faint">Za tisk, varčen s črnilom</span>
            </button>
            <button type="button" role="menuitem" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-paper-deep" onClick={() => choose("color")}>
              <span className="block font-semibold">Barvni</span>
              <span className="block text-xs text-ink-faint">Kot ga prikazuje aplikacija</span>
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
