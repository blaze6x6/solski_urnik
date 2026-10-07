"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowDownUp, ArrowUp, Plus, Trash2 } from "lucide-react";
import { saveBusTimetableAction } from "@/app/actions/bus";
import {
  LIMITS,
  formatDuration,
  normalizeTime,
  sortRows,
  type TimetableData,
  type TimetableRow,
} from "@/lib/bus-timetable";

type Props = { id: number | null; name: string; subtitle: string; note: string; data: TimetableData };
type Dir = "to" | "from";
type Row = TimetableRow & { key: number };

let seq = 1;
const withKeys = (rows: TimetableRow[]): Row[] => rows.map((r) => ({ ...r, key: seq++ }));

export function BusTimetableEditor(props: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(props.name);
  const [subtitle, setSubtitle] = useState(props.subtitle);
  const [note, setNote] = useState(props.note);
  const [rows, setRows] = useState<Record<Dir, Row[]>>(() => ({
    to: withKeys(props.data.to),
    from: withKeys(props.data.from),
  }));
  const [error, setError] = useState<string | null>(null);

  const update = (d: Dir, fn: (r: Row[]) => Row[]) => setRows((s) => ({ ...s, [d]: fn(s[d]) }));
  const patch = (d: Dir, key: number, p: Partial<TimetableRow>) =>
    update(d, (r) => r.map((x) => (x.key === key ? { ...x, ...p } : x)));
  const add = (d: Dir) =>
    update(d, (r) => (r.length >= LIMITS.rows ? r : [...r, { key: seq++, label: "", depart: "", arrive: "" }]));
  const remove = (d: Dir, key: number) => update(d, (r) => r.filter((x) => x.key !== key));
  const move = (d: Dir, i: number, step: -1 | 1) =>
    update(d, (r) => {
      const j = i + step;
      if (j < 0 || j >= r.length) return r;
      const c = [...r];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  const sort = (d: Dir) => update(d, (r) => withKeys(sortRows(r)));

  function save() {
    setError(null);
    const strip = (r: Row[]): TimetableRow[] =>
      r.map((x) => ({ label: x.label, depart: normalizeTime(x.depart), arrive: normalizeTime(x.arrive) }));
    start(async () => {
      const res = await saveBusTimetableAction({
        id: props.id,
        name,
        subtitle,
        note,
        data: { to: strip(rows.to), from: strip(rows.from) },
      });
      if (!res.ok) {
        setError(res.error ?? "Shranjevanje ni uspelo.");
        return;
      }
      router.push("/avtobus?pogled=redi");
      router.refresh();
    });
  }

  const column = (d: Dir, title: string, icon: string) => (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl" aria-hidden>{icon}</span>
        <h3 className="font-display mr-auto text-base font-bold">{title}</h3>
        <button type="button" className="btn btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => sort(d)} title="Razvrsti po času odhoda">
          <ArrowDownUp className="h-3.5 w-3.5" /> Razvrsti
        </button>
      </div>
      <div className="space-y-2">
        {rows[d].length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-faint">Ni vnesenih voženj.</p>
        ) : (
          <div className="hidden grid-cols-[1fr_72px_72px_64px_88px] gap-2 px-1 text-[11px] font-bold text-ink-faint uppercase sm:grid">
            <span>Oznaka</span><span>Odhod</span><span>Prihod</span><span>Trajanje</span><span />
          </div>
        )}
        {rows[d].map((r, i) => (
          <div key={r.key} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_72px_72px_64px_88px]">
            <input
              className="input col-span-2 !px-2.5 !py-1.5 sm:col-span-1"
              value={r.label}
              maxLength={LIMITS.label}
              placeholder="npr. 1. ura"
              onChange={(e) => patch(d, r.key, { label: e.target.value })}
            />
            <input
              className="input !px-2 !py-1.5 text-center font-mono tabular-nums"
              inputMode="numeric"
              value={r.depart}
              placeholder="07:10"
              aria-label="Odhod"
              onChange={(e) => patch(d, r.key, { depart: e.target.value })}
              onBlur={() => patch(d, r.key, { depart: r.depart.trim() ? normalizeTime(r.depart) : "" })}
            />
            <input
              className="input !px-2 !py-1.5 text-center font-mono tabular-nums"
              inputMode="numeric"
              value={r.arrive}
              placeholder="07:20"
              aria-label="Prihod"
              onChange={(e) => patch(d, r.key, { arrive: e.target.value })}
              onBlur={() => patch(d, r.key, { arrive: r.arrive.trim() ? normalizeTime(r.arrive) : "" })}
            />
            <span className="text-xs whitespace-nowrap text-ink-faint">{formatDuration(normalizeTime(r.depart), normalizeTime(r.arrive))}</span>
            <div className="flex justify-end gap-0.5">
              <button type="button" className="icon-btn !h-7 !w-7" onClick={() => move(d, i, -1)} disabled={i === 0} title="Navzgor">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="icon-btn !h-7 !w-7" onClick={() => move(d, i, 1)} disabled={i === rows[d].length - 1} title="Navzdol">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="icon-btn !h-7 !w-7 hover:!bg-[#ffe3e9] hover:!text-[#d41f45]" onClick={() => remove(d, r.key)} title="Odstrani">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-primary mt-3" onClick={() => add(d)}>
        <Plus className="h-4 w-4" /> Dodaj vožnjo
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="card grid gap-4 p-5 md:grid-cols-2">
        <div>
          <label className="label">Naslov</label>
          <input className="input" value={name} maxLength={LIMITS.name} onChange={(e) => setName(e.target.value)} placeholder="npr. Vozni red šolskega avtobusa" />
        </div>
        <div>
          <label className="label">Podnaslov (neobvezno)</label>
          <input className="input" value={subtitle} maxLength={LIMITS.subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="npr. Enak vsak šolski dan" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Opomba na dnu (neobvezno)</label>
          <textarea className="input min-h-20" value={note} maxLength={LIMITS.note} onChange={(e) => setNote(e.target.value)} placeholder="npr. V času počitnic avtobus ne vozi." />
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        {column("to", "V šolo", "🏫")}
        {column("from", "Iz šole", "🏠")}
      </div>
      <p className="text-xs text-ink-faint">Čas lahko vpišete kot 710, 7.10 ali 7:10. Prihod je neobvezen; trajanje se izračuna samo.</p>

      {error ? <p className="rounded-xl bg-[#ffe3e9] px-4 py-3 text-sm font-medium text-[#b3173a]">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={save} disabled={pending}>
          {pending ? "Shranjujem …" : "Shrani vozni red"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => router.push("/avtobus?pogled=redi")}>
          Prekliči
        </button>
      </div>
    </div>
  );
}
