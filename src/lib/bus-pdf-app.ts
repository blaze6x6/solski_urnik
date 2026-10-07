// ---------------------------------------------------------------------------
// Vozni red za tisk v slogu aplikacije: dve kartici (»V šolo«, »Iz šole«) z
// obarvano glavo, ikono, številom voženj in tabelo. Nad kartico samo naslov.
// ---------------------------------------------------------------------------

import type { jsPDF } from "jspdf";
import { DEJAVU_SANS_BASE64, DEJAVU_SANS_BOLD_BASE64 } from "@/lib/pdf-font";
import { formatDuration, type TimetableRow } from "@/lib/bus-timetable";
import { VOZNJA, count } from "@/lib/plural";
import type { BusPdfPayload } from "@/lib/bus-pdf";
import { WHITE, clipRounded, fill, iconHome, iconSchool, ink, mix, readAppTheme, stroke, type AppTheme, type RGB } from "@/lib/pdf-theme";

function safeFileName(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "vozni-red"
  );
}

function truncate(doc: jsPDF, text: string, maxW: number): string {
  if (doc.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(t + "…") > maxW) t = t.slice(0, -1);
  return t + "…";
}

export async function exportBusTimetableAppPdf(p: BusPdfPayload): Promise<void> {
  const { jsPDF: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.addFileToVFS("DejaVuSans.ttf", DEJAVU_SANS_BASE64);
  doc.addFileToVFS("DejaVuSans-Bold.ttf", DEJAVU_SANS_BOLD_BASE64);
  doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");

  const T = readAppTheme();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const m = 12;
  const gap = 8;
  const colW = (W - m * 2 - gap) / 2;

  doc.setFont("DejaVu", "bold");
  doc.setFontSize(20);
  ink(doc, T.ink);
  doc.text(p.name, W / 2, m + 6, { align: "center", maxWidth: W - m * 2 });

  const top = m + 14;
  const headH = 11;
  const thH = 8;
  const maxRows = Math.max(1, p.to.length, p.from.length);
  const rowH = Math.max(6, Math.min(12, (H - m - top - headH - thH) / maxRows));
  const cardH = headH + thH + maxRows * rowH;

  const green: RGB = [34, 197, 94];
  drawCard(doc, T, "V šolo", p.to, m, top, colW, cardH, headH, thH, rowH, mix(T.spruce, WHITE, 0.1), "school");
  drawCard(doc, T, "Iz šole", p.from, m + colW + gap, top, colW, cardH, headH, thH, rowH, mix(green, WHITE, 0.12), "home");

  doc.save(`${safeFileName(p.name)}-aplikacija.pdf`);
}

function drawCard(
  doc: jsPDF,
  T: AppTheme,
  title: string,
  rows: TimetableRow[],
  x: number,
  y: number,
  w: number,
  h: number,
  headH: number,
  thH: number,
  rowH: number,
  tint: RGB,
  icon: "school" | "home",
) {
  fill(doc, WHITE);
  doc.roundedRect(x, y, w, h, 3, 3, "F");
  clipRounded(doc, x, y, w, h, 3);

  // glava kartice
  fill(doc, tint);
  doc.rect(x, y, w, headH, "F");
  (icon === "school" ? iconSchool : iconHome)(doc, x + 4.5, y + 3.2, 5, T.ink);
  doc.setFont("DejaVu", "bold");
  doc.setFontSize(11);
  ink(doc, T.ink);
  doc.text(title, x + 11.5, y + headH / 2, { baseline: "middle" });
  const tw = doc.getTextWidth(title);
  doc.setFont("DejaVu", "normal");
  doc.setFontSize(8);
  ink(doc, T.inkSoft);
  doc.text(`(${count(rows.length, VOZNJA)})`, x + 11.5 + tw + 2, y + headH / 2, { baseline: "middle" });

  const cols = [x + 5, x + w * 0.46, x + w * 0.62, x + w * 0.79];
  const ty = y + headH;

  if (rows.length === 0) {
    doc.setFontSize(9);
    ink(doc, T.inkFaint);
    doc.text("Ni vnesenih voženj.", x + w / 2, ty + 12, { align: "center" });
  } else {
    // glava tabele (zgoraj in spodaj temna črta, kot v aplikaciji)
    doc.setFont("DejaVu", "bold");
    doc.setFontSize(7.5);
    ink(doc, T.inkSoft);
    ["Oznaka", "Odhod", "Prihod", "Trajanje"].forEach((t, i) =>
      doc.text(t, cols[i], ty + thH / 2, { baseline: "middle" }),
    );
    stroke(doc, mix(T.ink, WHITE, 0.8), 0.35);
    doc.line(x, ty, x + w, ty);
    doc.line(x, ty + thH, x + w, ty + thH);

    rows.forEach((r, i) => {
      const ry = ty + thH + i * rowH;
      const cy = ry + rowH / 2;
      doc.setFont("DejaVu", "normal");
      doc.setFontSize(9);
      ink(doc, T.ink);
      doc.text(truncate(doc, r.label || "—", cols[1] - cols[0] - 3), cols[0], cy, { baseline: "middle" });
      doc.setFont("courier", "bold");
      doc.setFontSize(10);
      ink(doc, T.ink);
      doc.text(r.depart, cols[1], cy, { baseline: "middle" });
      doc.text(r.arrive || "–", cols[2], cy, { baseline: "middle" });
      doc.setFont("DejaVu", "normal");
      doc.setFontSize(8.5);
      ink(doc, T.inkFaint);
      doc.text(formatDuration(r.depart, r.arrive) || "–", cols[3], cy, { baseline: "middle" });
      if (i < rows.length - 1) {
        stroke(doc, T.line, 0.2);
        doc.line(x, ry + rowH, x + w, ry + rowH);
      }
    });
  }

  doc.restoreGraphicsState();
  stroke(doc, T.line, 0.4);
  doc.roundedRect(x, y, w, h, 3, 3, "S");
}
