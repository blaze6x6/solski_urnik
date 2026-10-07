import { CloudOff } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "Ni povezave" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-12">
      <div className="card w-full max-w-md px-8 py-12 text-center">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-spruce to-spruce-2 text-white">
          <CloudOff className="h-7 w-7" strokeWidth={2} />
        </span>
        <h1 className="font-display text-2xl font-semibold">Ni internetne povezave</h1>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-ink-soft">
          Šolski urnik potrebuje povezavo s strežnikom, da prikaže najnovejše podatke. Ko bo povezava
          spet na voljo, osvežite stran.
        </p>
        <a href="/" className="btn btn-primary mt-7">
          Poskusi znova
        </a>
      </div>
      <SiteFooter />
    </main>
  );
}
