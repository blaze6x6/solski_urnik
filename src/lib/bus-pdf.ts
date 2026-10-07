// ---------------------------------------------------------------------------
// Izvoz stalnega voznega reda v PDF (A4 ležeče): naslov, podnaslov in dve
// tabeli ob strani — »V šolo« in »Iz šole« (oznaka, odhod, prihod, trajanje).
// Tabeli se po velikosti pisave prilagodita, da vedno ostaneta na eni strani.
// ---------------------------------------------------------------------------

import { DEJAVU_SANS_BASE64, DEJAVU_SANS_BOLD_BASE64 } from "@/lib/pdf-font";
import { formatDuration, type TimetableData, type TimetableRow } from "@/lib/bus-timetable";
import { VOZNJA, count } from "@/lib/plural";

export type BusPdfPayload = {
  name: string;
  subtitle?: string;
  note?: string;
  /** »bw« = črno-bel za tisk (privzeto), »color« = barvni */
  style?: "bw" | "color" | "app";
} & TimetableData;

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

export async function exportBusTimetablePdf(p: BusPdfPayload): Promise<void> {
  if (p.style === "app") {
    const { exportBusTimetableAppPdf } = await import("@/lib/bus-pdf-app");
    return exportBusTimetableAppPdf(p);
  }
  const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableMod.default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.addFileToVFS("DejaVuSans.ttf", DEJAVU_SANS_BASE64);
  doc.addFileToVFS("DejaVuSans-Bold.ttf", DEJAVU_SANS_BOLD_BASE64);
  doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const gap = 10;
  const colW = (pageW - margin * 2 - gap) / 2;

  // glava
  let y = margin + 6;
  doc.setFont("DejaVu", "bold");
  doc.setFontSize(22);
  doc.setTextColor(0, 0, 0);
  doc.text(p.name, pageW / 2, y, { align: "center", maxWidth: pageW - margin * 2 });
  if (p.subtitle) {
    y += 7;
    doc.setFont("DejaVu", "normal");
    doc.setFontSize(12);
    doc.setTextColor(70, 76, 84);
    doc.text(p.subtitle, pageW / 2, y, { align: "center", maxWidth: pageW - margin * 2 });
  }

  // opomba na dnu
  let noteLines: string[] = [];
  if (p.note) {
    doc.setFont("DejaVu", "normal");
    doc.setFontSize(9);
    noteLines = doc.splitTextToSize(p.note, pageW - margin * 2) as string[];
  }
  const noteH = noteLines.length ? noteLines.length * 4 + 4 : 0;

  const headingY = y + 11;
  const tableTop = headingY + 3;
  const bottom = pageH - margin - noteH;
  const maxRows = Math.max(1, p.to.length, p.from.length);
  const rowH = Math.min(9, (bottom - tableTop) / (maxRows + 1));
  const fs = Math.min(12, Math.max(5, (rowH - 1.6) / 0.3528 / 1.15));

  const color = p.style === "color";
  const draw = (title: string, rows: TimetableRow[], x: number, tint: [number, number, number], strong: [number, number, number]) => {
    if (color) {
      doc.setFillColor(tint[0], tint[1], tint[2]);
      doc.roundedRect(x, headingY - 7, colW, 10, 2, 2, "F");
    }
    doc.setFont("DejaVu", "bold");
    doc.setFontSize(14);
    if (color) doc.setTextColor(strong[0], strong[1], strong[2]);
    else doc.setTextColor(0, 0, 0);
    doc.text(title, x + (color ? 3 : 0), headingY);
    doc.setFont("DejaVu", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 96, 104);
    doc.text(count(rows.length, VOZNJA), x + colW - (color ? 3 : 0), headingY, { align: "right" });

    if (rows.length === 0) {
      doc.setFontSize(10);
      doc.text("Ni vnesenih voženj.", x, tableTop + 6);
      return;
    }

    autoTable(doc, {
      startY: tableTop + (color ? 1 : 0),
      margin: { left: x, right: pageW - x - colW, bottom: margin + noteH },
      tableWidth: colW,
      head: [["Oznaka", "Odhod", "Prihod", "Trajanje"]],
      body: rows.map((r) => [r.label, r.depart, r.arrive || "–", formatDuration(r.depart, r.arrive) || "–"]),
      theme: "grid",
      styles: {
        font: "DejaVu",
        fontSize: fs,
        cellPadding: 0.8,
        minCellHeight: rowH,
        valign: "middle",
        halign: "center",
        lineColor: color ? [205, 211, 218] : [110, 118, 128],
        lineWidth: 0.2,
        textColor: [0, 0, 0],
        overflow: "linebreak",
      },
      headStyles: { fontStyle: "bold", fillColor: color ? tint : [225, 228, 232], textColor: color ? strong : [0, 0, 0], lineWidth: 0.3 },
      columnStyles: {
        0: { halign: "left", cellWidth: colW * 0.4 },
        1: { fontStyle: "bold", textColor: color ? strong : [0, 0, 0] },
        2: { fontStyle: "bold", textColor: color ? strong : [0, 0, 0] },
        3: { textColor: [90, 96, 104] },
      },
      alternateRowStyles: { fillColor: [247, 248, 249] },
    });
  };

  draw("V šolo", p.to, margin, [226, 232, 252], [37, 52, 160]);
  draw("Iz šole", p.from, margin + colW + gap, [220, 247, 229], [13, 107, 49]);

  if (noteLines.length) {
    doc.setFont("DejaVu", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 66, 74);
    doc.text(noteLines, margin, pageH - margin - noteLines.length * 4 + 3);
  }

  doc.save(`${safeFileName(p.name)}${color ? "-barvni" : ""}.pdf`);
}
