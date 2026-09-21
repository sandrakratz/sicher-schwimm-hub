// Server-only: Prüfungsprotokoll nach der Deutschen Prüfungsordnung Schwimmen (DPO)
// als PDF für die Vereinsakte (pdf-lib, Worker-kompatibel).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";
import { ORG, ASSOCIATION } from "@/lib/billing-config";
import { findExamLevel, examLevelLabel, type ExamCriteriaState } from "@/lib/swim-exams";

const A4: [number, number] = [595.28, 841.89];
const LEFT = 48;
const RIGHT = A4[0] - LEFT;
const WIDTH = RIGHT - LEFT;
const INK: [number, number, number] = [0.06, 0.09, 0.16];
const MUTED: [number, number, number] = [0.42, 0.47, 0.55];

const SAFE = (s: string) =>
  (s || "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019\u201a]/g, "'")
    .replace(/[\u201c\u201d\u201e]/g, '"')
    .replace(/\u00a0/g, " ")
    .replace(/\u20ac/g, "EUR")
    .replace(/[^\x20-\x7E\u00A1-\u00FF]/g, "");

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): Array<string> {
  const words = SAFE(text).split(/\s+/).filter(Boolean);
  const lines: Array<string> = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export type ExamProtocolParticipant = {
  name: string;
  dateOfBirth: string | null;
  examLevel: string | null;
  criteria: ExamCriteriaState;
  examDate: string | null;
  passNo: string | null;
  goalReached: boolean | null;
  badge: string | null;
  achievement: string | null;
};

export type ExamProtocolInput = {
  courseName: string;
  location: string | null;
  schedule: string | null;
  startsOn: string | null;
  endsOn: string | null;
  examinerName: string;
  participants: Array<ExamProtocolParticipant>;
};

function deDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

export async function renderExamProtocolPdf(input: ExamProtocolInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage(A4);
  let y = A4[1] - 52;

  const draw = (
    text: string,
    opts: { size?: number; bold?: boolean; x?: number; color?: [number, number, number] } = {},
  ) => {
    const size = opts.size ?? 9.5;
    const f = opts.bold ? bold : font;
    const color = opts.color ?? INK;
    page.drawText(SAFE(text), {
      x: opts.x ?? LEFT,
      y,
      size,
      font: f,
      color: rgb(color[0], color[1], color[2]),
    });
  };

  const ensure = (needed: number) => {
    if (y - needed > 64) return;
    page = pdf.addPage(A4);
    y = A4[1] - 52;
  };

  const header = () => {
    draw(ORG.name, { size: 13, bold: true });
    y -= 13;
    draw(`${ORG.street}, ${ORG.zipCity} · Mitglied im ${ASSOCIATION.name}`, { size: 8.5, color: MUTED });
    y -= 22;
    draw("Prüfungsprotokoll nach der Deutschen Prüfungsordnung Schwimmen (DPO)", { size: 12, bold: true });
    y -= 16;
    draw(`Kurs: ${input.courseName}`, { size: 10 });
    y -= 12;
    draw(
      `Kursort: ${input.location || "—"} · Zeiten: ${input.schedule || "—"} · Zeitraum: ${deDate(input.startsOn)} bis ${deDate(input.endsOn)}`,
      { size: 9, color: MUTED },
    );
    y -= 12;
    draw(`Abnehmende Trainerin / abnehmender Trainer: ${input.examinerName}`, { size: 9, color: MUTED });
    y -= 10;
    page.drawLine({
      start: { x: LEFT, y },
      end: { x: RIGHT, y },
      thickness: 0.8,
      color: rgb(0.8, 0.85, 0.9),
    });
    y -= 18;
  };

  header();

  if (input.participants.length === 0) {
    draw("Keine Teilnehmenden erfasst.", { size: 10, color: MUTED });
  }

  for (const p of input.participants) {
    const level = findExamLevel(p.examLevel);
    const rows = level ? level.criteria.length : 1;
    ensure(56 + rows * 13);

    draw(p.name || "—", { size: 10.5, bold: true });
    draw(`geb. ${deDate(p.dateOfBirth)}`, { size: 9, color: MUTED, x: LEFT + 240 });
    y -= 13;
    draw(`Abzeichen: ${p.examLevel ? examLevelLabel(p.examLevel) : p.badge || "—"}`, { size: 9 });
    y -= 12;
    draw(
      `Prüfungsdatum: ${deDate(p.examDate)} · Schwimmpass-Nr.: ${p.passNo || "—"} · Ergebnis: ${
        p.goalReached === true ? "bestanden" : p.goalReached === false ? "nicht bestanden" : "offen"
      }`,
      { size: 9, color: MUTED },
    );
    y -= 14;

    if (level) {
      for (const c of level.criteria) {
        const state = p.criteria?.[c.key];
        const mark = state?.done ? "[X]" : "[  ]";
        const suffix = state?.value ? ` (${c.valueLabel || "Wert"}: ${state.value})` : "";
        const lines = wrap(`${mark} ${c.label}${suffix}`, font, 9, WIDTH - 16);
        for (const line of lines) {
          ensure(16);
          draw(line, { size: 9, x: LEFT + 12 });
          y -= 11.5;
        }
      }
    } else {
      draw("Keine Prüfungsstufe ausgewählt.", { size: 9, x: LEFT + 12, color: MUTED });
      y -= 11.5;
    }

    if (p.achievement) {
      for (const line of wrap(`Anmerkung: ${p.achievement}`, font, 8.5, WIDTH - 16)) {
        ensure(16);
        draw(line, { size: 8.5, x: LEFT + 12, color: MUTED });
        y -= 11;
      }
    }

    y -= 6;
    page.drawLine({
      start: { x: LEFT, y },
      end: { x: RIGHT, y },
      thickness: 0.5,
      color: rgb(0.88, 0.91, 0.94),
    });
    y -= 14;
  }

  // Unterschriftsfeld für die Vereinsakte
  ensure(90);
  y -= 20;
  draw(
    "Hiermit wird bestätigt, dass die vorstehenden Leistungen nach der Deutschen Prüfungsordnung Schwimmen",
    { size: 8.5, color: MUTED },
  );
  y -= 11;
  draw("persönlich abgenommen und geprüft wurden.", { size: 8.5, color: MUTED });
  y -= 40;
  page.drawLine({ start: { x: LEFT, y }, end: { x: LEFT + 200, y }, thickness: 0.7, color: rgb(0.5, 0.55, 0.6) });
  page.drawLine({ start: { x: LEFT + 240, y }, end: { x: RIGHT, y }, thickness: 0.7, color: rgb(0.5, 0.55, 0.6) });
  y -= 11;
  draw("Ort, Datum", { size: 8.5, color: MUTED });
  draw("Unterschrift der prüfenden Person (Lizenz-Nr.)", { size: 8.5, color: MUTED, x: LEFT + 240 });

  return await pdf.save();
}
