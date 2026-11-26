import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubjectAccessExport } from "./useSubjectAccessExport";

/** Datenauskunft nach Art. 15 DSGVO: alle gespeicherten Daten zu dieser E-Mail als Excel. */
export function SubjectAccessButton({ email }: { email: string }) {
  const { busy, run } = useSubjectAccessExport(email);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      title="Alle gespeicherten Daten zu dieser E-Mail-Adresse (Art. 15 DSGVO) – vor dem Versand prüfen"
      onClick={() => void run()}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Datenauskunft
    </Button>
  );
}
