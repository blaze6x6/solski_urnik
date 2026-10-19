import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getRegistrationSettings } from "@/lib/app-settings";
import { RequestRegistrationForm } from "@/components/registration-forms";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "Zahtevaj registracijo" };
export const dynamic = "force-dynamic";

export default async function RequestRegistrationPage() {
  if (await getSessionUser()) redirect("/");
  const { enabled } = await getRegistrationSettings();

  return (
    <main className="safe-login flex min-h-dvh flex-col px-6 pt-12 pb-5">
      <div className="m-auto w-full max-w-sm py-6">
        <h1 className="font-display text-3xl font-medium tracking-tight">Zahtevaj registracijo</h1>
        {enabled ? (
          <>
            <p className="mt-2 text-sm text-ink-soft">
              Vnesite ime, priimek in e-pošto. Ko zahtevo pregledamo, vam pošljemo povezavo za ustvarjanje računa.
            </p>
            <RequestRegistrationForm />
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">Zahteve za registracijo trenutno niso omogočene.</p>
        )}
        <Link href="/login" className="btn btn-ghost mt-6 w-full">
          Nazaj na prijavo
        </Link>
      </div>
      <SiteFooter />
    </main>
  );
}
