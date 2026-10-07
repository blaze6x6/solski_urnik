"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/colors";

export type ColorOption = { value: string; label: string; color: string };

/**
 * Izbirnik barve z mrežo barvnih kvadratkov. V obrazec pošlje vrednost
 * prek skritega polja, zato deluje z navadnimi (strežniškimi) obrazci.
 */
export function ColorPicker({
  name,
  options,
  defaultValue,
  className,
}: {
  name: string;
  options: ColorOption[];
  defaultValue: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <div ref={box} className={cn("relative", className)}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input flex w-full items-center gap-2 text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: current.color }} />
        <span className="min-w-0 flex-1 truncate">{current.label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={2.4} />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute left-0 z-40 mt-1.5 grid w-[236px] grid-cols-6 gap-1.5 rounded-2xl border border-line-strong bg-white p-2.5 shadow-xl"
        >
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={selected}
                title={o.label}
                onClick={() => {
                  setValue(o.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 transition-transform hover:scale-110",
                  selected && "ring-2 ring-ink",
                )}
                style={{ background: o.color }}
              >
                {selected ? <Check className="h-4 w-4 text-white drop-shadow" strokeWidth={3.4} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
