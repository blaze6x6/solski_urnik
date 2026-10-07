"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, CircleAlert, CircleCheck, KeyRound, Mail } from "lucide-react";
import {
  requestPasswordResetAction,
  resetPasswordWithTokenAction,
  type AuthState,
  type ResetRequestState,
} from "@/app/actions/auth";

const errBox =
  "flex items-center gap-2 rounded-xl border border-[#e6c4ba] bg-[#faeeea] px-4 py-3 text-sm font-medium text-[#a03d2e]";
const okBox =
  "flex items-center gap-2 rounded-xl border border-[#cfe0c8] bg-[#eef5ea] px-4 py-3 text-sm font-medium text-[#3c5f2a]";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<ResetRequestState, FormData>(requestPasswordResetAction, undefined);
  return (
    <form action={formAction} className="mt-8 space-y-5">
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
      <div>
        <label htmlFor="email" className="label">E-pošta računa</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" placeholder="ime@primer.si" />
      </div>
      <button type="submit" className="btn btn-primary w-full py-3 text-sm" disabled={pending}>
        <Mail className="h-4 w-4" strokeWidth={2.2} />
        {pending ? "Pošiljam …" : "Pošlji povezavo"}
      </button>
      <Link href="/login" className="flex items-center justify-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Nazaj na prijavo
      </Link>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(resetPasswordWithTokenAction, undefined);
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
        <label htmlFor="next" className="label">Novo geslo</label>
        <input id="next" name="next" type="password" required minLength={6} autoComplete="new-password" className="input" />
      </div>
      <div>
        <label htmlFor="confirm" className="label">Ponovite geslo</label>
        <input id="confirm" name="confirm" type="password" required minLength={6} autoComplete="new-password" className="input" />
      </div>
      <button type="submit" className="btn btn-primary w-full py-3 text-sm" disabled={pending}>
        <KeyRound className="h-4 w-4" strokeWidth={2.2} />
        {pending ? "Shranjujem …" : "Nastavi geslo"}
      </button>
    </form>
  );
}
