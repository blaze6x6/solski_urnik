"use client";

import { useActionState, useState } from "react";
import { Check, CircleAlert, CircleCheck, Copy, KeyRound, MailPlus, Trash2, UserPlus } from "lucide-react";
import {
  acceptInviteAction,
  revokeInviteAction,
  type AcceptState,
  type InviteState,
} from "@/app/actions/invites";
import type { PendingInvite } from "@/lib/invites";
import { formatShortSI, toISO } from "@/lib/time";

const errBox =
  "flex items-center gap-2 rounded-xl border border-[#e6c4ba] bg-[#faeeea] px-4 py-3 text-sm font-medium text-[#a03d2e]";
const okBox =
  "flex items-center gap-2 rounded-xl border border-[#cfe0c8] bg-[#eef5ea] px-4 py-3 text-sm font-medium text-[#3c5f2a]";

/** Obrazec »Povabi po e-pošti« (isti za novo skupino in za člana skupine). */
export function InviteForm({
  action,
  title,
  description,
  invites,
  emptyText,
}: {
  action: (prev: InviteState, formData: FormData) => Promise<InviteState>;
  title: string;
  description: string;
  invites: PendingInvite[];
  emptyText: string;
}) {
  const [state, formAction, pending] = useActionState<InviteState, FormData>(action, undefined);
  const [copied, setCopied] = useState(false);

  return (
    <div className="card h-fit space-y-4 p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-spruce to-spruce-2 text-white">
          <MailPlus className="h-4.5 w-4.5" strokeWidth={2.2} />
        </span>
        <h3 className="font-display text-lg font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-ink-soft">{description}</p>

      {state?.error ? (
        <p className={errBox}>
          <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={2.2} />
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className={okBox}>
          <CircleCheck className="h-4 w-4 shrink-0" strokeWidth={2.2} />
          {state.ok}
        </p>
      ) : null}
      {state?.link ? (
        <div className="rounded-xl border border-line bg-paper/60 p-3">
          <p className="mb-1.5 text-[11px] font-bold tracking-[0.12em] text-ink-faint uppercase">Povezava do vabila</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-white px-2 py-1 font-mono text-[11.5px] select-all">
              {state.link}
            </code>
            <button
              type="button"
              className="icon-btn !h-7 !w-7"
              title="Kopiraj"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(state.link!);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {}
              }}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      ) : null}

      <form action={formAction} className="space-y-3">
        <div>
          <label className="label" htmlFor="inv-email">E-pošta povabljenca</label>
          <input id="inv-email" name="email" type="email" required className="input" placeholder="ime@primer.si" />
        </div>
        <button className="btn btn-primary w-full" disabled={pending}>
          <UserPlus className="h-4 w-4" strokeWidth={2.2} />
          {pending ? "Pošiljam …" : "Pošlji vabilo"}
        </button>
      </form>

      <div>
        <p className="mb-2 text-[11px] font-bold tracking-[0.12em] text-ink-faint uppercase">
          Čakajoča vabila ({invites.length})
        </p>
        {invites.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong bg-paper/60 px-4 py-3 text-center text-xs text-ink-faint">
            {emptyText}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{i.email}</p>
                  <p className="text-[11px] text-ink-faint">
                    povabil/a {i.invitedByName} · velja do {formatShortSI(toISO(new Date(i.expiresAt)))}
                  </p>
                </div>
                <form action={revokeInviteAction}>
                  <input type="hidden" name="id" value={i.id} />
                  <button className="icon-btn hover:!bg-[#ffe3e9] hover:!text-[#d41f45]" title="Prekliči vabilo">
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2.3} />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Registracijski obrazec na strani /vabilo. */
export function AcceptInviteForm({ token, email, defaultName = "" }: { token: string; email: string; defaultName?: string }) {
  const [state, formAction, pending] = useActionState<AcceptState, FormData>(acceptInviteAction, undefined);
  return (
    <form action={formAction} className="mt-8 space-y-5">
      <input type="hidden" name="token" value={token} />
      {state?.error ? (
        <p className={errBox}>
          <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={2.2} />
          {state.error}
        </p>
      ) : null}
      <div>
        <label htmlFor="av-email" className="label">E-pošta</label>
        <input id="av-email" type="email" value={email} readOnly className="input !bg-paper text-ink-soft" />
      </div>
      <div>
        <label htmlFor="av-name" className="label">Ime in priimek</label>
        <input id="av-name" name="name" required autoComplete="name" className="input" placeholder="npr. Nina Novak" defaultValue={defaultName} />
      </div>
      <div>
        <label htmlFor="av-pass" className="label">Geslo</label>
        <input id="av-pass" name="password" type="password" required minLength={6} autoComplete="new-password" className="input" placeholder="min. 6 znakov" />
      </div>
      <div>
        <label htmlFor="av-conf" className="label">Ponovite geslo</label>
        <input id="av-conf" name="confirm" type="password" required minLength={6} autoComplete="new-password" className="input" />
      </div>
      <button type="submit" className="btn btn-primary w-full py-3 text-sm" disabled={pending}>
        <KeyRound className="h-4 w-4" strokeWidth={2.2} />
        {pending ? "Ustvarjam račun …" : "Ustvari račun"}
      </button>
    </form>
  );
}
