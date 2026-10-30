import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarPlus, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMyCalendarUrl, rotateMyCalendarUrl } from "@/lib/trainer-extras.functions";

/**
 * Kalender-Abo: Der persönliche Link wird einmal im Google-, Apple- oder Outlook-Kalender eingetragen;
 * Änderungen im Dienstplan erscheinen dort automatisch.
 */
export function CalendarSubscribe() {
  const getUrl = useServerFn(getMyCalendarUrl);
  const rotate = useServerFn(rotateMyCalendarUrl);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function show() {
    setBusy(true);
    try {
      setUrl((await getUrl()).url);
    } catch {
      toast.error("Kalender-Link nicht verfügbar (Migration eingespielt?)");
    } finally {
      setBusy(false);
    }
  }

  async function renew() {
    if (!window.confirm("Neuen Link erzeugen? Der alte Link funktioniert danach nicht mehr."))
      return;
    setBusy(true);
    try {
      setUrl((await rotate()).url);
      toast.success("Neuer Link erzeugt – bitte im Kalender neu eintragen.");
    } catch {
      toast.error("Konnte keinen neuen Link erzeugen");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link kopiert");
    } catch {
      toast.error("Bitte den Link von Hand markieren und kopieren");
    }
  }

  return (
    <div className="space-y-2">
      {!url ? (
        <Button size="sm" variant="outline" className="min-h-10" disabled={busy} onClick={show}>
          <CalendarPlus className="h-4 w-4" /> Meine Einsätze im Kalender abonnieren
        </Button>
      ) : (
        <div className="space-y-2 rounded-md border bg-background p-3">
          <p className="text-xs text-muted-foreground">
            Link einmal im Kalender eintragen („Kalender per URL hinzufügen“ bei Google, „Neues
            Kalenderabonnement“ bei Apple). Danach aktualisiert sich der Kalender von selbst. Den
            Link bitte nicht weitergeben.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              readOnly
              aria-label="Persönlicher Kalender-Link"
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1"
            />
            <Button size="sm" className="min-h-10" onClick={() => void copy()}>
              <Copy className="h-4 w-4" /> Kopieren
            </Button>
            <Button asChild size="sm" variant="outline" className="min-h-10">
              <a href={url.replace(/^https?:/, "webcal:")}>Im Kalender öffnen</a>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="min-h-10"
              disabled={busy}
              onClick={() => void renew()}
            >
              <RefreshCw className="h-4 w-4" /> Neuer Link
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
