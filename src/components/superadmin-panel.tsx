"use client";

import { ShieldCheck, Trash2, Users } from "lucide-react";
import { superDeleteUserAction } from "@/app/actions/users";
import type { HouseholdOverview } from "@/lib/data";
import { DOGODEK, OTROK, UPORABNIK, count } from "@/lib/plural";

function DeleteButton({
  id,
  label,
  confirmText,
}: {
  id: number;
  label: string;
  confirmText: string;
}) {
  return (
    <form
      action={superDeleteUserAction}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-danger !px-3 !py-1.5 text-xs">
        <Trash2 className="h-3.5 w-3.5" strokeWidth={2.4} />
        {label}
      </button>
    </form>
  );
}

export function SuperadminPanel({
  households,
  selfId,
}: {
  households: HouseholdOverview[];
  selfId: number;
}) {
  return (
    <div className="space-y-5">
      <div className="card p-6">
        <h2 className="font-display flex items-center gap-2 text-xl font-semibold">
          <ShieldCheck className="h-5 w-5 text-spruce" strokeWidth={2.2} />
          Superadministrator
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Pregled vseh ločenih računov (skupin). Tu lahko odstranite katerega koli drugega
          administratorja ali uporabnika. Odstranitev lastnika skupine izbriše tudi vse
          člane skupine, otroke, urnike, predmete in dogodke.
        </p>
      </div>

      {households.map((h) => {
        const owner = h.people.find((p) => p.isOwner) ?? h.people[0];
        const containsSelf = h.people.some((p) => p.id === selfId);
        return (
          <section key={h.ownerId} className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-line bg-paper-deep/50 px-5 py-3">
              <Users className="h-4 w-4 text-ink-faint" strokeWidth={2.2} />
              <p className="text-sm font-semibold">Skupina: {owner.name}</p>
              <span className="chip bg-white text-[11px] text-ink-soft ring-1 ring-line">
                {count(h.childCount, OTROK)} · {count(h.eventCount, DOGODEK)}
              </span>
              {containsSelf ? (
                <span className="chip bg-amber-soft text-[11px] text-amber-strong">vaša skupina</span>
              ) : null}
            </div>
            <ul className="divide-y divide-line">
              {h.people.map((p) => {
                const isSelf = p.id === selfId;
                const wipesGroup = p.isOwner && h.people.length > 1;
                // lastnika skupine, v kateri je sam član, ne more odstraniti posredno
                const blocked = isSelf || (p.isOwner && containsSelf);
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        {p.name}
                        {p.isSuperadmin ? (
                          <span className="chip bg-[#e3e2fd] text-[10px] text-[#322ca0]">superadmin</span>
                        ) : null}
                        {p.isOwner ? (
                          <span className="chip bg-paper-deep text-[10px] text-ink-soft">lastnik skupine</span>
                        ) : (
                          <span className="chip bg-paper-deep text-[10px] text-ink-soft">član</span>
                        )}
                        {isSelf ? <span className="chip bg-amber-soft text-[10px] text-amber-strong">vi</span> : null}
                      </p>
                      <p className="truncate text-xs text-ink-faint">{p.email}</p>
                    </div>
                    {blocked ? null : (
                      <DeleteButton
                        id={p.id}
                        label={wipesGroup ? "Odstrani skupino" : "Odstrani"}
                        confirmText={
                          wipesGroup
                            ? `Odstranim ${p.name} in vso skupino (${count(h.people.length, UPORABNIK)}, ${count(h.childCount, OTROK)}, vsi dogodki)? Tega ni mogoče razveljaviti.`
                            : p.isOwner
                              ? `Odstranim ${p.name} skupaj z otroki, urniki in dogodki? Tega ni mogoče razveljaviti.`
                              : `Odstranim uporabnika ${p.name}? Tega ni mogoče razveljaviti.`
                        }
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
