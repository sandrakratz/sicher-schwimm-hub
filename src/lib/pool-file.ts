import { extractPdfLines } from "@/lib/pool-pdf";

const pad = (n: number) => String(n).padStart(2, "0");

/** Zelle einer Excel-Datei als Text; Datum und Uhrzeit so, wie der Plan-Leser sie erwartet. */
function cellText(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    // Excel-Uhrzeiten liegen am 30.12.1899 bzw. 31.12.1899.
    if (v.getUTCFullYear() < 1910) return `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`;
    return `${pad(v.getUTCDate())}.${pad(v.getUTCMonth() + 1)}.${v.getUTCFullYear()}`;
  }
  if (typeof v === "number" && v > 0 && v < 1) {
    const m = Math.round(v * 24 * 60);
    return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  }
  if (typeof v === "object") {
    const o = v as { text?: unknown; result?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    return cellText(o.result ?? o.text ?? "");
  }
  return String(v);
}

async function excelLines(file: File): Promise<string[]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const lines: string[] = [];
  wb.eachSheet((ws) => {
    ws.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: false }, (c) => cells.push(cellText(c.value)));
      if (cells.length) lines.push(cells.join(" "));
    });
  });
  return lines;
}

async function wordLines(file: File): Promise<string[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("Word-Datei ohne Inhalt");
  return xml
    .replace(/<\/w:tc>/g, " ")
    .replace(/<\/w:(p|tr)>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .split("\n");
}

/** Liest einen Nutzungsplan aus PDF, Excel, Word, CSV oder Text und gibt ihn zeilenweise zurück. */
export async function extractPlanLines(file: File): Promise<string[]> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return extractPdfLines(file);
  if (ext === "xlsx" || ext === "xlsm") return excelLines(file);
  if (ext === "docx") return wordLines(file);
  if (["csv", "tsv", "txt", "md"].includes(ext)) {
    return (await file.text()).split(/\r?\n/).map((l) => l.replace(/[;\t]/g, " "));
  }
  throw new Error(
    `Dateityp „.${ext}“ wird nicht unterstützt. Möglich: PDF, Excel (.xlsx), Word (.docx), CSV, Text.`,
  );
}
