import { redirect } from "next/navigation";
import { CalendarDays, GraduationCap, Bus } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "Prijava" };

const FEATURES = [
  { icon: CalendarDays, text: "Tedenski urniki z označeno trenutno uro" },
  { icon: Bus, text: "Vozni red avtobusa v šolo in nazaj" },
  { icon: GraduationCap, text: "Ocene, beležke in šolski koledar" },
];

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <main className="safe-login flex min-h-dvh">
      {/* Leva, grafična stran */}
      <div className="relative hidden flex-1 overflow-hidden bg-spruce lg:flex">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(60% 55% at 18% 12%, color-mix(in srgb, var(--color-amber) 55%, transparent) 0%, transparent 62%), radial-gradient(55% 60% at 88% 88%, color-mix(in srgb, var(--color-spruce-2) 50%, transparent) 0%, transparent 60%), radial-gradient(70% 80% at 70% 15%, rgba(255,255,255,0.12) 0%, transparent 55%)",
          }}
        />
        <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber text-spruce-deep">
              <CalendarDays className="h-6 w-6" strokeWidth={2.2} />
            </span>
            <div>
              <p className="font-display text-xl font-semibold text-[#fbf9f2]">Šolski urnik</p>
              <p className="text-xs font-medium tracking-[0.18em] text-[#cfe0d4]/80 uppercase">
                zasebno · družinsko
              </p>
            </div>
          </div>

          <div className="max-w-md">
            <h1 className="font-display text-5xl leading-[1.05] font-medium tracking-tight text-[#fbf9f2] xl:text-6xl">
              Vsi urniki vaših otrok.
              <span className="text-amber italic"> Na enem mestu.</span>
            </h1>
            <ul className="mt-10 space-y-4">
              {FEATURES.map((f) => (
                <li key={f.text} className="flex items-center gap-3 text-[#e7eee8]/90">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5">
                    <f.icon className="h-4.5 w-4.5" strokeWidth={2} />
                  </span>
                  <span className="text-sm font-medium">{f.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-[#cfe0d4]/60">
            Prazniki, počitnice in čas pouka — vedno v koraku z današnjim dnem.
          </p>
        </div>
      </div>

      {/* Desna, obrazec */}
      <div className="flex w-full flex-col px-6 pt-12 pb-5 lg:w-[520px] xl:w-[560px]">
        <div className="m-auto w-full max-w-sm py-6">
          <div className="mb-10 lg:hidden">
            <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-spruce text-amber">
              <CalendarDays className="h-6 w-6" strokeWidth={2.2} />
            </span>
            <h1 className="font-display text-3xl font-medium tracking-tight">Šolski urnik</h1>
          </div>

          <h2 className="font-display text-3xl font-medium tracking-tight">Prijava</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Zasebni dostop za administratorja družinskega urnika.
          </p>

          <LoginForm />

        </div>
        <SiteFooter />
      </div>
    </main>
  );
}
