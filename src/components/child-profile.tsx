"use client";

import { useActionState, useState } from "react";
import { CircleAlert, CircleCheck, KeyRound, Trash2, UserRoundCheck } from "lucide-react";
import {
  createChildProfileAction,
  deleteChildProfileAction,
  saveChildPermissionsAction,
  setChildProfilePasswordAction,
  type ProfileState,
} from "@/app/actions/children";
import { DEFAULT_CHILD_PERMS, GRADES_LEVELS, NOTES_LEVELS, type ChildPerms } from "@/lib/child-permissions";

const errBox = "flex items-center gap-2 rounded-xl border border-[#e6c4ba] bg-[#faeeea] px-3 py-2 text-xs font-medium text-[#a03d2e]";
const okBox = "flex items-center gap-2 rounded-xl border border-[#cfe0c8] bg-[#eef5ea] px-3 py-2 text-xs font-medium text-[#3c5f2a]";

/** Nastavitev pravic otroškega profila (polja perm_*). */
export function PermissionsFields({ perms, idPrefix }: { perms: ChildPerms; idPrefix: string }) {
  const check = (name: keyof ChildPerms, label: string, hint?: string) => (
    <label className="flex cursor-pointer items-start gap-2 text-[13px]">
      <input type="checkbox" name={`perm_${name}`} defaultChecked={perms[name] as boolean} className="mt-0.5 h-4 w-4 accent-spruce" />
      <span>
        <span className="font-medium">{label}</span>
        {hint ? <span className="block text-[11px] text-ink-faint">{hint}</span> : null}
      </span>
    </label>
  );
  return (
    <div className="space-y-3 rounded-xl border border-line bg-white p-3">
      <p className="text-[11px] font-bold tracking-[0.12em] text-ink-faint uppercase">Kaj otrok vidi</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {check("pregled", "Pregled")}
        {check("urnik", "Urnik", "samo ogled")}
        {check("koledar", "Koledar", "samo ogled")}
        {check("avtobus", "Avtobus", "samo ogled")}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${idPrefix}-belezke`}>Beležke</label>
          <select id={`${idPrefix}-belezke`} name="perm_belezke" className="input !py-2 text-[13px]" defaultValue={perms.belezke}>
            {NOTES_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`${idPrefix}-ocene`}>Ocene</label>
          <select id={`${idPrefix}-ocene`} name="perm_ocene" className="input !py-2 text-[13px]" defaultValue={perms.ocene}>
            {GRADES_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-[11px] font-bold tracking-[0.12em] text-ink-faint uppercase">Nastavitve</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {check("push", "Push obvestila")}
        {check("geslo", "Sprememba gesla")}
      </div>
      <p className="text-[11px] text-ink-faint">Videz (tema, svetlo/temno) je otroku vedno na voljo.</p>
    </div>
  );
}

/** Polja v obrazcu »Dodaj otroka«: kljukica in geslo za otrokovo prijavo. */
export function NewChildProfileFields() {
  const [on, setOn] = useState(false);
  return (
    <div className="col-span-2 rounded-xl border border-line bg-paper/60 p-3">
      <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold">
        <input
          type="checkbox"
          name="createProfile"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          className="h-4 w-4 accent-spruce"
        />
        <UserRoundCheck className="h-4 w-4 text-spruce" strokeWidth={2.2} />
        Ustvari profil za otroka (prijava)
      </label>
      {on ? (
        <div className="mt-3 space-y-2">
          <p className="text-[11.5px] leading-snug text-ink-faint">
            Otrok se prijavi z zgornjo e-pošto (obvezna) in geslom, ki ga določite tukaj; kasneje ga lahko spremeni
            sam. Pravice (kaj vidi in sme) nastavite spodaj, pozneje pa jih lahko spremenite.
          </p>
          <div>
            <label className="label" htmlFor="profilePassword">Geslo otroka</label>
            <input
              id="profilePassword"
              name="profilePassword"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="input"
              placeholder="min. 6 znakov"
            />
          </div>
          <PermissionsFields perms={DEFAULT_CHILD_PERMS} idPrefix="np" />
        </div>
      ) : null}
    </div>
  );
}

/** Upravljanje otroškega profila pri obstoječem otroku. */
export function ChildProfileSection({
  childId,
  childEmail,
  profile,
}: {
  childId: number;
  childEmail: string;
  /** obstoječi profil (null = profila še ni) */
  profile: { email: string; perms: ChildPerms } | null;
}) {
  const profileEmail = profile?.email ?? null;
  const [permState, permAction, savingPerms] = useActionState<ProfileState, FormData>(saveChildPermissionsAction, undefined);
  const [createState, createAction, creating] = useActionState<ProfileState, FormData>(createChildProfileAction, undefined);
  const [pwState, pwAction, changing] = useActionState<ProfileState, FormData>(setChildProfilePasswordAction, undefined);

  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.14em] text-ink-faint uppercase">
        <UserRoundCheck className="h-3.5 w-3.5" strokeWidth={2.4} />
        Prijava otroka
      </p>

      {profileEmail ? (
        <>
          <p className="text-[13px] text-ink-soft">
            Profil je aktiven. Prijava: <strong className="break-all">{profileEmail}</strong>
          </p>
          <form action={permAction} className="space-y-2">
            <input type="hidden" name="id" value={childId} />
            <PermissionsFields perms={profile!.perms} idPrefix={`p${childId}`} />
            <button className="btn btn-primary !px-3 !py-1.5 text-xs" disabled={savingPerms}>
              {savingPerms ? "Shranjujem …" : "Shrani pravice"}
            </button>
            {permState?.error ? (
              <p className={errBox}><CircleAlert className="h-4 w-4 shrink-0" />{permState.error}</p>
            ) : null}
            {permState?.ok ? (
              <p className={okBox}><CircleCheck className="h-4 w-4 shrink-0" />{permState.ok}</p>
            ) : null}
          </form>
          <form action={pwAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={childId} />
            <div className="min-w-0 flex-1">
              <label className="label" htmlFor={`pw-${childId}`}>Novo geslo otroka</label>
              <input id={`pw-${childId}`} name="password" type="password" required minLength={6} autoComplete="new-password" className="input !py-2" placeholder="min. 6 znakov" />
            </div>
            <button className="btn btn-ghost !px-3 !py-2 text-xs" disabled={changing}>
              <KeyRound className="h-3.5 w-3.5" strokeWidth={2.4} />
              {changing ? "Shranjujem …" : "Nastavi geslo"}
            </button>
          </form>
          {pwState?.error ? (
            <p className={errBox}><CircleAlert className="h-4 w-4 shrink-0" />{pwState.error}</p>
          ) : null}
          {pwState?.ok ? (
            <p className={okBox}><CircleCheck className="h-4 w-4 shrink-0" />{pwState.ok} Otrok je odjavljen z vseh naprav.</p>
          ) : null}
          <form
            action={deleteChildProfileAction}
            onSubmit={(e) => {
              if (!window.confirm("Odstranim otroški profil? Otrok se ne bo mogel več prijaviti; podatki (beležke, ocene) ostanejo.")) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={childId} />
            <button className="btn btn-ghost !px-3 !py-1.5 text-xs !text-[#d41f45]">
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2.4} />
              Odstrani profil
            </button>
          </form>
        </>
      ) : (
        <form action={createAction} className="space-y-2">
          <input type="hidden" name="id" value={childId} />
          <p className="text-[12.5px] text-ink-soft">
            {childEmail
              ? <>Profil bo uporabljal e-pošto <strong className="break-all">{childEmail}</strong>. Geslo določite vi, otrok ga lahko pozneje spremeni.</>
              : "Najprej vnesite e-pošto otroka (zgoraj) in shranite."}
          </p>
          <PermissionsFields perms={DEFAULT_CHILD_PERMS} idPrefix={`nc${childId}`} />
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <label className="label" htmlFor={`np-${childId}`}>Geslo otroka</label>
              <input id={`np-${childId}`} name="password" type="password" required minLength={6} autoComplete="new-password" className="input !py-2" placeholder="min. 6 znakov" disabled={!childEmail} />
            </div>
            <button className="btn btn-primary !px-3 !py-2 text-xs" disabled={creating || !childEmail}>
              <UserRoundCheck className="h-3.5 w-3.5" strokeWidth={2.4} />
              {creating ? "Ustvarjam …" : "Ustvari profil"}
            </button>
          </div>
          {createState?.error ? (
            <p className={errBox}><CircleAlert className="h-4 w-4 shrink-0" />{createState.error}</p>
          ) : null}
          {createState?.ok ? (
            <p className={okBox}><CircleCheck className="h-4 w-4 shrink-0" />{createState.ok}</p>
          ) : null}
        </form>
      )}
    </div>
  );
}
