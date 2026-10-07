"use client";

import { useActionState, useState } from "react";
import {
  AtSign,
  BellOff,
  BellRing,
  CircleAlert,
  CircleCheck,
  KeyRound,
  Mail,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  addUserEmailAction,
  createUserAction,
  deleteUserAction,
  deleteUserEmailAction,
  resetUserPasswordAction,
  toggleEmailNotifyAction,
  toggleUserNotifyAction,
  updateUserAction,
  type UserFormState,
} from "@/app/actions/users";
import { cn } from "@/lib/colors";

export type PanelEmail = {
  id: number;
  email: string;
  label: string;
  notifyNewEvents: boolean;
  notifyEventChanges: boolean;
  notifyReminders: boolean;
  notifyDigest: boolean;
};

export type PanelUser = {
  id: number;
  name: string;
  email: string;
  notifyEmail: boolean;
  shared: boolean;
  isSelf: boolean;
  isOwner: boolean;
  emails: PanelEmail[];
};

/** Vrste obvestil, ki jih je mogoče vklopiti za posamezen naslov. */
const NOTIFY_FIELDS = [
  { field: "notifyNewEvents", short: "Novi", title: "Novi dogodki" },
  { field: "notifyEventChanges", short: "Spremembe", title: "Spremembe dogodkov" },
  { field: "notifyReminders", short: "Opomniki", title: "Opomniki pred dogodkom" },
  { field: "notifyDigest", short: "Povzetek", title: "Dnevni povzetek in ostalo" },
] as const;

function Alert({ state }: { state: UserFormState }) {
  if (!state) return null;
  if (state.error)
    return (
      <p className="flex items-center gap-2 rounded-xl border border-[#fbc9d4] bg-[#ffe3e9] px-4 py-3 text-sm font-medium text-[#a4123a]">
        <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={2.2} />
        {state.error}
      </p>
    );
  if (state.ok)
    return (
      <p className="flex items-center gap-2 rounded-xl border border-[#aeeccd] bg-[#d8f8ea] px-4 py-3 text-sm font-medium text-[#046c46]">
        <CircleCheck className="h-4 w-4 shrink-0" strokeWidth={2.2} />
        {state.ok}
      </p>
    );
  return null;
}

function UserRow({ u }: { u: PanelUser }) {
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(updateUserAction, undefined);
  const initials = u.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-[13px] font-bold text-white",
            u.isOwner
              ? "bg-gradient-to-br from-[#8b45e8] to-[#4f46e5]"
              : "bg-gradient-to-br from-spruce to-spruce-2",
          )}
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-[14.5px] font-semibold">
            {u.name}
            {u.isSelf ? <span className="chip bg-[#dbeafe] text-[10px] text-[#15539c]">to ste vi</span> : null}
            {u.isOwner ? <span className="chip bg-[#eee3fd] text-[10px] text-[#5c21a8]">lastnik</span> : null}
            {!u.shared ? <span className="chip bg-paper-deep text-[10px] text-ink-soft">ločeni podatki</span> : null}
          </p>
          <p className="truncate text-xs text-ink-soft">{u.email}</p>
        </div>
        <form action={toggleUserNotifyAction}>
          <input type="hidden" name="id" value={u.id} />
          <button
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
              u.notifyEmail
                ? "bg-brand-tint text-brand-ink hover:bg-brand-border/50"
                : "bg-paper text-ink-faint hover:bg-paper-deep hover:text-ink-soft",
            )}
            title={u.notifyEmail ? "E-poštna obvestila: vklopljena" : "E-poštna obvestila: izklopljena"}
          >
            {u.notifyEmail ? <BellRing className="h-4 w-4" strokeWidth={2.2} /> : <BellOff className="h-4 w-4" strokeWidth={2.2} />}
          </button>
        </form>
      </div>

      <form action={formAction} className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2 max-sm:grid-cols-1">
        <input type="hidden" name="id" value={u.id} />
        <input name="name" required defaultValue={u.name} className="input !py-1.5" placeholder="Ime" />
        <input name="email" type="email" required defaultValue={u.email} className="input !py-1.5" placeholder="E-pošta" />
        <button className="btn btn-ghost !px-3 !py-1.5 text-xs" disabled={pending}>
          {pending ? "…" : "Preimenuj"}
        </button>
      </form>
      <div className="mt-2">
        <Alert state={state} />
      </div>

      {/* --- dodatni e-poštni naslovi --- */}
      <div className="mt-3 rounded-xl border border-line bg-paper/50 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em] text-ink-faint uppercase">
          <AtSign className="h-3.5 w-3.5" strokeWidth={2.4} />
          E-poštni naslovi
        </p>

        {/* primarni naslov */}
        <div className="mb-1.5 flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2">
          <Mail className="h-3.5 w-3.5 shrink-0 text-ink-faint" strokeWidth={2.3} />
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{u.email}</span>
          <span className="chip bg-paper-deep text-[10px] text-ink-soft">primarni</span>
          <span
            className={cn(
              "chip text-[10px]",
              u.notifyEmail ? "bg-brand-tint text-brand-ink" : "bg-paper-deep text-ink-faint",
            )}
          >
            {u.notifyEmail ? "vsa obvestila" : "brez obvestil"}
          </span>
        </div>

        {/* dodatni naslovi */}
        {u.emails.map((e) => (
          <div key={e.id} className="mb-1.5 rounded-lg bg-white px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <Mail className="h-3.5 w-3.5 shrink-0 text-ink-faint" strokeWidth={2.3} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{e.email}</span>
              {e.label ? (
                <span className="chip bg-[#dbeafe] text-[10px] text-[#15539c]">{e.label}</span>
              ) : null}
              <form action={deleteUserEmailAction}>
                <input type="hidden" name="id" value={e.id} />
                <button className="icon-btn hover:!bg-[#ffe3e9] hover:!text-[#d41f45]" title="Odstrani naslov">
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2.3} />
                </button>
              </form>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {NOTIFY_FIELDS.map((f) => {
                const on = e[f.field];
                return (
                  <form key={f.field} action={toggleEmailNotifyAction}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="field" value={f.field} />
                    <button
                      title={`${f.title}: ${on ? "vklopljeno" : "izklopljeno"}`}
                      className={cn(
                        "chip border px-2 py-0.5 text-[10px] transition-all",
                        on
                          ? "border-transparent bg-gradient-to-br from-spruce to-spruce-2 text-white"
                          : "border-line-strong bg-white text-ink-faint hover:border-brand-border hover:bg-brand-tint hover:text-brand-ink",
                      )}
                    >
                      {f.short}
                    </button>
                  </form>
                );
              })}
            </div>
          </div>
        ))}

        <AddEmailForm userId={u.id} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <form action={resetUserPasswordAction} className="flex flex-1 items-center gap-2">
          <input type="hidden" name="id" value={u.id} />
          <input
            name="password"
            type="password"
            minLength={6}
            required
            placeholder="Novo geslo (min. 6 znakov)"
            className="input !py-1.5 text-xs"
          />
          <button className="btn btn-ghost !px-3 !py-1.5 text-xs">
            <KeyRound className="h-3.5 w-3.5" strokeWidth={2.4} />
            Ponastavi
          </button>
        </form>
        {!u.isSelf && !u.isOwner ? (
          <form action={deleteUserAction}>
            <input type="hidden" name="id" value={u.id} />
            <button className="btn btn-danger !px-3 !py-1.5 text-xs">
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2.4} />
              Odstrani
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

/** Obrazec za dodajanje novega naslova pri posameznem uporabniku. */
function AddEmailForm({ userId }: { userId: number }) {
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(
    addUserEmailAction,
    undefined,
  );
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="btn btn-ghost mt-1 w-full !py-1.5 text-[11.5px]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.6} />
          Dodaj e-poštni naslov
        </button>
        {state?.ok ? (
          <p className="mt-1.5 text-[11px] font-medium text-[#046c46]">{state.ok}</p>
        ) : null}
      </>
    );
  }

  return (
    <form action={formAction} className="mt-1.5 space-y-2 rounded-lg bg-white p-3">
      <input type="hidden" name="userId" value={userId} />
      {state?.error ? (
        <p className="rounded-lg bg-[#ffe3e9] px-3 py-2 text-[11.5px] font-medium text-[#a4123a]">
          {state.error}
        </p>
      ) : null}
      <div className="grid grid-cols-[1.6fr_1fr] gap-2 max-sm:grid-cols-1">
        <input
          name="email"
          type="email"
          required
          placeholder="naslov@primer.si"
          className="input !py-1.5 text-xs"
        />
        <input name="label" placeholder="oznaka (npr. služba)" className="input !py-1.5 text-xs" />
      </div>
      <div className="flex flex-wrap gap-2">
        {NOTIFY_FIELDS.map((f) => (
          <label key={f.field} className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              name={f.field}
              defaultChecked={f.field !== "notifyDigest"}
              className="h-3.5 w-3.5 rounded accent-spruce"
            />
            <span className="text-[11.5px] font-medium text-ink-soft">{f.title}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary flex-1 !py-1.5 text-xs" disabled={pending}>
          {pending ? "Dodajam …" : "Dodaj naslov"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost !py-1.5 text-xs">
          Prekliči
        </button>
      </div>
    </form>
  );
}

export function UsersPanel({ users }: { users: PanelUser[] }) {
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(createUserAction, undefined);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Administratorji ({users.length})</h2>
        <p className="text-sm text-ink-soft">
          Vsi s skupnim dostopom vidijo iste otroke, urnike, dogodke in ocene.
        </p>
        {users.map((u) => (
          <UserRow key={u.id} u={u} />
        ))}
      </div>

      <form action={formAction} className="card h-fit space-y-4 p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-spruce to-spruce-2 text-white">
            <UserPlus className="h-4.5 w-4.5" strokeWidth={2.2} />
          </span>
          <h3 className="font-display text-lg font-semibold">Dodaj administratorja</h3>
        </div>

        <Alert state={state} />

        <div>
          <label className="label" htmlFor="nu-name">Ime in priimek</label>
          <input id="nu-name" name="name" required className="input" placeholder="npr. Nina Novak" />
        </div>
        <div>
          <label className="label" htmlFor="nu-email">E-pošta</label>
          <input id="nu-email" name="email" type="email" required className="input" placeholder="nina@primer.si" />
        </div>
        <div>
          <label className="label" htmlFor="nu-pass">Začetno geslo</label>
          <input id="nu-pass" name="password" type="password" required minLength={6} className="input" placeholder="min. 6 znakov" />
        </div>

        <label className="flex items-start gap-2.5 rounded-xl border border-line bg-white px-3.5 py-2.5">
          <input type="checkbox" name="shared" defaultChecked className="mt-0.5 h-4 w-4 rounded accent-spruce" />
          <span className="text-sm font-medium">
            Skupni dostop do istih podatkov
            <span className="block text-xs font-normal text-ink-faint">
              Odkljukano pomeni samostojen račun z lastnimi otroki in urniki.
            </span>
          </span>
        </label>

        <button className="btn btn-primary w-full" disabled={pending}>
          <UserPlus className="h-4 w-4" strokeWidth={2.2} />
          {pending ? "Dodajam …" : "Dodaj administratorja"}
        </button>
      </form>
    </div>
  );
}
