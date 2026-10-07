// ---------------------------------------------------------------------------
// Skupni pripomočki za PDF v »aplikacijskem« slogu: barve trenutne teme in
// preproste vektorske ikone (brez slik, zato ostanejo ostre pri tisku).
// ---------------------------------------------------------------------------

import type { jsPDF } from "jspdf";

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const c = hex.replace("#", "");
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

/** Meša barvo `c` z ozadjem `bg` (a = delež barve `c`). */
export function mix(c: RGB, bg: RGB, a: number): RGB {
  return [0, 1, 2].map((i) => Math.round(c[i] * a + bg[i] * (1 - a))) as RGB;
}

export const WHITE: RGB = [255, 255, 255];

export type AppTheme = {
  spruce: RGB;
  spruce2: RGB;
  brandTint: RGB;
  ink: RGB;
  inkSoft: RGB;
  inkFaint: RGB;
  line: RGB;
  lineStrong: RGB;
  paperDeep: RGB;
  amberSoft: RGB;
  amberInk: RGB;
};

const DEFAULTS: AppTheme = {
  spruce: [6, 166, 107],
  spruce2: [6, 179, 184],
  brandTint: [234, 250, 243],
  ink: [22, 32, 43],
  inkSoft: [86, 100, 117],
  inkFaint: [147, 160, 176],
  line: [226, 232, 240],
  lineStrong: [203, 213, 225],
  paperDeep: [230, 235, 240],
  amberSoft: [255, 240, 218],
  amberInk: [169, 84, 10],
};

/**
 * Barve blagovne znamke se preberejo iz izbrane teme aplikacije (CSS spremenljivke);
 * nevtralne barve (besedilo, črte) so vedno svetle, da je tisk berljiv tudi iz temnega načina.
 */
export function readAppTheme(): AppTheme {
  if (typeof document === "undefined") return DEFAULTS;
  try {
    const cs = getComputedStyle(document.documentElement);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const resolve = (name: string, fb: RGB): RGB => {
      const raw = cs.getPropertyValue(name).trim();
      if (!raw || !ctx) return fb;
      try {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = "#000000";
        ctx.fillStyle = raw;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        return d[3] === 0 ? fb : [d[0], d[1], d[2]];
      } catch {
        return fb;
      }
    };
    return {
      ...DEFAULTS,
      spruce: resolve("--color-spruce", DEFAULTS.spruce),
      spruce2: resolve("--color-spruce-2", DEFAULTS.spruce2),
      brandTint: resolve("--color-brand-tint", DEFAULTS.brandTint),
    };
  } catch {
    return DEFAULTS;
  }
}

export function fill(doc: jsPDF, c: RGB) {
  doc.setFillColor(c[0], c[1], c[2]);
}
export function stroke(doc: jsPDF, c: RGB, w = 0.2) {
  doc.setDrawColor(c[0], c[1], c[2]);
  doc.setLineWidth(w);
}
export function ink(doc: jsPDF, c: RGB) {
  doc.setTextColor(c[0], c[1], c[2]);
}

/** Omeji risanje na zaobljen pravokotnik; vrnite z `doc.restoreGraphicsState()`. */
export function clipRounded(doc: jsPDF, x: number, y: number, w: number, h: number, r: number) {
  const d = doc as unknown as { clip: () => void; discardPath: () => void };
  doc.saveGraphicsState();
  doc.roundedRect(x, y, w, h, r, r, null);
  d.clip();
  d.discardPath();
}

// --- ikone (x, y = zgornji levi kot, s = velikost v mm) -------------------------

export function iconFlag(doc: jsPDF, x: number, y: number, s: number, c: RGB) {
  stroke(doc, c, Math.max(0.2, s * 0.1));
  doc.line(x + s * 0.2, y + s * 0.05, x + s * 0.2, y + s);
  doc.lines(
    [
      [s * 0.65, 0],
      [-s * 0.18, s * 0.28],
      [s * 0.18, s * 0.28],
      [-s * 0.65, 0],
    ],
    x + s * 0.2,
    y + s * 0.1,
    [1, 1],
    "S",
    true,
  );
}

export function iconPalm(doc: jsPDF, x: number, y: number, s: number, c: RGB) {
  stroke(doc, c, Math.max(0.2, s * 0.1));
  const tx = x + s * 0.55;
  const ty = y + s * 0.4;
  doc.line(x + s * 0.5, y + s, tx, ty);
  doc.line(tx, ty, x + s * 0.08, y + s * 0.55);
  doc.line(tx, ty, x + s * 0.22, y + s * 0.12);
  doc.line(tx, ty, x + s * 0.58, y + s * 0.02);
  doc.line(tx, ty, x + s * 0.92, y + s * 0.2);
  doc.line(tx, ty, x + s * 0.95, y + s * 0.6);
}

export function iconCalendarOff(doc: jsPDF, x: number, y: number, s: number, c: RGB) {
  stroke(doc, c, Math.max(0.2, s * 0.1));
  doc.roundedRect(x + s * 0.1, y + s * 0.18, s * 0.8, s * 0.72, s * 0.1, s * 0.1, "S");
  doc.line(x + s * 0.1, y + s * 0.4, x + s * 0.9, y + s * 0.4);
  doc.line(x + s * 0.3, y + s * 0.05, x + s * 0.3, y + s * 0.28);
  doc.line(x + s * 0.7, y + s * 0.05, x + s * 0.7, y + s * 0.28);
  doc.line(x, y, x + s, y + s);
}

export function iconSchool(doc: jsPDF, x: number, y: number, s: number, c: RGB) {
  stroke(doc, c, Math.max(0.2, s * 0.09));
  doc.lines([[s * 0.45, -s * 0.38], [s * 0.45, s * 0.38]], x + s * 0.05, y + s * 0.42, [1, 1], "S");
  doc.rect(x + s * 0.17, y + s * 0.42, s * 0.66, s * 0.52, "S");
  doc.rect(x + s * 0.42, y + s * 0.65, s * 0.16, s * 0.29, "S");
  doc.line(x + s * 0.5, y + s * 0.04, x + s * 0.5, y - s * 0.12);
}

export function iconHome(doc: jsPDF, x: number, y: number, s: number, c: RGB) {
  stroke(doc, c, Math.max(0.2, s * 0.09));
  doc.lines([[s * 0.45, -s * 0.4], [s * 0.45, s * 0.4]], x + s * 0.05, y + s * 0.45, [1, 1], "S");
  doc.rect(x + s * 0.2, y + s * 0.45, s * 0.6, s * 0.48, "S");
  doc.rect(x + s * 0.43, y + s * 0.64, s * 0.14, s * 0.29, "S");
}
