import Link from "next/link";
import { CalendarClock, Check, NotebookPen, Pencil, Pin, PinOff, Trash2, Undo2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getChildren, getNotes, getSubjects } from "@/lib/data";
import { deleteNoteAction, saveNoteAction, togglePinNoteAction, toggleNoteDoneAction } from "@/app/actions/notes";
import { REMIND_OPTIONS, dueText, isDueSoon, remindLabel } from "@/lib/notes";
import { cn, subjectColor } from "@/lib/colors";
import { formatShortSI, todayISO } from "@/lib/time";

export const metadata = { title: "Beležke" };

type SearchParams = { otrok?: string; uredi?: string };

export default async function BelezkePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const kids = await getChildren(user.scope);

  if (kids.length === 0) {
    return (
      <div className="card mx-auto max-w-xl px-8 py-14 text-center">
        <h1 className="font-display text-2xl font-semibold">Ni dodanih otrok</h1>
        <Link href="/nastavitve?tab=otroci" className="btn btn-primary mt-6">Odpri nastavitve</Link>
      </div>
    );
  }

  const selected = kids.find((k) => k.id === Number(sp.otrok)) ?? kids[0];
  const [subjects, rawRows] = await Promise.all([getSubjects(user.scope), getNotes(selected.id)]);
  // opravljene beležke na konec seznama
  const noteRows = [...rawRows.filter((r) => !r.note.done), ...rawRows.filter((r) => r.note.done)];
  const editing = rawRows.find((r) => r.note.id === Number(sp.uredi))?.note ?? null;
  const today = todayISO();

  return (
    <div>
      <header className="mb-6">
        <p className="text-xs font-bold tracking-[0.2em] text-amber-strong uppercase">Hitri zaznamki</p>
        <h1 className="font-display mt-2 text-4xl font-medium tracking-tight">Beležke</h1>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {kids.map((k) => (
          <Link
            key={k.id}
            href={`/belezke?otrok=${k.id}`}
            className={cn("chip-btn", k.id === selected.id && "chip-btn-active")}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: k.color }} />
            {k.name}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div>
          {noteRows.length === 0 ? (
            <div className="card px-6 py-14 text-center">
              <NotebookPen className="mx-auto mb-3 h-8 w-8 text-ink-faint" strokeWidth={1.8} />
              <p className="font-display text-xl font-semibold">Še ni beležk</p>
              <p className="mt-2 text-sm text-ink-soft">Prvo beležko dodajte v obrazcu desno.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {noteRows.map(({ note, subject }) => {
                const pal = subject ? subjectColor(subject.colorIdx) : null;
                return (
                  <article
                    key={note.id}
                    className={cn(
                      "card group relative p-5",
                      note.pinned && !note.done && "border-amber/50 bg-[#fffaf0]",
                      note.done && "opacity-60",
                      editing?.id === note.id && "ring-2 ring-spruce/40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={cn("font-display text-[17px] leading-snug font-semibold", note.done && "line-through")}>{note.title}</h3>
                      {note.pinned ? <Pin className="h-4 w-4 shrink-0 rotate-45 text-amber-strong" strokeWidth={2.4} /> : null}
                    </div>
                    {note.content ? (
                      <p className="mt-2 text-[13px] leading-relaxed whitespace-pre-line text-ink-soft">{note.content}</p>
                    ) : null}
                    {note.dueDate ? (
                      <p
                        className={cn(
                          "mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-bold",
                          note.done
                            ? "bg-paper-deep text-ink-faint"
                            : isDueSoon(note, today)
                              ? "bg-[#ffe9d1] text-[#b35a00]"
                              : "bg-paper-deep text-ink-soft",
                        )}
                      >
                        <CalendarClock className="h-3.5 w-3.5" strokeWidth={2.4} />
                        Rok: <span className="tabular-nums">{formatShortSI(note.dueDate)}</span>
                        {note.done ? <span>· opravljeno</span> : <span>· {dueText(note.dueDate, today)}</span>}
                      </p>
                    ) : null}
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
                        <span className="tabular-nums">{formatShortSI(note.noteDate)}</span>
                        {subject && pal ? (
                          <span
                            className="chip px-2 py-0.5 text-[10px]"
                            style={{ background: pal.soft, color: pal.ink }}
                          >
                            {subject.abbr}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex gap-1">
                        <form action={toggleNoteDoneAction}>
                          <input type="hidden" name="id" value={note.id} />
                          <input type="hidden" name="childId" value={selected.id} />
                          <button className="icon-btn" title={note.done ? "Povrni (ni opravljeno)" : "Označi kot opravljeno"}>
                            {note.done ? (
                              <Undo2 className="h-4 w-4" strokeWidth={2.2} />
                            ) : (
                              <Check className="h-4 w-4" strokeWidth={2.6} />
                            )}
                          </button>
                        </form>
                        <Link href={`/belezke?otrok=${selected.id}&uredi=${note.id}`} className="icon-btn" title="Uredi">
                          <Pencil className="h-4 w-4" strokeWidth={2.2} />
                        </Link>
                        <form action={togglePinNoteAction}>
                          <input type="hidden" name="id" value={note.id} />
                          <input type="hidden" name="childId" value={selected.id} />
                          <button className="icon-btn" title={note.pinned ? "Odpni" : "Pripni"}>
                            {note.pinned ? (
                              <PinOff className="h-4 w-4" strokeWidth={2.2} />
                            ) : (
                              <Pin className="h-4 w-4" strokeWidth={2.2} />
                            )}
                          </button>
                        </form>
                        <form action={deleteNoteAction}>
                          <input type="hidden" name="id" value={note.id} />
                          <input type="hidden" name="childId" value={selected.id} />
                          <button className="rounded-lg p-1.5 text-[#a03d2e] hover:bg-[#faeeea]" title="Izbriši">
                            <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                          </button>
                        </form>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="xl:sticky xl:top-20 xl:self-start">
          <form key={editing?.id ?? "nova"} action={saveNoteAction} className="card space-y-4 p-5">
            <h3 className="font-display text-lg font-semibold">{editing ? "Uredi beležko" : "Nova beležka"}</h3>
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
            <input type="hidden" name="childId" value={selected.id} />
            <div>
              <label className="label" htmlFor="title">Naslov</label>
              <input id="title" name="title" required maxLength={200} className="input" placeholder="npr. Vrniti knjige v knjižnico" defaultValue={editing?.title ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="content">Vsebina</label>
              <textarea id="content" name="content" rows={4} className="input resize-none" placeholder="neobvezno" defaultValue={editing?.content ?? ""} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="noteDate">Datum</label>
                <input id="noteDate" name="noteDate" type="date" required className="input" defaultValue={editing?.noteDate ?? today} />
              </div>
              <div>
                <label className="label" htmlFor="subjectId">Predmet</label>
                <select id="subjectId" name="subjectId" className="input" defaultValue={editing?.subjectId ?? ""}>
                  <option value="">— splošno —</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.abbr} · {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
              <div>
                <label className="label" htmlFor="dueDate">Rok (neobvezno)</label>
                <input id="dueDate" name="dueDate" type="date" className="input" defaultValue={editing?.dueDate ?? ""} />
              </div>
              <div>
                <label className="label" htmlFor="remindDays">Opomni</label>
                <select id="remindDays" name="remindDays" className="input" defaultValue={editing?.remindDays ?? 3}>
                  {REMIND_OPTIONS.map((d) => (
                    <option key={d} value={d}>{remindLabel(d)}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="-mt-2 text-[11.5px] leading-snug text-ink-faint">
              Beležka z rokom se pokaže na pregledu in pošlje opomnik po e-pošti izbrano število dni pred rokom.
            </p>
            <label className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 py-2.5">
              <input type="checkbox" name="pinned" className="h-4 w-4 rounded accent-spruce" defaultChecked={editing?.pinned ?? false} />
              <span className="text-sm font-medium">Pripni na vrh</span>
            </label>
            <button className="btn btn-primary w-full">{editing ? "Shrani spremembe" : "Shrani beležko"}</button>
            {editing ? (
              <Link href={`/belezke?otrok=${selected.id}`} className="btn btn-ghost w-full">
                Prekliči urejanje
              </Link>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
