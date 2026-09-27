export type ParsedSession = { date: string; start: string | null; end: string | null; isBreak: boolean; note: string | null };

const pad = (n: string) => n.padStart(2, "0");

/** Liest eine eingefügte Terminliste, z. B. "107.11.202611:00–11:45 Uhr" oder "—26.12.2026kein Termin – Weihnachtspause". */
export function parseSessionList(text: string): ParsedSession[] {
  const out: ParsedSession[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\t/g, " ").trim();
    if (!line) continue;
    const m =
      line.match(/^(\d{1,2}|[—–-])?\s*\.?\s*(\d{2})\.(\d{2})\.(\d{4})(.*)$/) ||
      line.match(/^(\d{1,2}\.?\s+|[—–-])?\s*(\d{1,2})\.(\d{1,2})\.(\d{4})(.*)$/);
    if (!m) continue;
    const dash = !!m[1] && /[—–-]/.test(m[1]);
    const date = `${m[4]}-${pad(m[3])}-${pad(m[2])}`;
    let rest = m[5].trim();
    const t = rest.match(/^(\d{1,2})[:.](\d{2})\s*(?:[–-]\s*(\d{1,2})[:.](\d{2}))?\s*(?:Uhr)?\s*(.*)$/);
    let start: string | null = null, end: string | null = null;
    if (t) {
      start = `${pad(t[1])}:${t[2]}`;
      end = t[3] ? `${pad(t[3])}:${t[4]}` : null;
      rest = t[5].trim();
    }
    const isBreak = dash || (!start && /kein|pause|ferien|entfällt/i.test(rest));
    out.push({ date, start, end, isBreak, note: rest || null });
  }
  return out;
}
