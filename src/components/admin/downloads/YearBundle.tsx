import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadBase64 } from "@/lib/download";
import { todayBerlinIso } from "@/lib/format";
import {
  generateCourseConfirmations,
  generateCourseListXlsx,
  generateMeinVereinCsv,
  generateTaxParticipantListXlsx,
} from "@/lib/course-sessions.functions";
import { exportExamProtocol } from "@/lib/trainer-courses.functions";

type Course = { id: string; name: string; starts_on: string | null };
type FileRes = { filename: string; base64: string };

/** Base64 → Bytes (für ZIP) bzw. Text (für die zusammengeführte CSV). */
/** Byte-Order-Mark am Dateianfang (Excel braucht ihn für Umlaute in CSV). */
const BOM = String.fromCharCode(0xfeff);
const BOM_RE = new RegExp(`^${BOM}`);
const bytesOf = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const textOf = (b64: string) => new TextDecoder("utf-8").decode(bytesOf(b64)).replace(BOM_RE, "");
const toBase64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

const KINDS = {
  lists: {
    label: "Teilnehmerlisten",
    run: (c: Course) => generateCourseListXlsx({ data: { courseId: c.id } }),
  },
  tax: {
    label: "Steuerlisten",
    run: (c: Course) => generateTaxParticipantListXlsx({ data: { courseId: c.id } }),
  },
  protocols: {
    label: "Prüfungsprotokolle",
    run: (c: Course) => exportExamProtocol({ data: { courseId: c.id } }),
  },
  confirmations: {
    label: "Kursbestätigungen",
    run: (c: Course) => generateCourseConfirmations({ data: { courseId: c.id, format: "pdf" } }),
  },
} as const satisfies Record<string, { label: string; run: (c: Course) => Promise<FileRes> }>;

/**
 * Downloads für alle Kurse mit Beginn im gewählten Jahr: nutzt dieselben Exporte wie am einzelnen Kurs
 * (gleiches Aussehen, gleiche Protokollierung) und packt sie in eine ZIP-Datei bzw. eine CSV.
 */
export function YearBundle({ year, courses }: { year: number; courses: Course[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const list = courses.filter((c) => (c.starts_on ?? "").startsWith(`${year}-`));
  const today = todayBerlinIso();

  async function zip(kind: keyof typeof KINDS) {
    const k = KINDS[kind];
    // Steuerlisten gibt es erst ab Kursbeginn
    const targets = kind === "tax" ? list.filter((c) => (c.starts_on ?? "") <= today) : list;
    setBusy(kind);
    const skipped: string[] = [];
    try {
      const JSZip = (await import("jszip")).default;
      const z = new JSZip();
      for (const [i, c] of targets.entries()) {
        setProgress(`${i + 1}/${targets.length}`);
        try {
          const res = await k.run(c);
          z.file(res.filename, bytesOf(res.base64));
        } catch (e) {
          skipped.push(`${c.name}: ${e instanceof Error ? e.message : "nicht erstellt"}`);
        }
      }
      if (kind === "tax" && targets.length < list.length)
        skipped.push(
          `${list.length - targets.length} Kurs(e) noch nicht begonnen – Steuerliste erst ab Kursbeginn.`,
        );
      if (skipped.length) z.file("Hinweise.txt", skipped.join("\r\n"));
      const out = await z.generateAsync({ type: "uint8array" });
      downloadBase64(toBase64(out), `${k.label}_${year}.zip`, "application/zip");
      toast.success(
        `${targets.length - skipped.filter((s) => s.includes(":")).length} von ${list.length} Kursen` +
          (skipped.length ? " – Hinweise in der ZIP-Datei" : ""),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download fehlgeschlagen.");
    } finally {
      setBusy(null);
      setProgress("");
    }
  }

  /** Eine CSV für den MeinVerein-Import: Kopfzeile einmal, darunter alle Kurse. */
  async function meinVerein() {
    setBusy("mv");
    const parts: string[] = [];
    const failed: string[] = [];
    try {
      for (const [i, c] of list.entries()) {
        setProgress(`${i + 1}/${list.length}`);
        try {
          const res = await generateMeinVereinCsv({ data: { courseId: c.id } });
          const lines = textOf(res.base64)
            .split(/\r?\n/)
            .filter((l) => l.trim());
          parts.push(...(parts.length === 0 ? lines : lines.slice(1)));
        } catch {
          failed.push(c.name);
        }
      }
      if (parts.length === 0) throw new Error("Keine Buchungen in diesem Jahr.");
      const csv = BOM + parts.join("\r\n") + "\r\n";
      downloadBase64(
        toBase64(new TextEncoder().encode(csv)),
        `MeinVerein_${year}.csv`,
        "text/csv;charset=utf-8",
      );
      if (failed.length) toast.warning(`Nicht enthalten: ${failed.join(", ")}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download fehlgeschlagen.");
    } finally {
      setBusy(null);
      setProgress("");
    }
  }

  const button = (key: string, label: string, kind: string, onClick: () => void) => (
    <Button variant="outline" disabled={!!busy || list.length === 0} onClick={onClick}>
      {busy === key ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {label}
      <span className="text-xs text-muted-foreground">
        {busy === key && progress ? progress : kind}
      </span>
    </Button>
  );

  return (
    <div className="w-full space-y-2 rounded-lg border bg-muted/30 p-3">
      <p className="text-sm">
        <strong>Alle Kurse mit Beginn {year}</strong> ({list.length}) – zum Ablegen oder Ausdrucken,
        je Kurs eine Datei in einer ZIP:
      </p>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(KINDS) as Array<keyof typeof KINDS>).map((k) =>
          button(k, KINDS[k].label, "ZIP", () => void zip(k)),
        )}
        {button("mv", "MeinVerein-Import (alle Kurse)", "CSV", () => void meinVerein())}
      </div>
    </div>
  );
}
