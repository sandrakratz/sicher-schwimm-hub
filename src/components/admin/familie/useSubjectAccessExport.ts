import { useState } from "react";
import { toast } from "sonner";
import { downloadBase64 } from "@/lib/download";
import { exportSubjectAccess } from "@/lib/reports.functions";

/** Datenauskunft nach Art. 15 DSGVO: lädt alle gespeicherten Daten zu dieser E-Mail als Excel. */
export function useSubjectAccessExport(email: string) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const res = await exportSubjectAccess({ data: { email } });
      downloadBase64(
        res.base64,
        res.filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Datenauskunft fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}
