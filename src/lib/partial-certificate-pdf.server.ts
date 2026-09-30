// Server-only: Teilleistungsnachweis (DPO-Zwischenbescheinigung) als PDF.
// Aussteller ist immer Michael Kratz mit Registrierungsnummer, inkl.
// hinterlegter Unterschrift, Vereinsstempel und Logo.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont } from "pdf-lib";
import { ORG, ASSOCIATION } from "@/lib/billing-config";
import {
  allCriteriaDone,
  countCriteriaDone,
  findExamLevel,
  firstCriterionDate,
  type ExamCriteriaState,
} from "@/lib/swim-exams";
import { LOGO_JPG_B64, SIGNATURE_PNG_B64, STAMP_PNG_B64 } from "@/lib/pdf-branding.server";

export const EXAMINER_NAME = "Michael Kratz";
export const EXAMINER_TITLE =
  "staatl. gepr. Fachkraft für Bäderbetriebe (Reg.-Nr. 88-5169 vom Regierungspräsident Düsseldorf)";

const A4: [number, number] = [595.28, 841.89];
const LEFT = 56;
const RIGHT = A4[0] - LEFT;
const WIDTH = RIGHT - LEFT;
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.42, 0.47, 0.55);
const GREEN = rgb(0.08, 0.5, 0.25);

const SAFE = (s: string) =>
  (s || "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019\u201a]/g, "'")
    .replace(/[\u201c\u201d\u201e]/g, '"')
    .replace(/\u00a0/g, " ")
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
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export function deDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().slice(0, 10);
}

export type PartialCertificateInput = {
  childName: string;
  dateOfBirth: string | null;
  examLevel: string;
  criteria: ExamCriteriaState;
  examDate: string | null;
  courseName: string;
  location: string | null;
  issuedOn: string;
  deadline: string;
};

/** True, wenn mindestens eine, aber nicht alle Teilleistungen erbracht sind. */
export function isPartial(level: string | null | undefined, criteria: ExamCriteriaState): boolean {
  if (!findExamLevel(level)) return false;
  return countCriteriaDone(level, criteria) > 0 && !allCriteriaDone(level, criteria);
}

export async function renderPartialCertificatePdf(input: PartialCertificateInput): Promise<Uint8Array> {
  const level = findExamLevel(input.examLevel);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedJpg(Buffer.from(LOGO_JPG_B64, "base64"));
  const signature = await pdf.embedPng(Buffer.from(SIGNATURE_PNG_B64, "base64"));
  const stamp = await pdf.embedPng(Buffer.from(STAMP_PNG_B64, "base64"));
  const page = pdf.addPage(A4);
  let y = A4[1] - 56;

  const text = (s: string, o: { size?: number; b?: boolean; x?: number; color?: ReturnType<typeof rgb> } = {}) =>
    page.drawText(SAFE(s), { x: o.x ?? LEFT, y, size: o.size ?? 10, font: o.b ? bold : font, color: o.color ?? INK });
  const para = (s: string, size = 9.5, color = INK) => {
    for (const l of wrap(s, font, size, WIDTH)) {
      text(l, { size, color });
      y -= size + 3.5;
    }
  };

  // Briefkopf
  const logoSize = 64;
  page.drawImage(logo, { x: RIGHT - logoSize, y: y - logoSize + 14, width: logoSize, height: logoSize });
  text(ORG.name, { size: 14, b: true });
  y -= 14;
  text(`${ORG.street}, ${ORG.zipCity}`, { size: 9, color: MUTED });
  y -= 11;
  text(`Mitglied im ${ASSOCIATION.name}`, { size: 9, color: MUTED });
  y -= 36;

  text("Teilleistungsnachweis", { size: 17, b: true });
  y -= 16;
  text("nach der Deutschen Prüfungsordnung Schwimmen (DPO)", { size: 10.5, color: MUTED });
  y -= 26;

  const row = (label: string, value: string) => {
    text(label, { size: 10, color: MUTED });
    text(value, { size: 10, b: true, x: LEFT + 120 });
    y -= 15;
  };
  row("Name:", input.childName || "-");
  row("Geburtsdatum:", deDate(input.dateOfBirth));
  row("Abzeichen:", level?.label ?? input.examLevel);
  row("Kurs:", `${input.courseName}${input.location ? ` (${input.location})` : ""}`);
  row("Ausgestellt am:", deDate(input.issuedOn));
  y -= 10;

  para(
    `${input.childName || "Das Kind"} hat im Rahmen des Schwimmkurses die folgenden Teilleistungen des Abzeichens erfolgreich abgelegt. Die noch offenen Teilleistungen können in jedem Schwimmbad bei einer prüfberechtigten Person nachgeholt werden.`,
  );
  y -= 10;

  page.drawLine({ start: { x: LEFT, y: y + 4 }, end: { x: RIGHT, y: y + 4 }, thickness: 0.8, color: rgb(0.8, 0.85, 0.9) });
  y -= 10;
  for (const c of level?.criteria ?? []) {
    const st = input.criteria?.[c.key];
    const done = st?.done === true;
    const lines = wrap(c.label, done ? bold : font, 9.5, WIDTH - 150);
    text(done ? "[X]" : "[  ]", { size: 10, b: true, color: done ? GREEN : MUTED });
    const doneDate = st?.date ?? input.examDate;
    text(done ? `Bestanden${doneDate ? ` am ${deDate(doneDate)}` : ""}` : "Noch abzulegen", {
      size: 9,
      b: done,
      x: RIGHT - 118,
      color: done ? GREEN : MUTED,
    });
    lines.forEach((l, i) => {
      page.drawText(l, { x: LEFT + 26, y: y - i * 12.5, size: 9.5, font: done ? bold : font, color: INK });
    });
    y -= lines.length * 12.5;
    const extras: string[] = [];
    if (done && st?.value) extras.push(`${c.valueLabel || "Wert"}: ${st.value}`);
    if (done && st?.total) extras.push(`${c.totalLabel || "Gesamt"}: ${st.total}`);
    if (extras.length) {
      page.drawText(SAFE(extras.join(" · ")), { x: LEFT + 26, y, size: 8.5, font, color: MUTED });
      y -= 12;
    }
    y -= 6;
  }
  page.drawLine({ start: { x: LEFT, y: y + 6 }, end: { x: RIGHT, y: y + 6 }, thickness: 0.8, color: rgb(0.8, 0.85, 0.9) });
  y -= 14;

  text("Wichtiger Hinweis zur Frist", { size: 10.5, b: true });
  y -= 14;
  para(
    `Nach der DPO müssen alle Teilleistungen eines Abzeichens innerhalb von 2 Monaten nach der ersten bestandenen Teilprüfung abgelegt werden. Die fehlenden Teilleistungen sind daher bis spätestens ${deDate(input.deadline)} abzulegen. Bitte legen Sie diesen Nachweis bei der Prüfung im Schwimmbad vor; dort kann nach Erfüllung aller Teilleistungen das Abzeichen ausgestellt werden.`,
  );

  // Unterschrift + Stempel
  y -= 18;
  const sigW = 150;
  const sigH = (signature.height / signature.width) * sigW;
  const stampW = 105;
  const stampH = (stamp.height / stamp.width) * stampW;
  const lineY = Math.max(y - Math.max(sigH, 60), 90);
  page.drawImage(signature, { x: LEFT, y: lineY + 2, width: sigW, height: sigH });
  page.drawImage(stamp, { x: RIGHT - stampW, y: lineY - 10, width: stampW, height: stampH });
  page.drawLine({ start: { x: LEFT, y: lineY }, end: { x: LEFT + 240, y: lineY }, thickness: 0.6, color: INK });
  y = lineY - 13;
  text(`${EXAMINER_NAME}, ${deDate(input.issuedOn)}`, { size: 9.5, b: true });
  y -= 12;
  for (const l of wrap(EXAMINER_TITLE, font, 8.5, 260)) {
    text(l, { size: 8.5, color: MUTED });
    y -= 11;
  }

  return pdf.save();
}

type Loaded = {
  bytes: Uint8Array;
  filename: string;
  childName: string;
  levelLabel: string;
  deadline: string;
  email: string | null;
  parentName: string | null;
  courseId: string;
};

/** Lädt die Daten eines Kindes und erstellt den Nachweis (nur bei offenen Teilleistungen). */
export async function buildPartialCertificate(participantId: string, issuedOn: string): Promise<Loaded | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: p } = await supabaseAdmin
    .from("course_participants")
    .select(
      "id,course_id,participant_name,participant_email,date_of_birth,exam_level,exam_criteria,exam_date,course_requests(parent_name),courses!course_participants_course_id_fkey(name,location,ends_on)",
    )
    .eq("id", participantId)
    .maybeSingle();
  if (!p) return null;
  const criteria = (p.exam_criteria ?? {}) as ExamCriteriaState;
  if (!isPartial(p.exam_level, criteria)) return null;
  const course = (p as any).courses as { name?: string; location?: string | null; ends_on?: string | null } | null;
  const base = firstCriterionDate(criteria) ?? (p.exam_date as string | null) ?? course?.ends_on ?? issuedOn;
  const deadline = addMonths(base, 2);
  const childName = (p.participant_name ?? "") as string;
  const bytes = await renderPartialCertificatePdf({
    childName,
    dateOfBirth: (p.date_of_birth ?? null) as string | null,
    examLevel: p.exam_level as string,
    criteria,
    examDate: (p.exam_date ?? null) as string | null,
    courseName: course?.name ?? "",
    location: course?.location ?? null,
    issuedOn,
    deadline,
  });
  const safe = (s: string) => s.replace(/[^\p{L}\p{N}\-_]+/gu, "_").slice(0, 60);
  return {
    bytes,
    filename: `Teilleistungsnachweis_${safe(childName || "Kind")}.pdf`,
    childName,
    levelLabel: findExamLevel(p.exam_level)?.label ?? String(p.exam_level),
    deadline,
    email: (p.participant_email ?? null) as string | null,
    parentName: ((p as any).course_requests?.parent_name as string | null) ?? null,
    courseId: p.course_id as string,
  };
}
