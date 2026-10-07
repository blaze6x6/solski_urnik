// ---------------------------------------------------------------------------
// PDF urnika v slogu aplikacije: zaobljene celice, barve predmetov in dogodkov
// (pilule), obrobe, ikone praznikov/počitnic, barve izbrane teme. Nad urnikom je
// samo ime otroka, pod njim nič. Vse je narisano z vektorji (ostro pri tisku).
// ---------------------------------------------------------------------------

import type { jsPDF } from "jspdf";
import { eventColor, subjectColor } from "@/lib/colors";
import { DEJAVU_SANS_BASE64, DEJAVU_SANS_BOLD_BASE64 } from "@/lib/pdf-font";
import type { PdfCell, PdfDay, PdfPayload, PdfSlot } from "@/lib/pdf";
import {
  WHITE,
  clipRounded,
  fill,
  hexToRgb,
  iconCalendarOff,
  iconFlag,
  iconPalm,
  ink,
  mix,
  readAppTheme,
  stroke,
  type AppTheme,
  type RGB,
} from "@/lib/pdf-theme";

const PT = 0.3528; // 1 pt v mm

/** Besedilo prilagodi širini (največ `maxLines` vrstic); vrne vrstice in velikost pisave. */
function fitText(doc: jsPDF, text: string, maxW: number, maxLines: number, size: number, min = 5) {
  let s = size;
  for (;;) {
    doc.setFontSize(s);
    const lines = doc.splitTextToSize(text, maxW) as string[];
    const widest = Math.max(...lines.map((l) => doc.getTextWidth(l)));
    if ((lines.length <= maxLines && widest <= maxW + 0.01) || s <= min) {
      return { lines: lines.slice(0, maxLines), size: s };
    }
    s -= 0.5;
  }
}

function truncate(doc: jsPDF, text: string, maxW: number): string {
  if (doc.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(t + "…") > maxW) t = t.slice(0, -1);
  return t + "…";
}

export async function exportTimetableAppPdf(payload: PdfPayload): Promise<void> {
  const { jsPDF: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.addFileToVFS("DejaVuSans.ttf", DEJAVU_SANS_BASE64);
  doc.addFileToVFS("DejaVuSans-Bold.ttf", DEJAVU_SANS_BOLD_BASE64);
  doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");

  const T = readAppTheme();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const m = 10;
  const { days, slots } = payload;

  // --- ime otroka ---
  doc.setFont("DejaVu", "bold");
  doc.setFontSize(20);
  ink(doc, T.ink);
  doc.text(payload.title, W / 2, m + 6, { align: "center" });

  // --- mere ---
  const top = m + 12;
  const gridX = m;
  const gridW = W - m * 2;
  const labelW = 26;
  const dayW = (gridW - labelW) / Math.max(1, days.length);
  const hasChips = days.some((d) => d.holiday || d.breakName);
  const headH = hasChips ? 14 : 10;
  const lessonCount = Math.max(1, slots.filter((s) => s.kind !== "break").length);
  const breakCount = slots.filter((s) => s.kind === "break").length;
  const breakH = 8;
  const lessonH = Math.max(8, Math.min(24, (H - m - top - headH - breakCount * breakH) / lessonCount));
  const total = headH + breakCount * breakH + (slots.length - breakCount) * lessonH;
  const firstLessonId = slots.find((s) => s.kind !== "break")?.id ?? null;

  // --- kartica (vse znotraj se obreže na zaobljene vogale) ---
  fill(doc, WHITE);
  doc.roundedRect(gridX, top, gridW, total, 3, 3, "F");
  clipRounded(doc, gridX, top, gridW, total, 3);

  // glava
  fill(doc, mix(T.paperDeep, WHITE, 0.7));
  doc.rect(gridX, top, gridW, headH, "F");
  doc.setFont("DejaVu", "bold");
  doc.setFontSize(6.5);
  ink(doc, T.inkFaint);
  doc.text("URA", gridX + labelW / 2, top + headH / 2, { align: "center", baseline: "middle" });
  days.forEach((d, i) => drawDayHeader(doc, T, d, gridX + labelW + i * dayW, top, dayW, headH, hasChips));

  // vrstice
  let y = top + headH;
  for (const slot of slots) {
    const isBreak = slot.kind === "break";
    const h = isBreak ? breakH : lessonH;
    drawLabel(doc, T, slot, gridX, y, labelW, h, isBreak);
    days.forEach((d, i) => {
      const x0 = gridX + labelW + i * dayW;
      const cell = payload.cells[`${d.wd}-${slot.id}`] ?? null;
      drawCellBox(doc, T, payload, d, cell, slot, x0, y, dayW, h, isBreak, slot.id === firstLessonId);
    });
    y += h;
  }

  // mreža
  stroke(doc, T.line, 0.2);
  let ly = top + headH;
  doc.line(gridX, ly, gridX + gridW, ly);
  for (const slot of slots) {
    ly += slot.kind === "break" ? breakH : lessonH;
    doc.line(gridX, ly, gridX + gridW, ly);
  }
  doc.line(gridX + labelW, top, gridX + labelW, top + total);
  for (let i = 1; i < days.length; i++) {
    doc.line(gridX + labelW + i * dayW, top, gridX + labelW + i * dayW, top + total);
  }

  doc.restoreGraphicsState();
  stroke(doc, T.line, 0.4);
  doc.roundedRect(gridX, top, gridW, total, 3, 3, "S");

  doc.save(`${safeName(payload.fileName ?? payload.title)}.pdf`);
}

function safeName(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "urnik"
  );
}

function drawDayHeader(doc: jsPDF, T: AppTheme, d: PdfDay, x: number, y: number, w: number, h: number, hasChips: boolean) {
  doc.setFont("DejaVu", "bold");
  doc.setFontSize(10);
  ink(doc, T.ink);
  doc.text(d.label, x + w / 2, y + (hasChips ? 4.6 : h / 2), { align: "center", baseline: "middle" });
  const chip = d.holiday
    ? { text: "Praznik", bg: [255, 227, 233] as RGB, fg: [194, 23, 66] as RGB, kind: "flag" as const }
    : d.breakName
      ? { text: d.breakName, bg: [238, 248, 214] as RGB, fg: [88, 127, 10] as RGB, kind: "palm" as const }
      : null;
  if (!chip) return;
  doc.setFontSize(6.5);
  const icon = 2.6;
  const label = truncate(doc, chip.text, w - 12);
  const cw = icon + 1.2 + doc.getTextWidth(label) + 4;
  const cx = x + (w - cw) / 2;
  const cy = y + 7.6;
  fill(doc, chip.bg);
  doc.roundedRect(cx, cy, cw, 4.6, 2.3, 2.3, "F");
  (chip.kind === "flag" ? iconFlag : iconPalm)(doc, cx + 2, cy + 1, icon, chip.fg);
  ink(doc, chip.fg);
  doc.text(label, cx + 2 + icon + 1.2, cy + 2.4, { baseline: "middle" });
}

function drawLabel(doc: jsPDF, T: AppTheme, slot: PdfSlot, x: number, y: number, w: number, h: number, isBreak: boolean) {
  fill(doc, isBreak ? T.amberSoft : mix(T.paperDeep, WHITE, 0.5));
  doc.rect(x, y, w, h, "F");
  doc.setFont("DejaVu", "bold");
  if (isBreak) {
    doc.setFontSize(6.5);
    ink(doc, T.amberInk);
    doc.text(truncate(doc, slot.title, w - 3), x + w / 2, y + h / 2 - 1.5, { align: "center", baseline: "middle" });
    doc.setFont("DejaVu", "normal");
    doc.setFontSize(5);
    ink(doc, mix(T.amberInk, T.amberSoft, 0.8));
    doc.text(`${slot.start}–${slot.end}`, x + w / 2, y + h / 2 + 1.7, { align: "center", baseline: "middle" });
    return;
  }
  doc.setFontSize(9);
  ink(doc, T.ink);
  doc.text(truncate(doc, slot.title, w - 3), x + w / 2, y + h / 2 - 3, { align: "center", baseline: "middle" });
  doc.setFont("DejaVu", "normal");
  doc.setFontSize(6.5);
  ink(doc, T.inkFaint);
  doc.text(slot.start, x + w / 2, y + h / 2 + 0.8, { align: "center", baseline: "middle" });
  doc.text(slot.end, x + w / 2, y + h / 2 + 3.6, { align: "center", baseline: "middle" });
}

function drawCellBox(
  doc: jsPDF,
  T: AppTheme,
  payload: PdfPayload,
  d: PdfDay,
  cell: PdfCell,
  slot: PdfSlot,
  x: number,
  y: number,
  w: number,
  h: number,
  isBreak: boolean,
  isFirstLesson: boolean,
) {
  // dan brez pouka
  const off = d.breakName ? "break" : d.holiday ? "holiday" : d.afterYear ? "ended" : null;
  if (off && cell === null) {
    const bg: RGB = off === "break" ? [241, 248, 220] : off === "holiday" ? [255, 240, 243] : [241, 243, 245];
    const fg: RGB = off === "break" ? [88, 127, 10] : off === "holiday" ? [194, 23, 66] : [107, 116, 128];
    fill(doc, bg);
    doc.rect(x, y, w, h, "F");
    if (isBreak) return;
    if (isFirstLesson) {
      const label = d.breakName ?? d.holiday ?? "Konec šolskega leta";
      const icon = 5;
      const { lines, size } = fitText(doc, label, w - 3, 3, 7, 5);
      doc.setFont("DejaVu", "bold");
      doc.setFontSize(size);
      const lh = size * PT * 1.15;
      const block = icon + 1 + lh * lines.length;
      const by = y + (h - block) / 2;
      (off === "holiday" ? iconFlag : off === "ended" ? iconCalendarOff : iconPalm)(doc, x + w / 2 - icon / 2, by, icon, fg);
      ink(doc, fg);
      lines.forEach((l, i) => doc.text(l, x + w / 2, by + icon + 1 + lh * (i + 0.5), { align: "center", baseline: "middle" }));
    } else {
      doc.setFont("DejaVu", "normal");
      doc.setFontSize(9);
      ink(doc, mix(fg, bg, 0.35));
      doc.text("·", x + w / 2, y + h / 2, { align: "center", baseline: "middle" });
    }
    return;
  }

  const p = isBreak ? 0.6 : 1.1;
  const ix = x + p;
  const iy = y + p;
  const iw = w - p * 2;
  const ih = h - p * 2;

  if (cell === null) {
    doc.setFont("DejaVu", "normal");
    if (isBreak) {
      doc.setFontSize(5.5);
      ink(doc, mix(T.amberInk, T.amberSoft, 0.45));
      doc.text(truncate(doc, slot.title, iw), x + w / 2, y + h / 2, { align: "center", baseline: "middle" });
    } else {
      doc.setFontSize(9);
      ink(doc, T.lineStrong);
      doc.text("·", x + w / 2, y + h / 2, { align: "center", baseline: "middle" });
    }
    return;
  }

  const events = cell.events ?? [];
  const active = events.filter((e) => !e.cancelled);
  const hasActive = active.length > 0;
  const subj = cell.hasSubject ? subjectColor(cell.colorIdx) : null;
  const evPal = hasActive ? eventColor(active[0].color ?? "amber") : null;
  const bg: RGB = hasActive ? hexToRgb(evPal!.soft) : subj ? hexToRgb(subj.soft) : [236, 239, 242];

  fill(doc, bg);
  doc.roundedRect(ix, iy, iw, ih, 1.8, 1.8, "F");

  const small = isBreak;
  const pillH = small ? 3 : 3.8;
  const pillFont = small ? 5.5 : 6.5;
  const timeFont = small ? 4.8 : 5.6;
  const unit = (e: (typeof events)[number]) => pillH + (e.clock ? 2.4 : e.cancelled ? 2.4 : 0) + 0.7;

  // predmet (preprost ali prečrtan, če ga prekrivajo dogodki)
  let subjLines: string[] = [];
  let subjSize = 0;
  let subjH = 0;
  const subjText = cell.hasSubject ? cell.text : "";
  if (subjText) {
    doc.setFont("DejaVu", "bold");
    const base = hasActive || events.length > 0 ? 6.5 : payload.mode === "abbr" ? 12 : 9.5;
    const r = fitText(doc, subjText, iw - 1.6, hasActive ? 1 : 2, base, 5);
    subjLines = r.lines;
    subjSize = r.size;
    subjH = subjLines.length * subjSize * PT * 1.15 + (events.length ? 0.8 : 0);
  }

  // koliko dogodkov gre v celico
  const avail = ih - subjH - 0.6;
  let shown = events.slice(0, 4);
  let extra = events.length - shown.length;
  const need = (list: typeof shown, plus: boolean) => list.reduce((a, e) => a + unit(e), 0) + (plus ? 3 : 0);
  while (shown.length > 1 && need(shown, extra > 0) > avail) {
    shown = shown.slice(0, -1);
    extra = events.length - shown.length;
  }
  const evH = events.length ? need(shown, extra > 0) : 0;
  let cy = iy + (ih - (subjH + evH)) / 2;

  if (subjLines.length) {
    doc.setFont("DejaVu", "bold");
    doc.setFontSize(subjSize);
    const lh = subjSize * PT * 1.15;
    const col = hasActive ? T.inkFaint : subj ? hexToRgb(subj.ink) : T.ink;
    ink(doc, col);
    subjLines.forEach((l, i) => {
      const ty = cy + lh * (i + 0.5);
      doc.text(l, ix + iw / 2, ty, { align: "center", baseline: "middle" });
      if (hasActive) {
        const tw = doc.getTextWidth(l);
        stroke(doc, col, 0.2);
        doc.line(ix + iw / 2 - tw / 2, ty, ix + iw / 2 + tw / 2, ty);
      }
    });
    cy += subjH;
  }

  for (const e of shown) {
    const pal = eventColor(e.color ?? "amber");
    doc.setFont("DejaVu", "bold");
    doc.setFontSize(pillFont);
    const title = truncate(doc, e.title, iw - 4);
    const pw = Math.min(iw - 1, doc.getTextWidth(title) + 3.6);
    const px = ix + (iw - pw) / 2;
    fill(doc, e.cancelled ? [201, 207, 214] : hexToRgb(pal.solid));
    doc.roundedRect(px, cy, pw, pillH, pillH / 2, pillH / 2, "F");
    ink(doc, e.cancelled ? [107, 116, 128] : WHITE);
    doc.text(title, ix + iw / 2, cy + pillH / 2, { align: "center", baseline: "middle" });
    if (e.cancelled) {
      const tw = doc.getTextWidth(title);
      stroke(doc, [107, 116, 128], 0.2);
      doc.line(ix + iw / 2 - tw / 2, cy + pillH / 2, ix + iw / 2 + tw / 2, cy + pillH / 2);
    }
    cy += pillH;
    if (e.clock || e.cancelled) {
      doc.setFontSize(timeFont);
      ink(doc, e.cancelled ? [138, 147, 158] : hexToRgb(pal.ink));
      doc.text(e.cancelled ? "ODPADE" : (e.clock as string), ix + iw / 2, cy + 1.3, { align: "center", baseline: "middle" });
      cy += 2.4;
    }
    cy += 0.7;
  }
  if (extra > 0) {
    doc.setFont("DejaVu", "bold");
    doc.setFontSize(5.5);
    ink(doc, T.inkFaint);
    doc.text(`+${extra} več`, ix + iw / 2, cy + 1.2, { align: "center", baseline: "middle" });
  }
}
