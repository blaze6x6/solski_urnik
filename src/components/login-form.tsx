"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, LogIn } from "lucide-react";
import { loginAction, type AuthState } from "@/app/actions/auth";

export function LoginForm({ resetDone = false }: { resetDone?: boolean }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(loginAction, undefined);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      {resetDone && !state?.error ? (
        <p className="flex items-center gap-2 rounded-xl border border-[#cfe0c8] bg-[#eef5ea] px-4 py-3 text-sm font-medium text-[#3c5f2a]">
          <CircleCheck className="h-4 w-4 shrink-0" strokeWidth={2.2} />
          Geslo je spremenjeno. Prijavite se z novim geslom.
        </p>
      ) : null}
      {state?.error ? (
        <p className="flex items-center gap-2 rounded-xl border border-[#e6c4ba] bg-[#faeeea] px-4 py-3 text-sm font-medium text-[#a03d2e]">
          <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={2.2} />
          {state.error}
        </p>
      ) : null}

      <div>
        <label htmlFor="email" className="label">
          E-pošta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          placeholder="admin@urnik.si"
        />
      </div>

      <div>
        <label htmlFor="password" className="label">
          Geslo
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
          placeholder="••••••••"
        />
      </div>

      <div className="-mt-2 text-right">
        <Link href="/pozabljeno" className="text-xs font-semibold text-spruce hover:underline">
          Pozabljeno geslo?
        </Link>
      </div>

      <button type="submit" className="btn btn-primary w-full py-3 text-sm" disabled={pending}>
        <LogIn className="h-4 w-4" strokeWidth={2.2} />
        {pending ? "Prijavljam …" : "Prijavi se"}
      </button>
    </form>
  );
}
