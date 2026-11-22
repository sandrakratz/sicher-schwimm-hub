// Server-only: Anwesenheitsnachweis Mitgliederschwimmen als PDF für die Vereinsakte
// (Versicherung, Aufbewahrung 2 Jahre). pdf-lib, Worker-kompatibel.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFPage } from "pdf-lib";
import { ORG } from "@/lib/billing-config";
import { todayBerlinIso } from "@/lib/format";

const A4: [number, number] = [595.28, 841.89];
const LEFT = 48;
const RIGHT = A4[0] - LEFT;
const INK: [number, number, number] = [0.06, 0.09, 0.16];
const MUTED: [number, number, number] = [0.42, 0.47, 0.55];

// Helvetica (WinAnsi) kann nur Latin-1; alles andere entfernen, damit das Rendern nie abbricht.
const SAFE = (s: string) =>
  (s || "")
    .replace(/[–—]/g, "-")
    .replace(/ /g, " ")
    .replace(/[^\x20-\x7E¡-ÿ]/g, "");

const deDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
};

export type FamilySwimAttendanceInput = {
  year: number;
  events: Array<{
    date: string;
    time: string;
    location: string;
    rows: Array<{ name: string; role: "adult" | "child"; present: boolean }>;
  }>;
};

export async function renderFamilySwimAttendancePdf(
  input: FamilySwimAttendanceInput,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages: PDFPage[] = [];
  let page = pdf.addPage(A4);
  pages.push(page);
  let y = A4[1] - 52;

  const text = (
    t: string,
    o: { size?: number; bold?: boolean; x?: number; color?: [number, number, number] } = {},
  ) => {
    const c = o.color ?? INK;
    page.drawText(SAFE(t), {
      x: o.x ?? LEFT,
      y,
      size: o.size ?? 9.5,
      font: o.bold ? bold : font,
      color: rgb(c[0], c[1], c[2]),
    });
  };
  const ensure = (needed: number) => {
    if (y - needed > 60) return;
    page = pdf.addPage(A4);
    pages.push(page);
    y = A4[1] - 52;
  };

  text(ORG.name, { size: 13, bold: true });
  y -= 13;
  text(`${ORG.street}, ${ORG.zipCity}`, { size: 8.5, color: MUTED });
  y -= 24;
  text(`Mitgliederschwimmen: Anwesenheitsnachweis ${input.year}`, { size: 12, bold: true });
  y -= 14;
  text(`Erstellt am ${deDate(todayBerlinIso())} · vertraulich, enthält Namen von Mitgliedern`, {
    size: 8.5,
    color: MUTED,
  });
  y -= 22;

  if (input.events.length === 0) {
    text("Für dieses Jahr sind keine erfassten Termine vorhanden.");
  }

  for (const e of input.events) {
    const here = e.rows.filter((r) => r.present).length;
    ensure(60);
    text(`${deDate(e.date)} · ${e.time} Uhr · ${e.location}`, { size: 10.5, bold: true });
    y -= 13;
    text(`${here} von ${e.rows.length} angemeldeten Personen anwesend`, {
      size: 8.5,
      color: MUTED,
    });
    y -= 14;
    for (const r of e.rows) {
      ensure(16);
      text(r.name || "-", { x: LEFT + 6 });
      text(r.role === "child" ? "Kind" : "Erwachsen", { x: LEFT + 250, color: MUTED });
      text(r.present ? "anwesend" : "nicht anwesend", {
        x: RIGHT - 80,
        bold: r.present,
        color: r.present ? INK : MUTED,
      });
      y -= 13.5;
    }
    y -= 12;
  }

  pages.forEach((p, i) =>
    p.drawText(`Seite ${i + 1} von ${pages.length}`, {
      x: RIGHT - 60,
      y: 30,
      size: 8,
      font,
      color: rgb(MUTED[0], MUTED[1], MUTED[2]),
    }),
  );
  return pdf.save();
}
