"use client";

import { useState, useTransition } from "react";
import { Bell, CalendarPlus, Clock3, Mail, Plus, Repeat, Save, Sun, X } from "lucide-react";
import { saveEventAction } from "@/app/actions/events";
import { EVENT_COLORS, cn } from "@/lib/colors";
import { todayISO } from "@/lib/time";
import { RECURRENCE_OPTIONS } from "@/lib/recurrence";
import { REMINDER_PRESETS, reminderLabel } from "@/lib/reminder-labels";

export type SlotOption = { id: number; period: number; title: string; kind: string; start: string; end: string };
export type KidOption = { id: number; name: string };

export type EventInitial = {
  id: number;
  childId: number | null;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string | null;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  slotId: number | null;
  recurrence: string;
  recurrenceUntil: string | null;
  ignoreYearEnd?: boolean;
  color: string;
  reminders: number[];
} | null;

type TimeMode = "allday" | "manual" | "slot";

export function EventForm({
  kids,
  slotsByChild,
  initial,
  smtpReady,
  defaultDate,
  onSaved,
  onCancel,
}: {
  kids: KidOption[];
  slotsByChild: Record<number, SlotOption[]>;
  initial: EventInitial;
  smtpReady: boolean;
  /** privzeti datum začetka pri novem dogodku (npr. dan, tapnjen v koledarju) */
  defaultDate?: string;
  /** če je podan, obrazec ostane na strani in po shranitvi pokliče to funkcijo */
  onSaved?: () => void;
  /** gumb »Prekliči« (npr. v modalnem oknu) */
  onCancel?: () => void;
}) {
  const embedded = Boolean(onSaved);
  const [saving, startSaving] = useTransition();
  const [childSel, setChildSel] = useState(
    initial?.childId ? String(initial.childId) : kids[0] ? String(kids[0].id) : "all",
  );
  const [timeMode, setTimeMode] = useState<TimeMode>(
    initial ? (initial.allDay ? "allday" : initial.slotId !== null ? "slot" : "manual") : "manual",
  );
  const [recurrence, setRecurrence] = useState(initial?.recurrence ?? "none");
  const [color, setColor] = useState(initial?.color ?? "amber");
  const [reminders, setReminders] = useState<number[]>(initial?.reminders ?? [1440]);
  const [customValue, setCustomValue] = useState("");
  const [customUnit, setCustomUnit] = useState("ura");

  const isAll = childSel === "all";
  const slots = !isAll ? (slotsByChild[Number(childSel)] ?? []) : [];
  const effectiveMode: TimeMode = timeMode === "slot" && (isAll || slots.length === 0) ? "manual" : timeMode;

  const toggleReminder = (m: number) =>
    setReminders((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b)));

  const addCustom = () => {
    const v = Number(customValue);
    if (!Number.isFinite(v) || v <= 0) return;
    const mult = customUnit === "dan" ? 1440 : customUnit === "ura" ? 60 : 1;
    const minutes = Math.round(v * mult);
    if (minutes > 0 && !reminders.includes(minutes)) {
      setReminders((prev) => [...prev, minutes].sort((a, b) => a - b));
    }
    setCustomValue("");
  };

  const TIME_MODES: Array<{ value: TimeMode; label: string; icon: typeof Sun }> = [
    { value: "allday", label: "Cel dan", icon: Sun },
    { value: "manual", label: "Ročni čas", icon: Clock3 },
    { value: "slot", label: "Šolska ura", icon: CalendarPlus },
  ];

  return (
    <form
      action={
        embedded
          ? (fd: FormData) =>
              startSaving(async () => {
                await saveEventAction(fd);
                onSaved?.();
              })
          : saveEventAction
      }
      className={cn("space-y-5", embedded ? "" : "card p-5")}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber to-amber-2 text-white">
          <CalendarPlus className="h-4.5 w-4.5" strokeWidth={2.2} />
        </span>
        <h3 className="font-display text-lg font-semibold">{initial ? "Uredi dogodek" : "Nov dogodek"}</h3>
      </div>

      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      {embedded ? <input type="hidden" name="stay" value="1" /> : null}
      <input type="hidden" name="timeMode" value={effectiveMode} />
      <input type="hidden" name="recurrence" value={recurrence} />
      <input type="hidden" name="color" value={color} />
      {reminders.map((m) => (
        <input key={m} type="hidden" name="reminders" value={m} />
      ))}

      <div>
        <label className="label" htmlFor="title">Naslov</label>
        <input id="title" name="title" required className="input" placeholder="npr. Nogometni trening" defaultValue={initial?.title ?? ""} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="childId">Otrok</label>
          <select id="childId" name="childId" className="input" value={childSel} onChange={(e) => setChildSel(e.target.value)}>
            {kids.map((k) => (
              <option key={k.id} value={k.id}>{k.name}</option>
            ))}
            <option value="all">Vsi otroci (te skupine)</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="location">Kraj</label>
          <input id="location" name="location" className="input" placeholder="neobvezno" defaultValue={initial?.location ?? ""} />
        </div>
      </div>

      {/* --- Datum in trajanje --- */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="startDate">Datum začetka</label>
          <input id="startDate" name="startDate" type="date" required className="input" defaultValue={initial?.startDate ?? defaultDate ?? todayISO()} />
        </div>
        <div>
          <label className="label" htmlFor="endDate">Konec (več dni)</label>
          <input id="endDate" name="endDate" type="date" className="input" defaultValue={initial?.endDate ?? ""} />
        </div>
      </div>

      {/* --- Čas --- */}
      <div>
        <span className="label">Čas dogodka</span>
        <div className="flex rounded-xl border border-line-strong bg-white p-1">
          {TIME_MODES.map((m) => {
            const disabled = m.value === "slot" && (isAll || slots.length === 0);
            return (
              <button
                key={m.value}
                type="button"
                disabled={disabled}
                onClick={() => setTimeMode(m.value)}
                className={cn(
                  "tab-link flex-1 justify-center !px-2 text-[12px]",
                  effectiveMode === m.value && "tab-link-active",
                  disabled && "cursor-not-allowed opacity-40",
                )}
                title={disabled ? "Na voljo samo za posameznega otroka z vnesenimi urami" : undefined}
              >
                <m.icon className="h-3.5 w-3.5" strokeWidth={2.3} />
                {m.label}
              </button>
            );
          })}
        </div>

        {effectiveMode === "manual" ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="startTime">Od</label>
              <input id="startTime" name="startTime" type="time" required className="input tabular-nums" defaultValue={initial?.startTime ?? "16:00"} />
            </div>
            <div>
              <label className="label" htmlFor="endTime">Do</label>
              <input id="endTime" name="endTime" type="time" className="input tabular-nums" defaultValue={initial?.endTime ?? ""} />
            </div>
          </div>
        ) : null}

        {effectiveMode === "slot" ? (
          <div className="mt-3">
            <label className="label" htmlFor="slotId">Katera ura se prekrije</label>
            <select id="slotId" name="slotId" className="input" defaultValue={initial?.slotId ?? ""}>
              <option value="" disabled>Izberite uro …</option>
              {slots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} · {s.start}–{s.end}
                  {s.kind === "break" ? " (odmor)" : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {effectiveMode === "allday" ? (
          <p className="mt-2 text-xs text-ink-faint">Celodnevni dogodek prekrije ves pouk tistega dne.</p>
        ) : null}
      </div>

      {/* --- Ponavljanje --- */}
      <div>
        <span className="label flex items-center gap-1.5">
          <Repeat className="h-3.5 w-3.5" strokeWidth={2.4} />
          Ponavljanje
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {RECURRENCE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setRecurrence(o.value)}
              className={cn(
                "rounded-xl border px-3 py-2 text-left text-[12.5px] font-semibold transition-all",
                recurrence === o.value
                  ? "border-transparent bg-gradient-to-br from-spruce to-spruce-2 text-white shadow-[0_8px_20px_-12px_color-mix(in_srgb,var(--color-spruce)_80%,transparent)]"
                  : "border-line-strong bg-white text-ink-soft hover:border-brand-border hover:bg-brand-tint hover:text-brand-ink",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        {recurrence !== "none" ? (
          <div className="mt-3">
            <label className="label" htmlFor="recurrenceUntil">Ponavljaj do (neobvezno)</label>
            <input id="recurrenceUntil" name="recurrenceUntil" type="date" className="input" defaultValue={initial?.recurrenceUntil ?? ""} />
            <p className="mt-1.5 text-[11.5px] leading-snug text-ink-faint">
              Če datuma ne izberete, se dogodek ponavlja do konca šolskega leta.
            </p>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink-soft">
              <input
                type="checkbox"
                name="ignoreYearEnd"
                defaultChecked={initial?.ignoreYearEnd ?? false}
                className="h-4 w-4 accent-spruce"
              />
              Ponavljaj brez konca (tudi po koncu šolskega leta)
            </label>
          </div>
        ) : null}
      </div>

      {/* --- Opomniki --- */}
      <div>
        <span className="label flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5" strokeWidth={2.4} />
          E-poštni opomniki
        </span>
        <div className="flex flex-wrap gap-1.5">
          {REMINDER_PRESETS.map((p) => (
            <button
              key={p.minutes}
              type="button"
              onClick={() => toggleReminder(p.minutes)}
              className={cn(
                "chip border px-3 py-1.5 text-[11.5px] transition-all",
                reminders.includes(p.minutes)
                  ? "border-transparent bg-gradient-to-br from-amber to-amber-2 text-white"
                  : "border-line-strong bg-white text-ink-soft hover:border-amber/50 hover:bg-amber-soft hover:text-amber-ink",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* poljuben opomnik */}
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="poljubno"
            className="input !w-24 !py-1.5 text-xs"
          />
          <select value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} className="input !w-24 !py-1.5 text-xs">
            <option value="min">minut</option>
            <option value="ura">ur</option>
            <option value="dan">dni</option>
          </select>
          <button type="button" onClick={addCustom} className="btn btn-ghost !px-3 !py-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.6} />
            Dodaj
          </button>
        </div>

        {reminders.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {reminders.map((m) => (
              <span key={m} className="chip bg-amber-soft px-2.5 py-1 text-[11px] text-amber-ink">
                {reminderLabel(m)}
                <button type="button" onClick={() => toggleReminder(m)} className="ml-0.5 rounded-full p-0.5 hover:bg-black/10">
                  <X className="h-3 w-3" strokeWidth={3} />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-ink-faint">Brez opomnikov.</p>
        )}
      </div>

      {/* --- Barva --- */}
      <div>
        <span className="label">Barva</span>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(EVENT_COLORS).map(([key, c]) => (
            <button
              key={key}
              type="button"
              onClick={() => setColor(key)}
              className={cn(
                "chip border px-3 py-1.5 text-xs transition-all hover:brightness-95",
                color === key ? "border-transparent text-white" : "border-line-strong",
              )}
              style={color === key ? { background: c.solid, color: "#fff" } : { background: c.soft, color: c.ink }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="description">Opis</label>
        <textarea id="description" name="description" rows={2} className="input resize-none" placeholder="neobvezno" defaultValue={initial?.description ?? ""} />
      </div>

      <label
        className={cn(
          "flex items-start gap-2.5 rounded-xl border border-line bg-white px-3.5 py-2.5",
          !smtpReady && "opacity-55",
        )}
      >
        <input
          type="checkbox"
          name="notify"
          defaultChecked={smtpReady}
          disabled={!smtpReady}
          className="mt-0.5 h-4 w-4 rounded accent-spruce"
        />
        <span className="text-sm font-medium">
          <span className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" strokeWidth={2.3} />
            {initial ? "Obvesti o spremembi (z .ics)" : "Pošlji e-poštno obvestilo z .ics"}
          </span>
          <span className="block text-xs font-normal text-ink-faint">
            {smtpReady
              ? "Naslovi, ki prejemajo to vrsto obvestil (Nastavitve → Uporabniki)."
              : "Za pošiljanje nastavite SMTP v nastavitvah."}
          </span>
        </span>
      </label>

      <div className="flex gap-2">
        {onCancel ? (
          <button type="button" onClick={onCancel} className="btn btn-ghost" disabled={saving}>
            Prekliči
          </button>
        ) : null}
        <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
          <Save className="h-4 w-4" strokeWidth={2.2} />
          {saving ? "Shranjujem …" : initial ? "Shrani spremembe" : "Dodaj dogodek"}
        </button>
      </div>
    </form>
  );
}
