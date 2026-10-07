import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ForgotPasswordForm } from "@/components/reset-forms";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "Pozabljeno geslo" };

export default async function ForgotPasswordPage() {
  if (await getSessionUser()) redirect("/");
  return (
    <main className="safe-login flex min-h-dvh flex-col px-6 pt-12 pb-5">
      <div className="m-auto w-full max-w-sm py-6">
        <h1 className="font-display text-3xl font-medium tracking-tight">Pozabljeno geslo</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Vnesite e-pošto računa. Poslali vam bomo povezavo za nastavitev novega gesla.
        </p>
        <ForgotPasswordForm />
      </div>
      <SiteFooter />
    </main>
  );
}
