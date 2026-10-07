"use client";

import { useEffect, useRef, useState } from "react";

/** Zazna, ali je zaslon ožji od podane meje (privzeto 768 px). */
export function useIsMobile(breakpoint = 768): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [breakpoint]);
  return mobile;
}

/**
 * Zazna napravo z zaslonom na dotik (telefon, tablica) — ne glede na širino
 * zaslona, zato velja tudi v ležečem položaju, ko je telefon širši od 768 px.
 */
export function useIsTouch(): boolean {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const apply = () => setTouch(mq.matches || navigator.maxTouchPoints > 0);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return touch;
}

type SwipeOptions = {
  /** klican ob potegu v levo (naprej) */
  onNext?: () => void;
  /** klican ob potegu v desno (nazaj) */
  onPrev?: () => void;
  /** najmanjši vodoravni premik v px */
  threshold?: number;
  enabled?: boolean;
};

/**
 * Poteg levo/desno za pomikanje med tedni oz. meseci.
 *
 * - Vsebovalnik se med potegom rahlo pomika s prstom (brez ponovnega izrisa),
 *   stran pa se NE pomakne: navpično drsenje ostane brskalniku (`touch-action: pan-y`).
 * - Navigacijo izvede klicatelj (`onNext` / `onPrev`), zato lahko pomakne samo
 *   en urnik in ne spreminja naslova ali položaja drsenja strani.
 */
export function useSwipeNavigation<T extends HTMLElement>({
  onNext,
  onPrev,
  threshold = 60,
  enabled = true,
}: SwipeOptions) {
  const ref = useRef<T | null>(null);
  const [hint, setHint] = useState<"left" | "right" | null>(null);

  // klicatelji pogosto podajo nove funkcije ob vsakem izrisu — ne vežemo dogodkov znova
  const next = useRef(onNext);
  const prev = useRef(onPrev);
  useEffect(() => {
    next.current = onNext;
    prev.current = onPrev;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;
    /** null = smer še ni določena, true = vodoravno, false = navpično */
    let horizontal: boolean | null = null;

    const reset = (animate: boolean) => {
      el.style.transition = animate ? "transform 180ms ease-out" : "";
      el.style.transform = "";
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
      horizontal = null;
      el.style.transition = "";
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (horizontal === null && Math.hypot(dx, dy) > 10) {
        horizontal = Math.abs(dx) > Math.abs(dy) * 1.2;
        if (!horizontal) {
          tracking = false;
          setHint(null);
          reset(false);
          return;
        }
      }
      if (horizontal) {
        // urnik sledi prstu z uporom, da je jasno, da se premika samo on
        const follow = Math.max(-90, Math.min(90, dx * 0.4));
        el.style.transform = `translateX(${follow}px)`;
        if (Math.abs(dx) > threshold / 2) setHint(dx < 0 ? "left" : "right");
        else setHint(null);
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      setHint(null);
      reset(true);
      if (!horizontal) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) < threshold) return;
      (dx < 0 ? next.current : prev.current)?.();
    };

    const onCancel = () => {
      tracking = false;
      setHint(null);
      reset(true);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
      reset(false);
    };
  }, [threshold, enabled]);

  return { ref, hint };
}
