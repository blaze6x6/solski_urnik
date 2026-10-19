"use client";

import { useActionState, useState } from "react";
import { Check, CircleAlert, CircleCheck, Copy, Mail, MailPlus, Send, Trash2, X } from "lucide-react";
import {
  deleteRequestAction,
  inviteFromRequestAction,
  rejectRequestAction,
  requestRegistrationAction,
  saveRegistrationSettingsAction,
  type RequestState,
} from "@/app/actions/registration";
import type { InviteResult } from "@/lib/invites";
import type { RegistrationRequestView } from "@/lib/registration";
import { formatShortSI, toISO } from "@/lib/time";

const errBox =
  "flex items-center gap-2 rounded-xl border border-[#e6c4ba] bg-[#faeeea] px-4 py-3 text-sm font-medium text-[#a03d2e]";
const okBox =
  "flex items-center gap-2 rounded-xl border border-[#cfe0c8] bg-[#eef5ea] px-4 py-3 text-sm font-medium text-[#3c5f2a]";

/** Javni obrazec: ime, priimek, e-pošta. */
export function RequestRegistrationForm() {
  const [state, formAction, pending] = useActionState<RequestState, FormData>(requestRegistrationAction, undefined);

  if (state?.ok) {
    return (
      <p className={`${okBox} mt-8`}>
        <CircleCheck className="h-4 w-4 shrink-0" strokeWidth={2.2} />
        {state.ok}
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-5">
      {state?.error ? (
        <p className={errBox}>
          <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={2.2} />
          {state.error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="rq-first" className="label">Ime</label>
          <input id="rq-first" name="firstName" required autoComplete="given-name" maxLength={80} className="input" />
        </div>
        <div>
          <label htmlFor="rq-last" className="label">Priimek</label>
          <input id="rq-last" name="lastName" required autoComplete="family-name" maxLength={80} className="input" />
        </div>
      </div>
      <div>
        <label htmlFor="rq-email" className="label">E-pošta</label>
        <input id="rq-email" name="email" type="email" required autoComplete="email" className="input" placeholder="ime@primer.si" />
      </div>
      {/* past za robote: ljudje polja ne vidijo */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="rq-web">Spletna stran</label>
        <input id="rq-web" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <button type="submit" className="btn btn-primary w-full py-3 text-sm" disabled={pending}>
        <Send className="h-4 w-4" strokeWidth={2.2} />
        {pending ? "Pošiljam …" : "Pošlji zahtevo"}
      </button>
    </form>
  );
}

const STATUS_LABEL = { pending: "čaka", invited: "vabilo poslano", rejected: "zavrnjena" } as const;

function RequestRow({ r }: { r: RegistrationRequestView }) {
  const [state, formAction, pending] = useActionState<InviteResult, FormData>(inviteFromRequestAction, undefined);
  const [copied, setCopied] = useState(false);

  return (
    <li className="space-y-2 rounded-xl border border-line bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">
            {r.firstName} {r.lastName}
            <span
              className={`chip ml-2 text-[10px] ${
                r.status === "pending"
                  ? "bg-amber-soft text-amber-strong"
                  : r.status === "invited"
                    ? "bg-[#d8f8ea] text-[#046c46]"
                    : "bg-paper-deep text-ink-soft"
              }`}
            >
              {STATUS_LABEL[r.status]}
            </span>
          </p>
          <p className="truncate text-[11.5px] text-ink-faint">
            {r.email} · {formatShortSI(toISO(new Date(r.createdAt)))}
          </p>
        </div>
        {r.status !== "rejected" ? (
          <form action={formAction}>
            <input type="hidden" name="id" value={r.id} />
            <button className="btn btn-primary !px-3 !py-1.5 text-xs" disabled={pending}>
              <MailPlus className="h-3.5 w-3.5" strokeWidth={2.3} />
              {pending ? "Pošiljam …" : r.status === "invited" ? "Pošlji znova" : "Pošlji vabilo"}
            </button>
          </form>
        ) : null}
        {r.status === "pending" ? (
          <form action={rejectRequestAction}>
            <input type="hidden" name="id" value={r.id} />
            <button className="btn btn-ghost !px-3 !py-1.5 text-xs">
              <X className="h-3.5 w-3.5" strokeWidth={2.4} />
              Zavrni
            </button>
          </form>
        ) : null}
        <form action={deleteRequestAction}>
          <input type="hidden" name="id" value={r.id} />
          <button className="icon-btn hover:!bg-[#ffe3e9] hover:!text-[#d41f45]" title="Izbriši zahtevo">
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2.3} />
          </button>
        </form>
      </div>
      {state?.error ? <p className="text-xs font-medium text-[#a03d2e]">{state.error}</p> : null}
      {state?.ok ? <p className="text-xs font-medium text-[#3c5f2a]">{state.ok}</p> : null}
      {state?.link ? (
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md bg-paper px-2 py-1 font-mono text-[11px] select-all">{state.link}</code>
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
      ) : null}
    </li>
  );
}

/** Superadmin: nastavitve in seznam zahtev za registracijo. */
export function RegistrationAdmin({
  enabled,
  notify,
  smtpReady,
  requests,
}: {
  enabled: boolean;
  notify: boolean;
  smtpReady: boolean;
  requests: RegistrationRequestView[];
}) {
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  return (
    <div className="card h-fit space-y-4 p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-spruce to-spruce-2 text-white">
          <Mail className="h-4.5 w-4.5" strokeWidth={2.2} />
        </span>
        <h3 className="font-display text-lg font-semibold">Zahteve za registracijo</h3>
      </div>
      <p className="text-sm text-ink-soft">
        Na prijavni strani se lahko prikaže povezava »Zahtevaj registracijo«. Obiskovalec vpiše ime, priimek in e-pošto,
        ti pa zahtevo odobriš s povabilom (nova skupina) ali jo zavrneš.
      </p>

      <form action={saveRegistrationSettingsAction} className="space-y-2 rounded-xl border border-line bg-paper/60 p-3">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium">
          <input type="checkbox" name="enabled" defaultChecked={enabled} className="h-4 w-4 accent-spruce" />
          Prikaži »Zahtevaj registracijo« na prijavni strani
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium">
          <input type="checkbox" name="notify" defaultChecked={notify} className="h-4 w-4 accent-spruce" />
          Obvesti me po e-pošti ob novi zahtevi
        </label>
        {!smtpReady ? (
          <p className="text-[11.5px] text-[#a03d2e]">Pošiljanje e-pošte na strežniku ni nastavljeno — obvestil ne bo.</p>
        ) : null}
        <button className="btn btn-primary !px-4 !py-1.5 text-xs">Shrani</button>
      </form>

      <div>
        <p className="mb-2 text-[11px] font-bold tracking-[0.12em] text-ink-faint uppercase">
          Zahteve ({pendingCount} čaka)
        </p>
        {requests.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong bg-paper/60 px-4 py-3 text-center text-xs text-ink-faint">
            Ni zahtev.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {requests.map((r) => (
              <RequestRow key={r.id} r={r} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
