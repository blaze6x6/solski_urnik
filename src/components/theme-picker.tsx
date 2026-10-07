"use client";

import { useState, useTransition } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { setModeAction, setThemeAction } from "@/app/actions/theme";
import { MODES, THEMES, type ModeKey } from "@/lib/themes";
import { cn } from "@/lib/colors";

/** Izbirnik barvne teme: sprememba se vidi takoj, shrani pa se za uporabnika. */
export function ThemePicker({ current }: { current: string }) {
  const [selected, setSelected] = useState(current);
  const [pending, startTransition] = useTransition();

  function choose(key: string) {
    if (key === selected) return;
    const previous = selected;
    setSelected(key);
    document.documentElement.dataset.theme = key; // takojšen predogled
    startTransition(async () => {
      try {
        await setThemeAction(key);
      } catch {
        setSelected(previous);
        document.documentElement.dataset.theme = previous;
      }
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {THEMES.map((t) => {
        const active = t.key === selected;
        return (
          <button
            key={t.key}
            type="button"
            disabled={pending}
            onClick={() => choose(t.key)}
            aria-pressed={active}
            className={cn(
              "flex items-center gap-4 rounded-2xl border bg-white p-4 text-left transition-all hover:shadow-md",
              active ? "border-spruce ring-2 ring-spruce/30" : "border-line-strong",
            )}
          >
            <span className="flex shrink-0 -space-x-2">
              {t.preview.map((c) => (
                <span key={c} className="h-9 w-9 rounded-full ring-2 ring-card" style={{ background: c }} />
              ))}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold">{t.label}</span>
              <span className="block text-xs text-ink-soft">{t.description}</span>
            </span>
            {active ? <Check className="h-5 w-5 shrink-0 text-spruce" strokeWidth={3} /> : null}
          </button>
        );
      })}
    </div>
  );
}

const MODE_ICON = { light: Sun, dark: Moon, auto: Monitor } as const;

/** Izbirnik načina videza: svetlo, temno ali po nastavitvi naprave. */
export function ModePicker({ current }: { current: ModeKey }) {
  const [selected, setSelected] = useState<ModeKey>(current);
  const [pending, startTransition] = useTransition();

  function choose(key: ModeKey) {
    if (key === selected) return;
    const previous = selected;
    setSelected(key);
    document.documentElement.dataset.mode = key; // takojšen predogled
    startTransition(async () => {
      try {
        await setModeAction(key);
      } catch {
        setSelected(previous);
        document.documentElement.dataset.mode = previous;
      }
    });
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {MODES.map((m) => {
        const Icon = MODE_ICON[m.key];
        const active = m.key === selected;
        return (
          <button
            key={m.key}
            type="button"
            disabled={pending}
            onClick={() => choose(m.key)}
            aria-pressed={active}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-2xl border bg-white px-2 py-3.5 text-center transition-all hover:shadow-md",
              active ? "border-spruce ring-2 ring-spruce/30" : "border-line-strong",
            )}
          >
            <Icon className={cn("h-5 w-5", active ? "text-spruce" : "text-ink-soft")} strokeWidth={2.2} />
            <span className="text-[13px] font-semibold">{m.label}</span>
            <span className="hidden text-[11px] leading-tight text-ink-soft sm:block">{m.description}</span>
          </button>
        );
      })}
    </div>
  );
}
