"use client";

import { useState } from "react";
import { BusFront, Save } from "lucide-react";
import { saveBusRouteAction } from "@/app/actions/bus";
import { cn } from "@/lib/colors";
import { DNEVI_3 } from "@/lib/time";

export type BusFormRoute = {
  id: number;
  childId: number;
  direction: string;
  stop: string;
  /** odhod */
  time: string;
  /** prihod (neobvezno) */
  arrivalTime: string | null;
  days: number[];
  note: string;
} | null;

export function BusForm({
  childId,
  route,
}: {
  childId: number;
  route: BusFormRoute;
}) {
  const [days, setDays] = useState<number[]>(route?.days ?? [0, 1, 2, 3, 4]);
  const [direction, setDirection] = useState(route?.direction ?? "to");

  const toggle = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  return (
    <form action={saveBusRouteAction} className="card space-y-4 p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-soft text-amber-strong">
          <BusFront className="h-4.5 w-4.5" strokeWidth={2.2} />
        </span>
        <h3 className="font-display text-lg font-semibold">
          {route ? "Uredi avtobus" : "Dodaj avtobus"}
        </h3>
      </div>

      {route ? <input type="hidden" name="id" value={route.id} /> : null}
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="direction" value={direction} />

      <div>
        <span className="label">Smer</span>
        <div className="flex rounded-full border border-line-strong bg-white p-1">
          {[
            { v: "to", l: "V šolo" },
            { v: "from", l: "Iz šole" },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setDirection(o.v)}
              className={cn("tab-link flex-1 justify-center", direction === o.v && "tab-link-active")}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="time">
            Odhod
          </label>
          <input id="time" name="time" type="time" required className="input" defaultValue={route?.time ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="arrivalTime">
            Prihod
          </label>
          <input
            id="arrivalTime"
            name="arrivalTime"
            type="time"
            className="input"
            defaultValue={route?.arrivalTime ?? ""}
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="stop">
          Postaja
        </label>
        <input id="stop" name="stop" className="input" placeholder="npr. Trg mladosti" defaultValue={route?.stop ?? ""} />
      </div>

      <div>
        <span className="label">Dnevi</span>
        <div className="flex flex-wrap gap-1.5">
          {DNEVI_3.slice(0, 5).map((d, i) => (
            <label key={d} className="cursor-pointer">
              <input
                type="checkbox"
                name="days"
                value={i}
                checked={days.includes(i)}
                onChange={() => toggle(i)}
                className="peer sr-only"
              />
              <span className="chip border border-line-strong bg-white px-3 py-1.5 text-xs text-ink-soft transition-all peer-checked:border-transparent peer-checked:bg-spruce peer-checked:text-[#fbf9f2]">
                {d}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="note">
          Opomba
        </label>
        <input id="note" name="note" className="input" placeholder="neobvezno" defaultValue={route?.note ?? ""} />
      </div>

      <button type="submit" className="btn btn-primary w-full" disabled={days.length === 0}>
        <Save className="h-4 w-4" strokeWidth={2.2} />
        {route ? "Shrani spremembe" : "Dodaj avtobus"}
      </button>
    </form>
  );
}
