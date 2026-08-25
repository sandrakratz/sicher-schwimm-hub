import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { sendTestEmails, TEST_TEMPLATES } from "@/lib/email-test.functions";
import { templateLabel } from "@/lib/email-template-labels";

type Result = { recipient: string; template: string; label: string; sent: boolean; reason?: string; error?: string };

const STORAGE_KEY = "ssv-test-recipients";

export function TestSendDialog({ onDone }: { onDone?: () => void }) {
  const run = useServerFn(sendTestEmails);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [addrs, setAddrs] = useState<string[]>(() => {
    if (typeof window === "undefined") return ["info@sicher-schwimmen.com", "", ""];
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      if (Array.isArray(saved) && saved.length === 3) return saved as string[];
    } catch { /* ignore */ }
    return ["info@sicher-schwimmen.com", "", ""];
  });

  const go = async () => {
    const recipients = addrs.map(a => a.trim()).filter(Boolean);
    if (recipients.length === 0) {
      toast.error("Bitte mindestens eine E-Mail-Adresse eintragen.");
      return;
    }
    setBusy(true);
    setResults(null);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(addrs));
      const res = await run({ data: { recipients, templates: [...TEST_TEMPLATES] } });
      setResults(res.results as Result[]);
      if (res.failed === 0) toast.success(`${res.sent} Test-E-Mails versendet.`);
      else toast.warning(`${res.sent} versendet, ${res.failed} fehlgeschlagen.`);
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message || "Testversand fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary"><Send className="h-4 w-4 mr-1" />Testversand</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Echten Testversand starten</DialogTitle>
          <DialogDescription>
            An jede Adresse wird je eine echte E-Mail pro Vorlage geschickt (Betreff mit „[TEST]“).
            Alle Sendungen erscheinen anschließend unter „Versandstatus“ und „Gesendete E-Mails“.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {addrs.map((a, i) => (
            <div key={i}>
              <Label className="text-xs">Entwicklungskonto {i + 1}</Label>
              <Input
                type="email"
                value={a}
                placeholder="name@beispiel.de"
                onChange={e => setAddrs(prev => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
              />
            </div>
          ))}

          <div className="rounded-md border p-3">
            <div className="text-xs font-semibold text-muted-foreground mb-2">Getestete Vorlagen</div>
            <ul className="text-sm space-y-1">
              {TEST_TEMPLATES.map(t => <li key={t}>• {templateLabel(t)}</li>)}
            </ul>
          </div>

          <Button onClick={go} disabled={busy} className="w-full">
            {busy ? "Versende …" : "Testversand jetzt starten"}
          </Button>

          {results && (
            <div className="space-y-1">
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-sm border-t py-1">
                  <span className="truncate">{r.recipient} · {r.label}</span>
                  <Badge variant={r.sent ? "default" : "destructive"}>
                    {r.sent ? "Versendet" : (r.error || r.reason || "Fehler")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
