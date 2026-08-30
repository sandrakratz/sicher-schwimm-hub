// Server-only: PDF-Erzeugung der Kursbestätigung (pdf-lib, Worker-kompatibel).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";
import { buildConfirmationDoc, type ConfirmationInput } from "@/lib/course-confirmation";

const WIN_ANSI_SAFE = (s: string) =>
  (s || "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019\u201a]/g, "'")
    .replace(/[\u201c\u201d\u201e]/g, '"')
    .replace(/\u00a0/g, " ")
    .replace(/\u20ac/g, "EUR")
    .replace(/[^\x20-\x7E\u00A1-\u00FF]/g, "");

interface Cursor {
  y: number;
}

function writer(page: PDFPage, font: PDFFont, bold: PDFFont, cursor: Cursor) {
  const left = 56;
  const width = 595.28 - left * 2;
  return {
    text(value: string, opts: { size?: number; bold?: boolean; gap?: number; color?: [number, number, number] } = {}) {
      const size = opts.size ?? 10.5;
      const f = opts.bold ? bold : font;
      const color = opts.color ?? [0.06, 0.09, 0.16];
      const lines = wrap(WIN_ANSI_SAFE(value), f, size, width);
      for (const line of lines) {
        cursor.y -= size + 3;
        page.drawText(line, { x: left, y: cursor.y, size, font: f, color: rgb(color[0], color[1], color[2]) });
      }
      cursor.y -= opts.gap ?? 0;
    },
    row(label: string, value: string, size = 10.5) {
      const f = font;
      cursor.y -= size + 3;
      page.drawText(WIN_ANSI_SAFE(label), { x: left, y: cursor.y, size, font: bold, color: rgb(0.06, 0.09, 0.16) });
      const lines = wrap(WIN_ANSI_SAFE(value), f, size, width - 150);
      lines.forEach((line, i) => {
        if (i > 0) cursor.y -= size + 3;
        page.drawText(line, { x: left + 150, y: cursor.y, size, font: f, color: rgb(0.06, 0.09, 0.16) });
      });
    },
    rule(gap = 8) {
      cursor.y -= gap;
      page.drawLine({
        start: { x: left, y: cursor.y },
        end: { x: left + width, y: cursor.y },
        thickness: 0.7,
        color: rgb(0.8, 0.85, 0.9),
      });
      cursor.y -= 2;
    },
    space(v: number) {
      cursor.y -= v;
    },
  };
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): Array<string> {
  const paragraphs = text.split("\n");
  const out: Array<string> = [];
  for (const p of paragraphs) {
    const words = p.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        out.push(line);
        line = w;
      } else {
        line = candidate;
      }
    }
    out.push(line);
  }
  return out;
}

export async function renderConfirmationPdf(input: ConfirmationInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  await addConfirmationPage(pdf, input);
  return await pdf.save();
}

export async function renderConfirmationsPdf(inputs: Array<ConfirmationInput>): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (const input of inputs) await addConfirmationPage(pdf, input);
  return await pdf.save();
}

async function addConfirmationPage(pdf: PDFDocument, input: ConfirmationInput) {
  const d = buildConfirmationDoc(input);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]);
  const cursor: Cursor = { y: 800 };
  const w = writer(page, font, bold, cursor);

  w.text(d.org.name, { size: 13, bold: true });
  w.text(d.org.street, { size: 9.5 });
  w.text(d.org.zipCity, { size: 9.5 });
  w.text(d.org.register, { size: 9.5 });
  w.rule(14);

  w.space(12);
  w.text("Kursbestätigung und Zahlungsaufforderung", { size: 15, bold: true });
  w.space(6);
  w.row("Dokument-Nr.:", d.documentNo);
  w.row("Ausstellungsdatum:", d.issuedAtLabel);

  w.space(16);
  w.text("Zahlungspflichtige/r:", { bold: true });
  w.text(d.payerName);
  for (const line of d.payerLines) w.text(line);

  w.space(12);
  w.row("Teilnehmer/in:", d.childName);

  w.space(16);
  w.text("Gebuchter Schwimmkurs", { size: 12, bold: true });
  w.rule(6);
  w.space(4);
  w.row("Kurs:", d.courseTitle);
  w.row("Kurszeitraum:", d.periodLabel);
  w.row("Kurstage:", d.scheduleLabel);
  w.row("Kursort:", d.locationLabel);
  w.row("Anzahl der Einheiten:", d.unitLabel);

  w.space(12);
  w.row("Kursgebühr:", d.priceLabel, 12);

  w.space(12);
  w.text("Zahlungsbedingungen", { size: 12, bold: true });
  w.rule(6);
  w.space(4);
  w.row("Zahlungsart:", d.immediatePayment ? "Echtzeit-/Sofortüberweisung" : "Überweisung");
  w.row("Fällig bis:", d.immediatePayment ? `sofort (${d.dueDateLabel})` : d.dueDateLabel);
  w.row("Zahlungsziel:", d.paymentTermsLabel);

  w.space(16);
  w.text(d.paymentInstruction);
  w.space(8);
  w.row("Kontoinhaber:", d.bank.recipient);
  w.row("IBAN:", d.bank.iban);
  w.row("BIC:", d.bank.bic);
  w.row("Verwendungszweck:", d.paymentReference);

  w.space(16);
  w.text("Hinweis zur Umsatzsteuer:", { bold: true });
  w.text(d.org.vatNote);

  w.space(16);
  w.text("Vielen Dank für Ihre Anmeldung. Wir freuen uns auf die Teilnahme am Schwimmkurs.");

  w.space(24);
  w.text(`${d.org.city}, ${d.issuedAtLabel}`);
  w.space(10);
  w.text(d.org.signatory);
  w.text(`${d.org.email} · ${d.org.phone}`, { size: 9.5 });
}
