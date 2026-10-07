"use client";

import { useCallback, useEffect, useState } from "react";
import { Apple, Download, Share, SquarePlus, X } from "lucide-react";
import { cn } from "@/lib/colors";

// ---------------------------------------------------------------------------
// Tipi za dogodek namestitve (ni v standardnih TS tipih)
// ---------------------------------------------------------------------------

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "urnik_namestitev_skrita";

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

/** Ali aplikacija že teče kot nameščena (standalone)? */
function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone === true;
}

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIPad = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || isIPad;
}

// ---------------------------------------------------------------------------
// Skupno stanje namestitve
// ---------------------------------------------------------------------------

export function useInstallState() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStandalone(detectStandalone());
    setIsIOS(detectIOS());
    setReady(true);

    const onPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {
        /* prezri */
      }
    };
    const mq = window.matchMedia("(display-mode: standalone)");
    const onMode = () => setStandalone(detectStandalone());

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    mq.addEventListener("change", onMode);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      mq.removeEventListener("change", onMode);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return "unavailable" as const;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setDeferred(null);
    return choice.outcome;
  }, [deferred]);

  return { canInstall: deferred !== null, install, standalone, isIOS, installed, ready };
}

// ---------------------------------------------------------------------------
// Registracija service workerja
// ---------------------------------------------------------------------------

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.warn("[pwa] registracija ni uspela:", err));
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);
  return null;
}

// ---------------------------------------------------------------------------
// Plavajoč poziv k namestitvi (mobilno)
// ---------------------------------------------------------------------------

export function InstallBanner() {
  const { canInstall, install, standalone, isIOS, ready } = useInstallState();
  const [hidden, setHidden] = useState(true);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (!ready) return;
    try {
      setHidden(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, [ready]);

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* prezri */
    }
  };

  if (!ready || standalone || hidden) return null;
  // na iOS pokažemo navodila, drugje samo ko brskalnik ponudi namestitev
  if (!canInstall && !isIOS) return null;

  return (
    <>
      <div className="safe-banner no-print fixed z-40 lg:hidden">
        <div className="flex items-center gap-3 rounded-2xl border border-brand-border bg-white p-3 shadow-[0_18px_44px_-20px_color-mix(in_srgb,var(--color-spruce)_50%,transparent)]">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-spruce to-spruce-2 text-white">
            <Download className="h-5 w-5" strokeWidth={2.3} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] leading-tight font-bold">Namesti kot aplikacijo</p>
            <p className="text-[11.5px] leading-tight text-ink-soft">
              Hiter dostop z domačega zaslona, brez naslovne vrstice.
            </p>
          </div>
          <button
            onClick={() => (isIOS ? setShowIosHelp(true) : install())}
            className="btn btn-primary shrink-0 !px-3.5 !py-2 text-xs"
          >
            Namesti
          </button>
          <button onClick={dismiss} className="icon-btn shrink-0" aria-label="Skrij">
            <X className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>
      </div>

      {showIosHelp ? <IosHelpSheet onClose={() => setShowIosHelp(false)} /> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Navodila za iPhone/iPad
// ---------------------------------------------------------------------------

export function IosHelpSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-end justify-center bg-[#16202b]/45 backdrop-blur-[2px] sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="sheet-in w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-gradient-to-br from-spruce to-spruce-2 px-5 pt-5 pb-4 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
          >
            <X className="h-4 w-4" strokeWidth={2.6} />
          </button>
          <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.16em] uppercase opacity-85">
            <Apple className="h-3.5 w-3.5" strokeWidth={2.4} />
            iPhone / iPad
          </p>
          <h3 className="font-display mt-1 pr-10 text-2xl font-semibold">Dodaj na domači zaslon</h3>
        </div>

        <ol className="space-y-3 px-5 py-5">
          {[
            {
              icon: Share,
              text: (
                <>
                  V <strong>Safariju</strong> tapnite gumb <strong>Deli</strong> (kvadrat s puščico
                  navzgor) na dnu zaslona.
                </>
              ),
            },
            {
              icon: SquarePlus,
              text: (
                <>
                  Podrsajte po seznamu in izberite <strong>Dodaj na domači zaslon</strong>.
                </>
              ),
            },
            {
              icon: Download,
              text: (
                <>
                  Potrdite z <strong>Dodaj</strong> — ikona Urnika se pojavi med aplikacijami.
                </>
              ),
            },
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
                <step.icon className="h-4 w-4" strokeWidth={2.3} />
              </span>
              <p className="pt-1 text-[13.5px] leading-relaxed">{step.text}</p>
            </li>
          ))}
        </ol>

        <p className="mx-5 mb-5 rounded-xl bg-paper px-4 py-3 text-[12px] leading-relaxed text-ink-soft">
          Opomba: na iPhonu namestitev deluje samo v brskalniku <strong>Safari</strong> (ne v Chromu
          ali Firefoxu).
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kartica za nastavitve
// ---------------------------------------------------------------------------

export function InstallPanel() {
  const { canInstall, install, standalone, isIOS, installed, ready } = useInstallState();
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [swReady, setSwReady] = useState<boolean | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setSwReady(false);
      return;
    }
    navigator.serviceWorker.getRegistration().then((r) => setSwReady(Boolean(r)));
  }, []);

  const status = standalone
    ? { label: "Nameščena", tone: "ok" as const, text: "Aplikacija trenutno teče v samostojnem načinu." }
    : installed
      ? { label: "Nameščena", tone: "ok" as const, text: "Najdete jo med aplikacijami na napravi." }
      : canInstall
        ? { label: "Na voljo", tone: "ready" as const, text: "Brskalnik omogoča namestitev z enim klikom." }
        : isIOS
          ? { label: "Ročna namestitev", tone: "info" as const, text: "Na iPhonu/iPadu dodajte prek gumba Deli v Safariju." }
          : { label: "Ni na voljo", tone: "info" as const, text: "Odprite stran v Chromu ali Edgu na telefonu oz. računalniku." };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-6">
        <h2 className="font-display text-xl font-semibold">Namestitev aplikacije</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Urnik lahko namestite na telefon ali računalnik — odpre se čez cel zaslon, z lastno ikono
          in brez naslovne vrstice brskalnika.
        </p>

        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3">
            <span className="text-sm font-medium">Stanje</span>
            <span
              className={cn(
                "chip",
                status.tone === "ok"
                  ? "bg-brand-tint text-brand-ink"
                  : status.tone === "ready"
                    ? "bg-amber-soft text-amber-ink"
                    : "bg-paper-deep text-ink-soft",
              )}
            >
              {ready ? status.label : "…"}
            </span>
          </div>
          <p className="px-1 text-xs text-ink-faint">{ready ? status.text : ""}</p>

          <div className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3">
            <span className="text-sm font-medium">Offline podpora</span>
            <span
              className={cn(
                "chip",
                swReady ? "bg-brand-tint text-brand-ink" : "bg-paper-deep text-ink-soft",
              )}
            >
              {swReady === null ? "…" : swReady ? "aktivna" : "ni aktivna"}
            </span>
          </div>

          {!standalone && !installed ? (
            canInstall ? (
              <button onClick={install} className="btn btn-primary w-full">
                <Download className="h-4 w-4" strokeWidth={2.2} />
                Namesti aplikacijo
              </button>
            ) : isIOS ? (
              <button onClick={() => setShowIosHelp(true)} className="btn btn-amber w-full">
                <Apple className="h-4 w-4" strokeWidth={2.2} />
                Navodila za iPhone / iPad
              </button>
            ) : null
          ) : null}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-display text-xl font-semibold">Kako namestiti</h2>
        <div className="mt-4 space-y-4 text-sm">
          <div>
            <p className="flex items-center gap-2 font-semibold">
              <span className="chip bg-[#d8f8ea] text-[11px] text-[#046c46]">Android</span>
              Chrome, Edge, Samsung Internet
            </p>
            <p className="mt-1.5 leading-relaxed text-ink-soft">
              Tapnite gumb <strong>Namesti</strong> zgoraj ali v meniju brskalnika (⋮) izberite{" "}
              <strong>Namesti aplikacijo</strong> / <strong>Dodaj na začetni zaslon</strong>.
            </p>
          </div>
          <div>
            <p className="flex items-center gap-2 font-semibold">
              <span className="chip bg-[#dbeafe] text-[11px] text-[#15539c]">iPhone / iPad</span>
              Safari
            </p>
            <p className="mt-1.5 leading-relaxed text-ink-soft">
              Gumb <strong>Deli</strong> → <strong>Dodaj na domači zaslon</strong> →{" "}
              <strong>Dodaj</strong>.
            </p>
          </div>
          <div>
            <p className="flex items-center gap-2 font-semibold">
              <span className="chip bg-[#eee3fd] text-[11px] text-[#5c21a8]">Računalnik</span>
              Chrome, Edge
            </p>
            <p className="mt-1.5 leading-relaxed text-ink-soft">
              V naslovni vrstici kliknite ikono za namestitev (zaslon s puščico) desno od naslova.
            </p>
          </div>
        </div>

        <p className="mt-5 rounded-xl bg-paper px-4 py-3 text-[12px] leading-relaxed text-ink-faint">
          Za namestitev na Androidu mora biti stran dostopna prek <strong>HTTPS</strong> (ali
          <code> localhost</code>). Če uporabljate domači naslov IP brez potrdila, oba sistema
          ustvarita bližnjico, ki deluje podobno.
        </p>
      </div>

      {showIosHelp ? <IosHelpSheet onClose={() => setShowIosHelp(false)} /> : null}
    </div>
  );
}
