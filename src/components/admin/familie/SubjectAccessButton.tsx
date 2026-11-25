import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadBase64 } from "@/lib/download";
import { exportSubjectAccess } from "@/lib/reports.functions";

/** Datenauskunft nach Art. 15 DSGVO: alle gespeicherten Daten zu dieser E-Mail als Excel. */
export function SubjectAccessButton({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      title="Alle gespeicherten Daten zu dieser E-Mail-Adresse (Art. 15 DSGVO) – vor dem Versand prüfen"
      onClick={async () => {
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
      }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Datenauskunft
    </Button>
  );
}
