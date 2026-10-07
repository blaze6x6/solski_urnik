"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Coffee, ListOrdered, Plus, RotateCcw, Save, Trash2, TriangleAlert } from "lucide-react";
import { saveSlotsLayoutAction } from "@/app/actions/school";
import { cn } from "@/lib/colors";

export type SlotRowData = {
  id: number;
  label: string;
  kind: string;
  start: string;
  end: string;
  showInTimetable: boolean;
};

type Row = {
  /** stabilen ključ za React (obstoječe: id, nove: n1, n2 …) */
  key: string;
  id: number | null;
  label: string;
  kind: "lesson" | "break";
  start: string;
  end: string;
  show: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");
const toMin = (t: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const fromMin = (n: number) => {
  const v = Math.max(0, Math.min(23 * 60 + 59, Math.round(n)));
  return `${pad(Math.floor(v / 60))}:${pad(v % 60)}`;
};

/**
 * Po premiku vrstice ohrani trajanje vsake vrstice in razmike med mesti v seznamu,
 * časi pa se prerazporedijo po novem zaporedju (npr. odmor, premaknjen pred uro).
 */
function reflow(before: Row[], after: Row[]): Row[] {
  const starts = before.map((r) => toMin(r.start));
  const ends = before.map((r) => toMin(r.end));
  if (starts.some((v) => v === null) || ends.some((v) => v === null)) return after;
  const gaps = before.slice(0, -1).map((_, i) => Math.max(0, (starts[i + 1] as number) - (ends[i] as number)));
  const dur = new Map(before.map((r, i) => [r.key, Math.max(1, (ends[i] as number) - (starts[i] as number))]));
  let cur = starts[0] as number;
  return after.map((r, i) => {
    const s = cur;
    const e = s + (dur.get(r.key) ?? 45);
    cur = e + (gaps[i] ?? 0);
    return { ...r, start: fromMin(s), end: fromMin(e) };
  });
}

const NUMBERED = /^\s*\d+\s*\.\s*ura\s*$/i;

export function SlotsEditor({ childId, slots }: { childId: number; slots: SlotRowData[] }) {
  const router = useRouter();
  const initial: Row[] = useMemo(
    () =>
      slots.map((s) => ({
        key: `s${s.id}`,
        id: s.id,
        label: s.label,
        kind: s.kind === "break" ? "break" : "lesson",
        start: s.start,
        end: s.end,
        show: s.showInTimetable,
      })),
    [slots],
  );

  const [rows, setRows] = useState<Row[]>(initial);
  const [counter, setCounter] = useState(1);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const serialize = (list: Row[]) =>
    JSON.stringify(list.map((r) => [r.id, r.label, r.kind, r.start, r.end, r.show]));
  const dirty = serialize(rows) !== serialize(initial);
  const removed = initial.filter((i) => !rows.some((r) => r.id === i.id)).length;

  function patch(key: string, p: Partial<Row>) {
    setStatus(null);
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...p } : r)));
  }

  function move(key: string, dir: -1 | 1) {
    setStatus(null);
    setRows((prev) => {
      const i = prev.findIndex((r) => r.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return reflow(prev, next);
    });
  }

  function remove(key: string) {
    setStatus(null);
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function add(kind: "lesson" | "break", position: "start" | "end") {
    setStatus(null);
    const key = `n${counter}`;
    setCounter((c) => c + 1);
    setRows((prev) => {
      const duration = kind === "break" ? 20 : 45;
      let start: string;
      let end: string;
      if (position === "start") {
        const first = toMin(prev[0]?.start ?? "");
        const e = first !== null ? first - 5 : 7 * 60 + 5;
        end = fromMin(e);
        start = fromMin(e - duration);
      } else {
        const last = toMin(prev[prev.length - 1]?.end ?? "");
        const s = last !== null ? last + 5 : 7 * 60 + 10;
        start = fromMin(s);
        end = fromMin(s + duration);
      }
      const lessonNo =
        prev
          .filter((r) => r.kind === "lesson")
          .map((r) => /^\s*(\d+)\s*\./.exec(r.label)?.[1])
          .filter(Boolean)
          .map(Number)
          .reduce((m, n) => Math.max(m, n), 0) + 1;
      const label = kind === "break" ? "Odmor" : position === "start" ? "Predura" : `${lessonNo}. ura`;
      const row: Row = { key, id: null, label, kind, start, end, show: true };
      return position === "start" ? [row, ...prev] : [...prev, row];
    });
  }

  /** Po premikanju preštevilči učne ure s privzetim imenom »N. ura« (druga imena ostanejo). */
  function renumber() {
    setStatus(null);
    setRows((prev) => {
      let n = 0;
      return prev.map((r) => {
        if (r.kind !== "lesson") return r;
        if (r.label.trim() === "" || NUMBERED.test(r.label)) {
          n += 1;
          return { ...r, label: `${n}. ura` };
        }
        return r;
      });
    });
  }

  function reset() {
    setStatus(null);
    setRows(initial);
  }

  function save() {
    if (removed > 0) {
      const ok = window.confirm(
        `Izbrisal bom ${removed} ${removed === 1 ? "vrstico" : removed === 2 ? "vrstici" : removed <= 4 ? "vrstice" : "vrstic"}. ` +
          "Vpisani predmeti v urniku za te ure bodo odstranjeni. Nadaljujem?",
      );
      if (!ok) return;
    }
    setStatus(null);
    startTransition(async () => {
      const res = await saveSlotsLayoutAction({
        childId,
        slots: rows.map((r) => ({ id: r.id, label: r.label, kind: r.kind, start: r.start, end: r.end, show: r.show })),
      });
      if (res.ok) {
        setStatus({ ok: true, text: "Shranjeno." });
        router.refresh();
      } else {
        setStatus({ ok: false, text: res.error ?? "Shranjevanje ni uspelo." });
      }
    });
  }

  const COLS = "lg:grid-cols-[34px_1fr_140px_104px_104px_72px_112px]";

  return (
    <div className="mt-5">
      <div className={cn("hidden gap-2 px-3 pb-1.5 lg:grid", COLS)}>
        {["#", "Ime vrstice", "Tip", "Od", "Do", "V urniku", "Premakni"].map((h, i) => (
          <span key={i} className="text-[10px] font-bold tracking-[0.12em] text-ink-faint uppercase">
            {h}
          </span>
        ))}
      </div>

      <ul className="space-y-2">
        {rows.length === 0 ? (
          <li className="rounded-xl border border-dashed border-line-strong bg-paper/60 px-4 py-6 text-center text-sm text-ink-faint">
            Ni vrstic. Dodajte uro ali odmor spodaj.
          </li>
        ) : null}
        {rows.map((r, i) => (
          <li
            key={r.key}
            className={cn(
              "grid grid-cols-2 items-center gap-2 rounded-xl border px-3 py-2",
              COLS,
              r.kind === "break" ? "border-[#ffd9b0] bg-[#fff8ef]" : "border-line bg-white",
              !r.show && "opacity-60",
            )}
          >
            <span className="flex items-center gap-2 text-sm font-bold text-ink-faint tabular-nums lg:justify-center">
              {i + 1}
              {r.kind === "break" ? <Coffee className="h-3.5 w-3.5 text-amber-ink lg:hidden" strokeWidth={2.4} /> : null}
              {r.id === null ? (
                <span className="chip bg-brand-tint !px-1.5 !py-0 text-[9px] text-brand-ink lg:hidden">novo</span>
              ) : null}
            </span>

            <input
              value={r.label}
              onChange={(e) => patch(r.key, { label: e.target.value })}
              maxLength={40}
              className="input !py-1.5 max-lg:col-span-2"
              placeholder={r.kind === "break" ? "npr. Malica" : "npr. 1. ura"}
              aria-label={`Ime vrstice ${i + 1}`}
            />

            <select
              value={r.kind}
              onChange={(e) => patch(r.key, { kind: e.target.value === "break" ? "break" : "lesson" })}
              className="input !py-1.5 max-lg:col-span-2"
              aria-label={`Tip vrstice ${i + 1}`}
            >
              <option value="lesson">Učna ura</option>
              <option value="break">Odmor</option>
            </select>

            <input
              type="time"
              required
              value={r.start}
              onChange={(e) => patch(r.key, { start: e.target.value })}
              className="input !py-1.5 tabular-nums"
              aria-label={`Začetek vrstice ${i + 1}`}
            />
            <input
              type="time"
              required
              value={r.end}
              onChange={(e) => patch(r.key, { end: e.target.value })}
              className="input !py-1.5 tabular-nums"
              aria-label={`Konec vrstice ${i + 1}`}
            />

            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-soft lg:justify-center">
              <input
                type="checkbox"
                checked={r.show}
                onChange={(e) => patch(r.key, { show: e.target.checked })}
                className="h-4 w-4 rounded accent-spruce"
              />
              <span className="lg:hidden">Prikaži v urniku</span>
            </label>

            <div className="flex items-center justify-end gap-1 lg:justify-start">
              <button
                type="button"
                onClick={() => move(r.key, -1)}
                disabled={i === 0}
                className="icon-btn border border-line-strong disabled:opacity-30"
                title="Premakni više (prej)"
                aria-label={`Premakni vrstico ${i + 1} više`}
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2.4} />
              </button>
              <button
                type="button"
                onClick={() => move(r.key, 1)}
                disabled={i === rows.length - 1}
                className="icon-btn border border-line-strong disabled:opacity-30"
                title="Premakni niže (pozneje)"
                aria-label={`Premakni vrstico ${i + 1} niže`}
              >
                <ArrowDown className="h-4 w-4" strokeWidth={2.4} />
              </button>
              <button
                type="button"
                onClick={() => remove(r.key)}
                className="icon-btn text-[#d41f45] hover:!bg-[#ffe3e9] hover:!text-[#a4123a]"
                title="Odstrani to vrstico (dokončno šele ob shranjevanju)"
                aria-label={`Odstrani vrstico ${i + 1}`}
              >
                <Trash2 className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Dodajanje */}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
        <button type="button" onClick={() => add("lesson", "start")} className="btn btn-ghost">
          <Plus className="h-4 w-4" strokeWidth={2.4} />
          Dodaj preduro (na vrh)
        </button>
        <button type="button" onClick={() => add("lesson", "end")} className="btn btn-ghost">
          <Plus className="h-4 w-4" strokeWidth={2.4} />
          Dodaj uro (na dno)
        </button>
        <button type="button" onClick={() => add("break", "end")} className="btn btn-amber">
          <Plus className="h-4 w-4" strokeWidth={2.4} />
          Dodaj odmor (na dno)
        </button>
        <button type="button" onClick={renumber} className="btn btn-ghost" title="Učne ure z imenom »N. ura« oštevilči po vrsti">
          <ListOrdered className="h-4 w-4" strokeWidth={2.4} />
          Preštevilči ure
        </button>
      </div>

      {/* Shranjevanje — lepljivo na dnu zaslona, ko so spremembe */}
      <div
        className={cn(
          "sticky bottom-[92px] z-20 mt-4 flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3 shadow-lg transition-colors lg:bottom-4",
          dirty ? "border-amber/60" : "border-line",
        )}
      >
        <button type="button" onClick={save} disabled={pending || !dirty} className="btn btn-primary">
          <Save className="h-4 w-4" strokeWidth={2.2} />
          {pending ? "Shranjujem …" : "Shrani vrstni red"}
        </button>
        <button type="button" onClick={reset} disabled={pending || !dirty} className="btn btn-ghost">
          <RotateCcw className="h-4 w-4" strokeWidth={2.2} />
          Razveljavi
        </button>
        <span className="min-w-0 flex-1 text-xs text-ink-soft">
          {status ? (
            <span className={cn("inline-flex items-center gap-1.5 font-semibold", status.ok ? "text-brand-ink" : "text-[#d41f45]")}>
              {status.ok ? (
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              ) : (
                <TriangleAlert className="h-3.5 w-3.5" strokeWidth={2.6} />
              )}
              {status.text}
            </span>
          ) : dirty ? (
            <span className="font-semibold text-amber-strong">
              Neshranjene spremembe
              {removed > 0 ? ` · za izbris: ${removed}` : ""}
            </span>
          ) : (
            "Vse je shranjeno."
          )}
        </span>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ink-faint">
        Vrstice premikate s puščicama. Ob premiku se trajanja ohranijo, časi pa se prerazporedijo po novem
        zaporedju; po potrebi jih popravite ročno. Vpisani predmeti ostanejo pri svoji uri. Odmori so v urniku
        prikazani kot ozka vrstica čez vse dni. Če kljukico »V urniku« odstranite, vrstica ostane shranjena, a se
        v urniku ne prikaže.
      </p>
    </div>
  );
}
