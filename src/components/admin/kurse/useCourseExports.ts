import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  generateCourseListXlsx,
  generateTaxParticipantListXlsx,
  generateCourseConfirmations,
  generateMeinVereinCsv,
  generateTrainerProofXlsx,
} from "@/lib/course-sessions.functions";
import { exportExamProtocol } from "@/lib/trainer-courses.functions";
import { downloadBase64 } from "@/lib/download";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Dateiexporte der Kursverwaltung (Excel, PDF, ZIP, CSV) samt „wird erstellt“-Zuständen. */
export function useCourseExports() {
  const exportXlsx = useServerFn(generateCourseListXlsx);
  const exportTrainerProof = useServerFn(generateTrainerProofXlsx);
  const exportTaxXlsx = useServerFn(generateTaxParticipantListXlsx);
  const exportConfirmationsFn = useServerFn(generateCourseConfirmations);
  const exportProtocolFn = useServerFn(exportExamProtocol);
  const exportMeinVereinFn = useServerFn(generateMeinVereinCsv);

  const [exporting, setExporting] = useState<string | null>(null);
  const [exportingTax, setExportingTax] = useState<string | null>(null);
  const [exportingConf, setExportingConf] = useState<string | null>(null);
  const [exportingProtocol, setExportingProtocol] = useState<string | null>(null);
  const [exportingCsv, setExportingCsv] = useState<string | null>(null);
  const [proofBusy, setProofBusy] = useState(false);
  // Im Januar/Februar wird meist der Nachweis fürs Vorjahr gebraucht
  const [proofYear, setProofYear] = useState(() => {
    const now = new Date();
    return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
  });

  /** Führt einen Export aus: „wird erstellt“ an, Fehler als Meldung, „wird erstellt“ wieder aus. */
  async function run(setBusy: (busy: boolean) => void, task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
    } catch (e: any) {
      toast.error(e?.message || "Export fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  const exportCourseList = (courseId: string) =>
    run(
      (busy) => setExporting(busy ? courseId : null),
      async () => {
        const res = await exportXlsx({ data: { courseId } });
        downloadBase64(res.base64, res.filename, XLSX);
        toast.success("Excel-Kursliste erstellt");
      },
    );

  const downloadTrainerProof = () =>
    run(setProofBusy, async () => {
      const res = await exportTrainerProof({ data: { year: proofYear } });
      downloadBase64(res.base64, res.filename, XLSX);
      toast.success("Trainer-Nachweis erstellt");
    });

  const exportTaxList = (courseId: string) =>
    run(
      (busy) => setExportingTax(busy ? courseId : null),
      async () => {
        const res = await exportTaxXlsx({ data: { courseId } });
        downloadBase64(res.base64, res.filename, XLSX);
        toast.success("Teilnehmerliste (Steuer) erstellt");
      },
    );

  const exportConfirmations = (courseId: string, format: "pdf" | "zip") =>
    run(
      (busy) => setExportingConf(busy ? `${courseId}-${format}` : null),
      async () => {
        const res = await exportConfirmationsFn({ data: { courseId, format } });
        downloadBase64(
          res.base64,
          res.filename,
          format === "pdf" ? "application/pdf" : "application/zip",
        );
        toast.success("Kursbestätigungen erstellt");
      },
    );

  // Prüfungsprotokoll nach DPO für die Vereinsakte.
  const exportProtocol = (courseId: string) =>
    run(
      (busy) => setExportingProtocol(busy ? courseId : null),
      async () => {
        const res = await exportProtocolFn({ data: { courseId } });
        downloadBase64(res.base64, res.filename, "application/pdf");
        toast.success("Prüfungsprotokoll erstellt");
      },
    );

  const exportMeinVerein = (courseId: string) =>
    run(
      (busy) => setExportingCsv(busy ? courseId : null),
      async () => {
        const res = await exportMeinVereinFn({ data: { courseId } });
        downloadBase64(res.base64, res.filename, "text/csv;charset=utf-8");
        toast.success(
          res.missingDocNo > 0
            ? `CSV erstellt (${res.rows} Posten, davon ${res.missingDocNo} ohne Rechnungsnummer)`
            : `CSV erstellt (${res.rows} Posten)`,
        );
      },
    );

  return {
    exporting,
    exportingTax,
    exportingConf,
    exportingProtocol,
    exportingCsv,
    proofBusy,
    proofYear,
    setProofYear,
    exportCourseList,
    downloadTrainerProof,
    exportTaxList,
    exportConfirmations,
    exportProtocol,
    exportMeinVerein,
  };
}
