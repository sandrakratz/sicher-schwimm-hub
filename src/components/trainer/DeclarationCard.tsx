import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTimeBerlin, todayBerlinIso } from "@/lib/format";
import { ANNUAL_ALLOWANCE, formatEuro } from "@/lib/trainer-billing";
import {
  getMyDeclaration,
  saveMyDeclaration,
  type Declaration,
} from "@/lib/trainer-billing.functions";

/**
 * Jährliche Erklärung zur Übungsleiterpauschale: Ohne sie (oder über der Grenze) kann der Verein nur mit
 * Begründung auszahlen. Ab Dezember lässt sich schon das nächste Jahr erklären.
 */
export function DeclarationCard() {
  const today = todayBerlinIso();
  const thisYear = Number(today.slice(0, 4));
  const years = today.slice(5, 7) === "12" ? [thisYear, thisYear + 1] : [thisYear];
  const [year, setYear] = useState(thisYear);
  const [current, setCurrent] = useState<Declaration | null>(null);
  const [loading, setLoading] = useState(true);
  const [sideJob, setSideJob] = useState<boolean | null>(null);
  const [other, setOther] = useState("0");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    getMyDeclaration({ data: { year } })
      .then((d) => {
        setCurrent(d);
        setSideJob(d ? d.sideJob : null);
        setOther(d ? String(d.otherAllowance).replace(".", ",") : "0");
        setNote(d?.otherNote ?? "");
        setConfirm(false);
      })
      .catch(() => toast.error("Erklärung konnte nicht geladen werden."))
      .finally(() => setLoading(false));
  }, [year]);

  const otherAmount = Number(other.replace(",", "."));
  const valid = sideJob !== null && Number.isFinite(otherAmount) && otherAmount >= 0 && confirm;

  async function save() {
    if (!valid || sideJob === null) return;
    setSaving(true);
    try {
      const d = await saveMyDeclaration({
        data: {
          year,
          sideJob,
          otherAllowance: otherAmount,
          otherNote: note.trim() || undefined,
          confirm: true,
        },
      });
      setCurrent(d);
      setConfirm(false);
      toast.success(`Erklärung ${year} gespeichert`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-0 shadow-soft">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-bold text-primary-deep">
              Erklärung zur Übungsleiterpauschale
            </h2>
            <p className="text-sm text-muted-foreground">
              Einmal im Jahr nötig, damit der Verein deine Vergütung steuerfrei auszahlen darf
              (Freibetrag {formatEuro(ANNUAL_ALLOWANCE)} im Jahr, § 3 Nr. 26 EStG).
            </p>
          </div>
          {years.length > 1 && (
            <div className="flex gap-1">
              {years.map((y) => (
                <Button
                  key={y}
                  size="sm"
                  variant={y === year ? "default" : "outline"}
                  onClick={() => setYear(y)}
                >
                  {y}
                </Button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Lädt …</p>
        ) : (
          <>
            {current ? (
              <p className="flex items-center gap-1 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" /> Für {year} abgegeben am{" "}
                {formatDateTimeBerlin(current.confirmedAt)}. Du kannst sie bei Änderungen erneut
                abgeben.
              </p>
            ) : (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                Für {year} liegt noch keine Erklärung vor. Ohne sie kann der Verein nur mit
                gesonderter Begründung auszahlen.
              </p>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">Übst du die Tätigkeit nebenberuflich aus?</p>
              <p className="text-xs text-muted-foreground">
                Nebenberuflich heißt: höchstens ein Drittel einer Vollzeitstelle (etwa 14 Stunden
                pro Woche), egal ob du daneben angestellt, selbstständig, in Ausbildung, Studium,
                Rente oder ohne Arbeit bist.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={sideJob === true ? "default" : "outline"}
                  onClick={() => setSideJob(true)}
                >
                  Ja, nebenberuflich
                </Button>
                <Button
                  type="button"
                  variant={sideJob === false ? "default" : "outline"}
                  onClick={() => setSideJob(false)}
                >
                  Nein
                </Button>
              </div>
              {sideJob === false && (
                <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                  Dann gilt der Freibetrag nicht. Bitte sprich mit dem Vorstand, bevor weitere
                  Auszahlungen erfolgen.
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="decl-other">
                  Freibetrag {year} schon bei anderen Vereinen/Auftraggebern genutzt (€)
                </Label>
                <Input
                  id="decl-other"
                  inputMode="decimal"
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  0, wenn du nur bei uns als Übungsleiter:in tätig bist. Der Betrag wird von der
                  Grenze abgezogen.
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="decl-note">Wo? (optional)</Label>
                <Input
                  id="decl-note"
                  maxLength={300}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="z. B. anderer Verein"
                />
              </div>
            </div>

            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={confirm}
                onCheckedChange={(v) => setConfirm(v === true)}
                className="mt-0.5"
              />
              <span>
                Ich bestätige, dass die Angaben stimmen, und melde Änderungen im Laufe des Jahres
                (z. B. eine weitere Übungsleitertätigkeit) sofort dem Vorstand.
              </span>
            </label>

            <Button onClick={() => void save()} disabled={!valid || saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Erklärung {year} abgeben
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
