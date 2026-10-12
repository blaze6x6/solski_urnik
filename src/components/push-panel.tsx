"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Bell, BellOff, BellRing, Send } from "lucide-react";
import {
  markPushDeviceAction,
  removePushSubscriptionAction,
  savePushSubscriptionAction,
  sendTestPushAction,
  updatePushKindsAction,
} from "@/app/actions/push";
import { useInstallState } from "@/components/pwa";
import { cn } from "@/lib/colors";

type Kind = { key: string; label: string; hint: string };
type Props = {
  publicKey: string;
  kinds: Kind[];
  /** naprave, ki jih ima ta uporabnik že naročene */
  subs: Array<{ endpoint: string; kinds: string[] }>;
};

function urlBase64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const bufToB64u = (buf: ArrayBuffer | null): string => {
  if (!buf) return "";
  let s = "";
  new Uint8Array(buf).forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export function PushPanel({ publicKey, kinds, subs }: Props) {
  const { standalone, isIOS, ready } = useInstallState();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(kinds.map((k) => k.key));
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [swState, setSwState] = useState<"none" | "ok">("none");

  const refresh = useCallback(async () => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (!ok) return;
    setPermission(Notification.permission);
    const reg = await navigator.serviceWorker.getRegistration();
    setSwState(reg ? "ok" : "none");
    const sub = await reg?.pushManager.getSubscription();
    setEndpoint(sub?.endpoint ?? null);
    if (sub) {
      const known = subs.find((s) => s.endpoint === sub.endpoint);
      if (known) {
        setSelected(known.kinds);
        void markPushDeviceAction(sub.endpoint);
      }
    }
  }, [subs]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enabled = endpoint !== null && permission === "granted";
  const needsInstall = ready && isIOS && !standalone;

  function enable() {
    setMessage(null);
    start(async () => {
      try {
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== "granted") {
          setMessage({ tone: "err", text: "Obvestila niso dovoljena. Dovoljenje lahko spremenite v nastavitvah naprave ali brskalnika." });
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
        }
        const json = sub.toJSON();
        const res = await savePushSubscriptionAction({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? bufToB64u(sub.getKey("p256dh")),
          auth: json.keys?.auth ?? bufToB64u(sub.getKey("auth")),
          kinds: selected,
          userAgent: navigator.userAgent,
        });
        if (!res.ok) {
          setMessage({ tone: "err", text: res.error ?? "Shranjevanje ni uspelo." });
          return;
        }
        setEndpoint(sub.endpoint);
        setMessage({ tone: "ok", text: "Obvestila so vklopljena na tej napravi." });
      } catch (err) {
        setMessage({ tone: "err", text: `Vklop ni uspel: ${err instanceof Error ? err.message : "neznana napaka"}` });
      }
    });
  }

  function disable() {
    setMessage(null);
    start(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await removePushSubscriptionAction(sub.endpoint);
          await sub.unsubscribe();
        }
        setEndpoint(null);
        setMessage({ tone: "ok", text: "Obvestila so izklopljena na tej napravi." });
      } catch {
        setMessage({ tone: "err", text: "Izklop ni uspel." });
      }
    });
  }

  function toggleKind(key: string) {
    const next = selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key];
    setSelected(next);
    if (endpoint) start(async () => void (await updatePushKindsAction({ endpoint, kinds: next })));
  }

  function test() {
    if (!endpoint) return;
    setMessage(null);
    start(async () => {
      const r = await sendTestPushAction(endpoint);
      setMessage(r.ok ? { tone: "ok", text: "Preizkusno obvestilo je poslano." } : { tone: "err", text: r.error ?? "Neuspešno." });
    });
  }

  return (
    <div className="card mt-6 p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-soft text-amber-strong">
          {enabled ? <BellRing className="h-5 w-5" strokeWidth={2.2} /> : <Bell className="h-5 w-5" strokeWidth={2.2} />}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold">Push obvestila</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Obvestila na telefonu ali računalniku, tudi ko aplikacija ni odprta. Vklopite jih posebej na vsaki napravi, ki jih želite
            prejemati.
          </p>
        </div>
      </div>

      {supported === false ? (
        <p className="mt-4 rounded-xl bg-paper px-4 py-3 text-sm text-ink-soft">
          Ta brskalnik ne podpira push obvestil. Poskusite s Chromom (Android) oziroma na iPhonu z nameščeno aplikacijo (iOS 16.4 ali novejši).
        </p>
      ) : needsInstall ? (
        <p className="mt-4 rounded-xl bg-amber-soft px-4 py-3 text-sm text-amber-ink">
          Na iPhonu/iPadu push obvestila delujejo samo, ko je aplikacija <strong>dodana na domači zaslon</strong>. Najprej jo namestite
          (Deli → Dodaj na domači zaslon), nato jo odprite z domačega zaslona in vklopite obvestila tukaj.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="space-y-2">
            {kinds.map((k) => (
              <label key={k.key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white px-4 py-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded accent-spruce"
                  checked={selected.includes(k.key)}
                  onChange={() => toggleKind(k.key)}
                />
                <span>
                  <span className="block text-sm font-semibold">{k.label}</span>
                  <span className="block text-xs text-ink-faint">{k.hint}</span>
                </span>
              </label>
            ))}
          </div>

          {permission === "denied" ? (
            <p className="rounded-xl bg-[#ffe3e9] px-4 py-3 text-sm text-[#b3173a]">
              Obvestila so za to stran blokirana. Dovolite jih v nastavitvah brskalnika oz. naprave in osvežite stran.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {enabled ? (
              <button onClick={disable} disabled={pending} className="btn btn-ghost">
                <BellOff className="h-4 w-4" strokeWidth={2.2} />
                Izklopi na tej napravi
              </button>
            ) : (
              <button onClick={enable} disabled={pending || supported === null || permission === "denied" || selected.length === 0} className="btn btn-primary">
                <Bell className="h-4 w-4" strokeWidth={2.2} />
                {pending ? "Vklapljam …" : "Vklopi obvestila na tej napravi"}
              </button>
            )}
          </div>
          <button onClick={test} disabled={pending || !enabled} className="btn btn-primary w-full sm:w-auto" title={enabled ? "" : "Najprej vklopite obvestila na tej napravi"}>
            <Send className="h-4 w-4" strokeWidth={2.2} />
            Pošlji preizkus
          </button>
          {enabled ? null : selected.length === 0 ? <p className="text-xs text-ink-faint">Izberite vsaj eno vrsto obvestil.</p> : null}

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-paper px-4 py-3 text-xs">
            <dt className="text-ink-faint">Podpora brskalnika</dt>
            <dd className="font-semibold">{supported === null ? "…" : supported ? "da" : "ne"}</dd>
            <dt className="text-ink-faint">Service worker</dt>
            <dd className="font-semibold">{swState === "ok" ? "registriran" : "ni registriran (osvežite stran)"}</dd>
            <dt className="text-ink-faint">Dovoljenje za obvestila</dt>
            <dd className="font-semibold">{permission === "granted" ? "dovoljeno" : permission === "denied" ? "blokirano" : "še ni izbrano"}</dd>
            <dt className="text-ink-faint">Naročnina na tej napravi</dt>
            <dd className="font-semibold">{endpoint ? "aktivna" : "ni"}</dd>
          </dl>

          {message ? (
            <p
              className={cn(
                "rounded-xl px-4 py-3 text-sm font-medium",
                message.tone === "ok" ? "bg-brand-tint text-brand-ink" : "bg-[#ffe3e9] text-[#b3173a]",
              )}
            >
              {message.text}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
