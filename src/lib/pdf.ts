// ---------------------------------------------------------------------------
// Izvoz urnika v PDF
//
// Postavitev: na vrhu sredinsko samo ime učenca, pod njim urnik, ki se
// dinamično prilagodi in vedno ostane na eni strani A4 (ležeče): velikost
// pisave in razmikov se zmanjšuje, dokler vsebina ne gre na list, sicer pa se
// vrstice raztegnejo, da urnik zapolni stran. Pisava je vgrajena (DejaVu
// podmnožica), zato so šumniki vedno pravilni.
// ---------------------------------------------------------------------------

import { eventColor, subjectColor } from "@/lib/colors";
import { DEJAVU_SANS_BASE64, DEJAVU_SANS_BOLD_BASE64 } from "@/lib/pdf-font";

export type PdfSlot = {
  id: number;
  period: number;
  title: string;
  kind: "lesson" | "break";
  start: string;
  end: string;
};

export type PdfDay = {
  iso: string;
  wd: number;
  label: string;
  holiday: string | null;
  breakName: string | null;
  /** dan je po koncu šolskega leta */
  afterYear?: boolean;
};

export type PdfCell = {
  hasSubject: boolean;
  text: string;
  colorIdx: number;
  /** vsi dogodki v tej celici */
  events?: Array<{ title: string; clock: string | null; cancelled: boolean; color?: string }>;
} | null;

export type PdfPayload = {
  /** ime učenca — edino besedilo nad urnikom */
  title: string;
  days: PdfDay[];
  slots: PdfSlot[];
  cells: Record<string, PdfCell>;
  mode: "full" | "abbr";
  /** »bw« = črno-bel za tisk (privzeto), »color« = barvni kot v aplikaciji */
  style?: "bw" | "color";
  /** legenda kratic — izpiše se le, če je vklopljen prikaz s kraticami */
  legend?: string[];
  /** ime datoteke brez končnice */
  fileName?: string;
};

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

function safeFileName(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "urnik"
  );
}

type Built = { doc: import("jspdf").jsPDF; fits: boolean };

/** Nariše urnik z danim merilom pisave; `stretch` raztegne vrstice čez celo stran. */
function buildDoc(
  JsPDF: typeof import("jspdf").jsPDF,
  autoTable: (typeof import("jspdf-autotable"))["default"],
  payload: PdfPayload,
  scale: number,
  stretch: boolean,
): Built {
  const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // vgrajena pisava s šumniki
  doc.addFileToVFS("DejaVuSans.ttf", DEJAVU_SANS_BASE64);
  doc.addFileToVFS("DejaVuSans-Bold.ttf", DEJAVU_SANS_BOLD_BASE64);
  doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");

  const pageW = doc.internal.pageSize.getWidth(); // 297 mm
  const pageH = doc.internal.pageSize.getHeight(); // 210 mm
  const margin = 8;
  const color = payload.style === "color";
  const fs = (pt: number, min = 4.5) => Math.max(min, pt * scale);

  // --- Glava: samo ime učenca, sredinsko, veliko in krepko -----------------
  doc.setFont("DejaVu", "bold");
  doc.setFontSize(20);
  doc.setTextColor(0, 0, 0);
  const headerY = margin + 7;
  doc.text(payload.title, pageW / 2, headerY, { align: "center" });

  const tableTop = headerY + 5;
  const hasLegend = payload.mode === "abbr" && (payload.legend?.length ?? 0) > 0;
  const legendReserve = hasLegend ? 10 : 0;
  const bottomLimit = pageH - margin - legendReserve;
  const available = bottomLimit - tableTop;

  // --- Višine vrstic: odmori nižji, učne ure razdelijo preostanek ----------
  const lessonRows = payload.slots.filter((s) => s.kind !== "break").length || 1;
  const breakRows = payload.slots.length - lessonRows;
  const headRowH = Math.max(5, 9 * scale);
  const breakRowH = Math.max(3.5, 6 * scale);
  const lessonRowH = stretch
    ? Math.max(4, (available - headRowH - breakRows * breakRowH) / lessonRows)
    : 0;

  const firstLessonId = payload.slots.find((s) => s.kind !== "break")?.id ?? null;
  const head = [["", ...payload.days.map((d) => d.label)]];
  const body = payload.slots.map((s) => {
    const row = [`${s.title}\n${s.start} – ${s.end}`];
    for (const d of payload.days) {
      const cell = payload.cells[`${d.wd}-${s.id}`];
      if (!cell) {
        // počitnice / praznik / konec leta: ime se izpiše enkrat (v prvi učni uri)
        const off = d.breakName ?? d.holiday ?? (d.afterYear ? "Konec šolskega leta" : null);
        row.push(off && s.id === firstLessonId ? off : "");
      } else {
        const lines: string[] = [];
        if (cell.hasSubject) lines.push(cell.text);
        for (const e of cell.events ?? []) {
          lines.push(`${cell.hasSubject && !e.cancelled ? "▸ " : ""}${e.title}${e.cancelled ? " (odpade)" : ""}`);
          if (e.clock) lines.push(e.clock);
        }
        row.push(lines.join("\n"));
      }
    }
    return row;
  });

  // velikost pisave predmetov se prilagodi merilu in načinu prikaza
  const baseSubjectFont = payload.mode === "abbr" ? 13 : 11;
  const subjectFont = fs(baseSubjectFont);

  autoTable(doc, {
    startY: tableTop,
    margin: { left: margin, right: margin, bottom: margin + legendReserve },
    head,
    body,
    theme: "grid",
    tableWidth: pageW - margin * 2,
    styles: {
      font: "DejaVu",
      fontStyle: "bold",
      fontSize: subjectFont,
      cellPadding: Math.max(0.4, 1.2 * scale),
      valign: "middle",
      halign: "center",
      lineColor: color ? [205, 211, 218] : [120, 128, 138],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
      overflow: "linebreak",
    },
    headStyles: {
      fontStyle: "bold",
      fontSize: fs(11, 6),
      fillColor: color ? [6, 166, 107] : [255, 255, 255],
      textColor: color ? [255, 255, 255] : [0, 0, 0],
      lineColor: color ? [205, 211, 218] : [90, 98, 108],
      lineWidth: 0.3,
      minCellHeight: headRowH,
      cellPadding: Math.max(0.5, 1.4 * scale),
    },
    columnStyles: {
      0: { cellWidth: Math.max(18, 26 * Math.min(1.35, Math.max(scale, 0.7))), fontSize: fs(8.5, 5), fontStyle: "normal", textColor: [70, 76, 84] },
    },
    didParseCell: (data) => {
      const slot = payload.slots[data.row.index];

      if (data.section === "body" && slot) {
        data.cell.styles.minCellHeight = slot.kind === "break" ? breakRowH : lessonRowH;
        if (slot.kind === "break") {
          data.cell.styles.fontSize = fs(7.5, 4.5);
          data.cell.styles.fontStyle = "normal";
          data.cell.styles.fillColor = color ? [255, 243, 220] : [246, 246, 246];
          data.cell.styles.textColor = color ? [154, 94, 4] : [90, 96, 104];
        }
      }

      if (data.section !== "body" || data.column.index === 0) return;

      const day = payload.days[data.column.index - 1];
      const cell = payload.cells[`${day.wd}-${slot.id}`];
      if (!cell) {
        if (day.breakName) {
          data.cell.styles.fillColor = [236, 245, 208];
          data.cell.styles.textColor = [88, 127, 10];
        } else if (day.holiday) {
          data.cell.styles.fillColor = [255, 232, 237];
          data.cell.styles.textColor = [194, 23, 66];
        } else if (day.afterYear) {
          data.cell.styles.fillColor = [241, 243, 245];
          data.cell.styles.textColor = [107, 116, 128];
        }
        return;
      }

      const eventFont = fs(baseSubjectFont - 2, 4.5);
      const events = cell.events ?? [];
      const hasActive = events.some((e) => !e.cancelled);
      if (cell.hasSubject) {
        const pal = subjectColor(cell.colorIdx);
        data.cell.styles.fillColor = hexToRgb(pal.soft);
        data.cell.styles.textColor = color ? hexToRgb(pal.ink) : [0, 0, 0];
      }
      if (events.length > 0) {
        if (hasActive) {
          const first = events.find((e) => !e.cancelled);
          if (color && first) {
            const ep = eventColor(first.color ?? "amber");
            data.cell.styles.fillColor = hexToRgb(ep.soft);
            data.cell.styles.textColor = hexToRgb(ep.ink);
          } else {
            data.cell.styles.fillColor = [255, 240, 218];
            data.cell.styles.textColor = [0, 0, 0];
          }
        } else if (!cell.hasSubject) {
          data.cell.styles.fillColor = [236, 239, 242];
          data.cell.styles.textColor = [130, 138, 148];
        }
        if (!cell.hasSubject) data.cell.styles.fontSize = eventFont;
      }
    },
  });

  const lastY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? pageH;
  const fits = doc.getNumberOfPages() === 1 && lastY <= bottomLimit + 0.1;

  // --- Legenda kratic (samo v načinu s kraticami) --------------------------
  if (hasLegend && fits) {
    doc.setFont("DejaVu", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(60, 66, 74);
    const text = payload.legend!.join("   ·   ");
    const lines = doc.splitTextToSize(text, pageW - margin * 2);
    doc.text(lines.slice(0, 2), pageW / 2, Math.min(lastY + 4.5, pageH - margin - 1), {
      align: "center",
    });
  }

  return { doc, fits };
}

export async function exportTimetablePdf(payload: PdfPayload): Promise<void> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableMod.default;

  // Iščemo NAJVEČJE merilo (pisava, razmiki), pri katerem urnik še gre na eno
  // stran A4. Pri vsakem merilu najprej poskusimo raztegniti vrstice čez celo
  // stran, sicer uporabimo naravne višine vrstic. Binarno iskanje je dovolj
  // hitro (le nekaj risanj), saj se vsebina z merilom monotono povečuje.
  const attempt = (scale: number): Built => {
    const stretched = buildDoc(jsPDF, autoTable, payload, scale, true);
    if (stretched.fits) return stretched;
    return buildDoc(jsPDF, autoTable, payload, scale, false);
  };

  let lo = 0.4; // najmanjše merilo (vedno uporabimo, če nič večjega ne gre)
  let hi = 1.6; // zgornja meja povečave (pri večji bi se dolge besede lomile)
  let best: Built | null = null;

  const top = attempt(hi);
  if (top.fits) {
    best = top;
  } else {
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      const r = attempt(mid);
      if (r.fits) {
        best = r;
        lo = mid;
      } else {
        hi = mid;
      }
    }
  }
  const result = best ?? attempt(lo);

  result.doc.save(`${safeFileName(payload.fileName ?? payload.title)}.pdf`);
}
