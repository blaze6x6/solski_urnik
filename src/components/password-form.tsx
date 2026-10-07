"use client";

import { useActionState } from "react";
import { CircleAlert, KeyRound, ShieldCheck } from "lucide-react";
import { changePasswordAction, type AuthState } from "@/app/actions/auth";

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(changePasswordAction, undefined);

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-soft text-amber-strong">
          <KeyRound className="h-4.5 w-4.5" strokeWidth={2.2} />
        </span>
        <h3 className="font-display text-lg font-semibold">Sprememba gesla</h3>
      </div>

      {state?.error ? (
        <p className="flex items-center gap-2 rounded-xl border border-[#e6c4ba] bg-[#faeeea] px-4 py-3 text-sm font-medium text-[#a03d2e]">
          <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={2.2} />
          {state.error}
        </p>
      ) : null}
      {state && !state.error ? (
        <p className="flex items-center gap-2 rounded-xl border border-[#cfe0c8] bg-[#eef5ea] px-4 py-3 text-sm font-medium text-[#3c5f2a]">
          <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={2.2} />
          Geslo je bilo uspešno spremenjeno.
        </p>
      ) : null}

      <div>
        <label className="label" htmlFor="current">Trenutno geslo</label>
        <input id="current" name="current" type="password" required autoComplete="current-password" className="input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="next">Novo geslo</label>
          <input id="next" name="next" type="password" required minLength={6} autoComplete="new-password" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Ponovite geslo</label>
          <input id="confirm" name="confirm" type="password" required minLength={6} autoComplete="new-password" className="input" />
        </div>
      </div>
      <button className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Shranjujem …" : "Spremeni geslo"}
      </button>
    </form>
  );
}
