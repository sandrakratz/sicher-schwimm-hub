import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getOfferDeadlines,
  saveOfferDeadlines,
  type OfferDeadlineCourse,
} from "@/lib/offer-deadlines.functions";
import {
  DEFAULT_OFFER_DEADLINES,
  offerDays,
  type OfferDeadlineSettings,
} from "@/lib/offer-deadline";
import { formatDateBerlin, todayBerlinIso } from "@/lib/format";

const toNum = (v: string) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : NaN;
};
const validDays = (n: number) => Number.isInteger(n) && n >= 1 && n <= 60;

/**
 * Angebotsfristen für Platzangebote von der Warteliste: eine Regel nach Abstand zum Kursbeginn,
 * dazu die Tabelle aller Kurszeiträume, in der man bei Bedarf eine eigene Frist einträgt.
 */
export function OfferDeadlinesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const loadFn = useServerFn(getOfferDeadlines);
  const saveFn = useServerFn(saveOfferDeadlines);
  const [settings, setSettings] = useState<OfferDeadlineSettings>(DEFAULT_OFFER_DEADLINES);
  const [courses, setCourses] = useState<OfferDeadlineCourse[]>([]);
  // Eingaben als Text; leer = Regel nach Kursbeginn
  const [own, setOwn] = useState<Record<string, string>>({});
  const [orig, setOrig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const today = todayBerlinIso();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    loadFn()
      .then((r) => {
        setSettings(r.settings);
        setCourses(r.courses);
        const m: Record<string, string> = {};
        r.courses.forEach((c) => {
          m[c.id] = c.offer_days_override ? String(c.offer_days_override) : "";
        });
        setOwn(m);
        setOrig(m);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Laden fehlgeschlagen"))
      .finally(() => setLoading(false));
  }, [open, loadFn]);

  const settingsValid =
    Number.isInteger(settings.far_weeks) &&
    settings.far_weeks >= 1 &&
    settings.far_weeks <= 52 &&
    validDays(settings.days_far) &&
    validDays(settings.days_near);
  const ownInvalid = useMemo(
    () => Object.values(own).some((v) => v.trim() !== "" && !validDays(toNum(v))),
    [own],
  );

  async function save() {
    setSaving(true);
    try {
      const overrides = courses
        .filter((c) => (own[c.id] ?? "") !== (orig[c.id] ?? ""))
        .map((c) => ({ id: c.id, days: own[c.id].trim() === "" ? null : toNum(own[c.id]) }));
      await saveFn({ data: { settings, overrides } });
      toast.success("Angebotsfristen gespeichert. Sie gelten für neue Platzangebote.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  const numInput = (key: keyof OfferDeadlineSettings, max: number, label: string) => (
    <Input
      type="number"
      min={1}
      max={max}
      className="h-9 w-20"
      aria-label={label}
      value={Number.isNaN(settings[key]) ? "" : settings[key]}
      onChange={(e) => setSettings((s) => ({ ...s, [key]: toNum(e.target.value) }))}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[900px] sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Angebotsfristen einstellen</DialogTitle>
          <DialogDescription>
            So lange haben Eltern Zeit, ein Platzangebot von der Warteliste anzunehmen. Die Frist
            wird beim Versand des Angebots festgelegt; schon verschickte Angebote ändern sich nicht.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-md border p-4">
          <div className="text-sm font-semibold">Regel nach Kursbeginn</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
            <span>Kursbeginn in</span>
            {numInput("far_weeks", 52, "Wochen bis Kursbeginn")}
            <span>Wochen oder mehr:</span>
            {numInput("days_far", 60, "Frist in Tagen bei weit entferntem Kursbeginn")}
            <span>Tage Frist</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
            <span>Kursbeginn früher (oder ohne Datum):</span>
            {numInput("days_near", 60, "Frist in Tagen bei nahem Kursbeginn")}
            <span>Tage Frist</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">Kurszeiträume</div>
          <p className="text-xs text-muted-foreground">
            „Frist laut Regel“ zeigt, was heute gelten würde. Nur eintragen, wenn ein Zeitraum davon
            abweichen soll; leer lassen = Regel.
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Lade…</p>
          ) : courses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Keine laufenden oder kommenden Kurszeiträume.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kurs</TableHead>
                  <TableHead>Zeitraum</TableHead>
                  <TableHead>Beginn</TableHead>
                  <TableHead className="text-right">Frist laut Regel</TableHead>
                  <TableHead className="w-[150px]">Eigene Frist (Tage)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.program_name ?? "–"}</TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.starts_on ? formatDateBerlin(c.starts_on) : "offen"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {settingsValid ? `${offerDays(c, settings, today)} Tage` : "–"}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        className="h-9 w-24"
                        placeholder="Regel"
                        aria-label={`Eigene Angebotsfrist für ${c.name}`}
                        value={own[c.id] ?? ""}
                        onChange={(e) => setOwn((m) => ({ ...m, [c.id]: e.target.value }))}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button disabled={saving || loading || !settingsValid || ownInvalid} onClick={save}>
            {saving ? "Speichere…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
