// Einfache Excel-Dateien für Exporte: je Blatt Titel, Hinweis, Kopfzeile und Zeilen.
// Nur serverseitig (exceljs); Rückgabe als Base64 für downloadBase64 im Browser.

export type Sheet = {
  name: string;
  title?: string;
  /** Kleingedruckter Hinweis unter dem Titel (z. B. Stichtag, Datenschutz) */
  note?: string;
  header: string[];
  rows: unknown[][];
  /** Summenzeile am Ende (fett) */
  footer?: unknown[];
};

const cell = (v: unknown) =>
  v == null ? "" : typeof v === "object" ? JSON.stringify(v) : (v as string | number | boolean);

export async function workbookBase64(sheets: Sheet[]): Promise<string> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
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
    for (const r of s.rows) ws.addRow(r.map(cell));
    if (s.footer) ws.addRow(s.footer.map(cell)).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: head.number }];
    s.header.forEach((h, i) => {
      const width = Math.max(
        h.length,
        ...s.rows.slice(0, 200).map((r) => String(cell(r[i])).length),
      );
      ws.getColumn(i + 1).width = Math.min(Math.max(width + 2, 8), 60);
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer).toString("base64");
}
