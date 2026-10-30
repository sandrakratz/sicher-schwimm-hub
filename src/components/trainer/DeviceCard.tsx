import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { CloudOff, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { TrainerPushToggle } from "@/components/trainer/TrainerPushToggle";
import {
  clearOfflineData,
  isOfflineEnabled,
  listQueue,
  loadSnapshot,
  setOfflineEnabled,
} from "@/lib/offline-store";
import {
  OFFLINE_DAYS,
  refreshOfflineSnapshot,
  syncQueue,
  type SnapshotRow,
} from "@/lib/offline-sync";
import { registerServiceWorker } from "@/lib/register-sw";

/**
 * „Auf diesem Gerät“: Mitteilungen und Offline-Modus (Einsätze und Teilnehmerliste der nächsten Tage im
 * Schwimmbad ohne Netz, Anwesenheit wird später übertragen). Beides ist freiwillig und gilt je Gerät.
 */
export function DeviceCard({
  rows,
  me,
  loading,
}: {
  rows: SnapshotRow[];
  me: string;
  loading: boolean;
}) {
  const [enabled, setEnabled] = useState(false);
  const [stamp, setStamp] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);

  async function refresh(silent: boolean) {
    setBusy(true);
    try {
      await syncQueue();
      const n = await refreshOfflineSnapshot(rows, me);
      setStamp((await loadSnapshot())?.generatedAt ?? null);
      setPending((await listQueue()).length);
      if (!silent)
        toast.success(
          `Gespeichert: ${n} Einsatz${n === 1 ? "" : "ätze"} der nächsten ${OFFLINE_DAYS} Tage.`,
        );
    } catch {
      if (!silent) toast.error("Speichern hat nicht geklappt – bitte mit Netz erneut versuchen.");
    } finally {
      setBusy(false);
    }
  }

  // Beim Öffnen der Startseite automatisch aktualisieren, solange der Offline-Modus an ist
  useEffect(() => {
    const on = isOfflineEnabled();
    setEnabled(on);
    if (!on || !me || loading) return;
    void loadSnapshot().then((s) => setStamp(s?.generatedAt ?? null));
    void listQueue().then((q) => setPending(q.length));
    if (navigator.onLine) void refresh(true);
  }, [me, loading]);

  async function toggle(on: boolean) {
    if (on) {
      if (!navigator.onLine) return toast.error("Zum Einrichten wird Netz benötigt.");
      setOfflineEnabled(true);
      setEnabled(true);
      await registerServiceWorker();
      await refresh(false);
    } else {
      await clearOfflineData();
      setEnabled(false);
      setStamp(null);
      setPending(0);
      toast.success("Offline-Daten von diesem Gerät gelöscht.");
    }
  }

  return (
    <Card className="border-0 shadow-soft">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2 font-semibold text-primary-deep">
          <Smartphone className="h-5 w-5" /> Auf diesem Gerät
        </div>
        <TrainerPushToggle />
        <div className="space-y-2 border-t pt-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={enabled}
              onCheckedChange={(v) => void toggle(!!v)}
            />
            <span>
              <span className="font-medium">Offline-Modus für das Schwimmbad</span>
              <span className="block text-xs text-muted-foreground">
                Speichert deine Einsätze der nächsten {OFFLINE_DAYS} Tage mit Namen und Hinweisen
                der Teilnehmenden auf diesem Gerät, damit sie auch ohne Netz bereitstehen.
                Anwesenheit trägst du offline ein, sie wird später automatisch übertragen. Die Daten
                werden nach 48 Stunden und beim Abmelden gelöscht. Bitte nur auf Geräten aktivieren,
                die mit Sperrcode geschützt sind.
              </span>
            </span>
          </label>
          {enabled && (
            <div className="flex flex-wrap items-center gap-2 pl-7 text-xs text-muted-foreground">
              <span>
                Stand: {stamp ? new Date(stamp).toLocaleString("de-DE") : "noch nicht gespeichert"}
              </span>
              {pending > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <CloudOff className="h-3 w-3" /> {pending} Eintrag{pending === 1 ? "" : "träge"}{" "}
                  offen
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                className="min-h-9"
                disabled={busy}
                onClick={() => void refresh(false)}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Jetzt aktualisieren
              </Button>
              <Button asChild size="sm" variant="outline" className="min-h-9">
                <Link to="/trainer/offline">Offline-Ansicht öffnen</Link>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
