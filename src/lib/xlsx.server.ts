// Einfache Excel-Dateien für Exporte: je Blatt Titel, Hinweis, Kopfzeile und Zeilen.
// Nur serverseitig (exceljs); Rückgabe als Base64 für downloadBase64 im Browser.

/** Excel-Formel (englische Funktionsnamen, Excel zeigt sie in der eigenen Sprache an). */
export type FormulaCell = { formula: string };
/** Gelb markiertes Eingabefeld, optional mit Auswahlliste. */
export type InputCell = { input: string | number; options?: string[] };

export type Sheet = {
  name: string;
  title?: string;
  /** Kleingedruckter Hinweis unter dem Titel (z. B. Stichtag, Datenschutz) */
  note?: string;
  header: string[];
  rows: unknown[][];
  /** Summenzeile am Ende (fett) */
  footer?: unknown[];
  /** Filter-Pfeile in der Kopfzeile (Daten → Filter) */
  filter?: boolean;
};

/** Erste Datenzeile eines Blatts mit Titel und Hinweis (Titel, Hinweis, Leerzeile, Kopfzeile). */
export const FIRST_DATA_ROW = 5;

const isFormula = (v: unknown): v is FormulaCell =>
  typeof v === "object" && v != null && "formula" in v;
const isInput = (v: unknown): v is InputCell => typeof v === "object" && v != null && "input" in v;

const cell = (v: unknown) =>
  v == null
    ? ""
    : isFormula(v)
      ? { formula: v.formula }
      : isInput(v)
        ? v.input
        : typeof v === "object"
          ? JSON.stringify(v)
          : (v as string | number | boolean);

const text = (v: unknown) => (isFormula(v) ? "" : String(cell(v)));

const thin = { style: "thin" as const, color: { argb: "FFCA8A04" } };

export async function workbookBase64(sheets: Sheet[]): Promise<string> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  // Formeln beim Öffnen berechnen (exceljs schreibt keine Ergebnisse)
  wb.calcProperties.fullCalcOnLoad = true;
  for (const s of sheets) {
    // Excel erlaubt höchstens 31 Zeichen und keine Sonderzeichen []:*?/\ im Blattnamen
    const ws = wb.addWorksheet(s.name.replace(/[[\]:*?/\\]/g, " ").slice(0, 31));
    if (s.title) ws.addRow([s.title]).font = { bold: true, size: 14 };
    if (s.note) ws.addRow([s.note]).font = { italic: true, size: 9, color: { argb: "FF555555" } };
    if (s.title || s.note) ws.addRow([]);
    const head = ws.addRow(s.header);
    head.font = { bold: true };
    head.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F2FE" } };
    });
    for (const r of s.rows) {
      const row = ws.addRow(r.map(cell));
      r.forEach((v, i) => {
        if (!isInput(v)) return;
        const c = row.getCell(i + 1);
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF08A" } };
        c.border = { top: thin, left: thin, bottom: thin, right: thin };
        if (v.options)
          c.dataValidation = {
            type: "list",
            allowBlank: false,
            showErrorMessage: true,
            formulae: [`"${v.options.join(",")}"`],
          };
      });
    }
    if (s.footer) ws.addRow(s.footer.map(cell)).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: head.number }];
    if (s.filter)
      ws.autoFilter = {
        from: { row: head.number, column: 1 },
        to: { row: head.number + s.rows.length, column: s.header.length },
      };
    s.header.forEach((h, i) => {
      const width = Math.max(h.length, ...s.rows.slice(0, 200).map((r) => text(r[i]).length));
      // mit Filter etwas breiter, damit der Pfeil die Überschrift nicht verdeckt
      ws.getColumn(i + 1).width = Math.min(Math.max(width + (s.filter ? 4 : 2), 8), 60);
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer).toString("base64");
}
