"use client";

import { useEffect, useState } from "react";

function format(now: Date): string {
  return now.toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" });
}

/** Živa ura v glavi — posodablja se vsakih 15 s. */
export function LiveClock({ dateLabel }: { dateLabel: string }) {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setTime(format(new Date()));
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft">
      <span className="hidden sm:inline">{dateLabel}</span>
      <span className="hidden h-1 w-1 rounded-full bg-line-strong sm:inline-block" />
      <span className="font-semibold text-ink tabular-nums">{time ?? "—"}</span>
    </span>
  );
}
