/** Liest ein PDF im Browser und gibt den Text zeilenweise zurück (Zeilen nach senkrechter Position gebildet). */
export async function extractPdfLines(file: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const rows: { y: number; items: { x: number; s: string }[] }[] = [];
    for (const it of content.items as any[]) {
      if (typeof it.str !== "string" || !it.str.trim()) continue;
      const y = it.transform[5] as number;
      const x = it.transform[4] as number;
      let row = rows.find((r) => Math.abs(r.y - y) < 3);
      if (!row) rows.push((row = { y, items: [] }));
      row.items.push({ x, s: it.str });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows)
      lines.push(
        r.items
          .sort((a, b) => a.x - b.x)
          .map((i) => i.s)
          .join(" "),
      );
  }
  return lines;
}
