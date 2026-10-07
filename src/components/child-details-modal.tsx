"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Building2, CreditCard, GraduationCap, Hash, Home, Mail, MapPin, Phone, X } from "lucide-react";
import { readableOn } from "@/lib/colors";

export type ChildDetails = {
  id: number;
  name: string;
  className: string;
  school: string;
  color: string;
  address: string;
  postalCode: string;
  city: string;
  emso: string;
  taxNumber: string;
  phone: string;
  email: string;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Ovije poljubno vsebino (npr. ime otroka) v gumb, ki ob kliku odpre
 * modalno okno z vsemi podatki otroka.
 */
export function ChildDetailsTrigger({
  child,
  children,
  className,
}: {
  child: ChildDetails;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const postalLine = [child.postalCode, child.city].filter(Boolean).join(" ");
  const rows: Array<{ icon: typeof Home; label: string; value: string; href?: string }> = [
    { icon: GraduationCap, label: "Razred", value: child.className },
    { icon: Building2, label: "Šola", value: child.school },
    { icon: Home, label: "Naslov", value: child.address },
    { icon: MapPin, label: "Pošta in kraj", value: postalLine },
    { icon: Hash, label: "EMŠO", value: child.emso },
    { icon: CreditCard, label: "Davčna številka", value: child.taxNumber },
    { icon: Phone, label: "Telefon", value: child.phone, href: child.phone ? `tel:${child.phone.replace(/[^+\d]/g, "")}` : undefined },
    { icon: Mail, label: "E-pošta", value: child.email, href: child.email ? `mailto:${child.email}` : undefined },
  ];

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} title="Pokaži podatke otroka">
        {children}
      </button>

      {open ? (
        <div
          className="no-print fixed inset-0 z-50 flex items-end justify-center bg-[#16202b]/45 backdrop-blur-[2px] sm:items-center sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="sheet-in w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative px-5 pt-5 pb-4"
              style={{
                background: `linear-gradient(135deg, ${child.color} 0%, ${child.color}cc 130%)`,
                color: readableOn(child.color),
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/25 hover:bg-white/40"
                aria-label="Zapri"
              >
                <X className="h-4 w-4" strokeWidth={2.6} />
              </button>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/25 text-lg font-bold">
                {initials(child.name)}
              </span>
              <h3 className="font-display mt-3 pr-10 text-2xl leading-tight font-semibold">{child.name}</h3>
              <p className="mt-0.5 text-[13px] font-medium opacity-90">
                {[child.className, child.school].filter(Boolean).join(" · ") || "Podatki otroka"}
              </p>
            </div>

            <div className="max-h-[56vh] space-y-2 overflow-y-auto px-5 py-5">
              {rows.map((r) => (
                <div
                  key={r.label}
                  className="flex items-center gap-3 rounded-xl border border-line bg-paper/50 px-3.5 py-2.5"
                >
                  <r.icon className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={2.2} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10.5px] font-bold tracking-wide text-ink-faint uppercase">{r.label}</p>
                    {r.value ? (
                      r.href ? (
                        <a href={r.href} className="block truncate text-[14px] font-semibold text-spruce underline-offset-2 hover:underline">
                          {r.value}
                        </a>
                      ) : (
                        <p className="text-[14px] font-semibold break-words tabular-nums">{r.value}</p>
                      )
                    ) : (
                      <p className="text-[13px] text-ink-faint">—</p>
                    )}
                  </div>
                </div>
              ))}
              <a href="/nastavitve?tab=otroci" className="btn btn-ghost mt-3 w-full">
                Uredi podatke v nastavitvah
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
