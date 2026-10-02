import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  exportPartialCertificate,
  sendPartialCertificateNow,
} from "@/lib/trainer-courses.functions";

const STATUS_TEXT: Record<string, string> = {
  sent: "Nachweis wurde an die Eltern geschickt.",
  no_email: "Keine E-Mail-Adresse der Eltern hinterlegt.",
  not_partial: "Kein Teilleistungsnachweis nötig.",
  failed: "Versand fehlgeschlagen.",
};

/** Download und manueller Versand des Teilleistungsnachweises (DPO). */
export function PartialCertificateActions({ participantId }: { participantId: string }) {
  const exportFn = useServerFn(exportPartialCertificate);
  const sendFn = useServerFn(sendPartialCertificateNow);
  const [busy, setBusy] = useState<"pdf" | "mail" | null>(null);

  async function download() {
    setBusy("pdf");
    try {
      const res = await exportFn({ data: { participantId } });
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as Error)?.message || "Download fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!window.confirm("Teilleistungsnachweis jetzt per E-Mail an die Eltern schicken?")) return;
    setBusy("mail");
    try {
      const res = await sendFn({ data: { participantId } });
      const msg = STATUS_TEXT[res.status] ?? res.status;
      if (res.status === "sent") toast.success(msg);
      else toast.error(msg);
    } catch (e) {
      toast.error((e as Error)?.message || "Versand fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        onClick={download}
        disabled={busy !== null}
      >
        <FileText className="mr-2 h-4 w-4" />{" "}
        {busy === "pdf" ? "Erstelle…" : "Teilleistungsnachweis (PDF)"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="min-h-11"
        onClick={send}
        disabled={busy !== null}
      >
        <Send className="mr-2 h-4 w-4" /> {busy === "mail" ? "Sende…" : "An Eltern senden"}
      </Button>
    </div>
  );
}
