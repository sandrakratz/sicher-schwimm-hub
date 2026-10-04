import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatIban, isValidIban } from "@/lib/iban";
import { formatDateTimeBerlin } from "@/lib/format";
import {
  getMyPayoutDetails,
  saveMyPayoutDetails,
  type PayoutDetails,
} from "@/lib/trainer-payout.functions";

/**
 * Bankverbindung für die Übungsleitergelder. Unabhängig von der IBAN im Mitgliedsantrag:
 * Es gibt keine Vorbelegung und keinen Abgleich.
 */
export function PayoutIbanCard({ defaultHolder }: { defaultHolder?: string }) {
  const load = useServerFn(getMyPayoutDetails);
  const save = useServerFn(saveMyPayoutDetails);
  const [details, setDetails] = useState<PayoutDetails>(null);
  const [loaded, setLoaded] = useState(false);
  const [iban, setIban] = useState("");
  const [holder, setHolder] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load()
      .then((res) => {
        setDetails(res.details);
        setIban(res.details ? formatIban(res.details.iban) : "");
        setHolder(res.details?.account_holder ?? defaultHolder ?? "");
      })
      .catch(() => toast.error("Bankverbindung konnte nicht geladen werden"))
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ibanTouched = iban.trim().length > 0;
  const ibanInvalid = ibanTouched && !isValidIban(iban);
  const unchanged =
    !!details &&
    details.iban === iban.replace(/\s+/g, "").toUpperCase() &&
    details.account_holder === holder.trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidIban(iban)) {
      toast.error("Diese IBAN ist ungültig. Bitte Eingabe prüfen.");
      return;
    }
    setSaving(true);
    try {
      const res = await save({ data: { iban, accountHolder: holder } });
      setDetails(res.details);
      setIban(res.details ? formatIban(res.details.iban) : iban);
      toast.success(
        res.notified
          ? "Gespeichert. Der Vorstand wurde über die Änderung informiert."
          : "Bankverbindung gespeichert",
      );
    } catch (err) {
      toast.error((err as Error)?.message || "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <Card className="border-0 shadow-soft mt-6">
      <CardContent className="p-6">
        <h2 className="font-display text-xl font-semibold text-primary-deep mb-1">
          Bankverbindung für Übungsleitergelder
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Auf dieses Konto überweist der Verein deine Übungsleitergelder. Es kann ein anderes Konto
          sein als das im Mitgliedsantrag angegebene. Wenn du die Angaben änderst, erhält der
          Vorstand automatisch einen Hinweis.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="payout_holder">Kontoinhaber:in</Label>
            <Input
              id="payout_holder"
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
              maxLength={100}
              autoComplete="off"
              required
            />
          </div>
          <div>
            <Label htmlFor="payout_iban">IBAN</Label>
            <Input
              id="payout_iban"
              value={iban}
              onChange={(e) => setIban(e.target.value.toUpperCase())}
              onBlur={() => isValidIban(iban) && setIban(formatIban(iban))}
              placeholder="DE00 0000 0000 0000 0000 00"
              className="font-mono"
              autoComplete="off"
              inputMode="text"
              aria-invalid={ibanInvalid}
              required
            />
            {ibanInvalid && (
              <p className="mt-1 text-xs text-destructive">
                Diese IBAN scheint ungültig zu sein. Bitte auf Tippfehler prüfen.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="accent" disabled={saving || ibanInvalid || unchanged}>
              {saving ? "Speichert…" : details ? "Änderung speichern" : "Speichern"}
            </Button>
            {details ? (
              <span className="text-xs text-muted-foreground">
                Zuletzt gespeichert: {formatDateTimeBerlin(details.updated_at)}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Noch keine IBAN hinterlegt.</span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default PayoutIbanCard;
