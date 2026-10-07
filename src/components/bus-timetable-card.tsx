"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { deleteBusTimetableAction } from "@/app/actions/bus";
import { PdfMenu, type PdfStyle } from "@/components/pdf-menu";
import { exportBusTimetablePdf } from "@/lib/bus-pdf";
import { formatDuration, type TimetableData, type TimetableRow } from "@/lib/bus-timetable";
import { VOZNJA, count } from "@/lib/plural";

type Props = {
  id: number;
  name: string;
  subtitle: string;
  note: string;
  data: TimetableData;
};

function Column({ title, icon, tint, rows }: { title: string; icon: string; tint: string; rows: TimetableRow[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5" style={{ background: tint }}>
        <span className="text-xl" aria-hidden>{icon}</span>
        <h3 className="font-display text-base font-bold">{title}</h3>
        <span className="text-xs text-ink-soft">({count(rows.length, VOZNJA)})</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-faint">Ni vnesenih voženj.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-ink/80 text-left text-xs font-bold text-ink-soft">
                <th className="px-4 py-2.5">Oznaka</th>
                <th className="px-3 py-2.5">Odhod</th>
                <th className="px-3 py-2.5">Prihod</th>
                <th className="px-3 py-2.5">Trajanje</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">{r.label || "—"}</td>
                  <td className="px-3 py-3 font-mono tabular-nums">{r.depart}</td>
                  <td className="px-3 py-3 font-mono tabular-nums">{r.arrive || "–"}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-ink-faint">{formatDuration(r.depart, r.arrive) || "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function BusTimetableCard({ id, name, subtitle, note, data }: Props) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);

  async function exportPdf(style: PdfStyle) {
    setBusy(true);
    try {
      await exportBusTimetablePdf({ name, subtitle, note, style, ...data });
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (!confirm(`Izbrišem vozni red »${name}«?`)) return;
    start(async () => {
      await deleteBusTimetableAction(id);
    });
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-start gap-2">
        <div className="mr-auto min-w-0">
          <h2 className="font-display text-2xl font-semibold break-words">{name}</h2>
          {subtitle ? <p className="text-sm text-ink-soft">{subtitle}</p> : null}
        </div>
        <PdfMenu busy={busy} onPick={exportPdf} className="btn btn-ghost" />
        <Link href={`/avtobus?pogled=redi&vr=${id}`} className="btn btn-primary">
          <Pencil className="h-4 w-4" /> Uredi
        </Link>
        <button type="button" className="icon-btn hover:!bg-[#ffe3e9] hover:!text-[#d41f45]" onClick={remove} disabled={pending} title="Izbriši">
          <Trash2 className="h-4 w-4" strokeWidth={2.2} />
        </button>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Column title="V šolo" icon="🏫" tint="color-mix(in srgb, var(--color-spruce) 10%, var(--color-card))" rows={data.to} />
        <Column title="Iz šole" icon="🏠" tint="color-mix(in srgb, #22c55e 12%, var(--color-card))" rows={data.from} />
      </div>
      {note ? <p className="mt-3 text-xs whitespace-pre-line text-ink-faint italic">{note}</p> : null}
    </section>
  );
}
