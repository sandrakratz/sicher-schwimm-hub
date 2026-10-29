import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateBerlin, formatPrice } from "@/lib/format";
import {
  listMemberChecks,
  resolveMemberCheck,
  type MemberCheckRow,
} from "@/lib/member-check.functions";

/**
 * Anmeldungen mit der Angabe „Mitglied“, die das System nicht bestätigen konnte.
 * Bis zur Entscheidung gilt der Normalpreis und es geht keine Zahlungsmail raus.
 */
export function MemberCheckPanel({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<MemberCheckRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows((await listMemberChecks()).rows);
    } catch {
      // Spalte erst nach der Migration vorhanden; bis dahin gibt es nichts zu prüfen
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(r: MemberCheckRow, decision: "confirm" | "reject") {
    setBusy(r.id);
    try {
      const res = await resolveMemberCheck({ data: { participantId: r.id, decision } });
      toast.success(
        res.mailSent
          ? `Zahlungsmail an ${r.participant_name} gesendet (${formatPrice(res.price) ?? "–"}).`
          : res.hasEmail
            ? "Entschieden, die Zahlungsmail konnte nicht gesendet werden – bitte unter „Gesendete E-Mails“ prüfen."
            : "Entschieden. Es ist keine E-Mail-Adresse hinterlegt, bitte telefonisch informieren.",
      );
      setRows((all) => all.filter((x) => x.id !== r.id));
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Entscheidung fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) return null;

  return (
    <Card className="border-warning/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BadgeCheck className="h-5 w-5" /> Mitgliedschaft prüfen ({rows.length})
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Diese Personen haben „Mitglied“ angegeben, im System ist aber keine aktive Mitgliedschaft
          zu finden. Der Platz ist gebucht, vorläufig gilt der Normalpreis und es wurde noch keine
          Zahlungsmail verschickt. Mit Ihrer Entscheidung geht die Kursbestätigung mit
          Zahlungsaufforderung raus.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{r.participant_name}</div>
              <div className="text-xs text-muted-foreground">
                {r.participant_email ?? "keine E-Mail"} · {r.program_name ?? r.course_name} ·
                gebucht am {formatDateBerlin(r.created_at)}
              </div>
            </div>
            <Button size="sm" disabled={busy === r.id} onClick={() => void decide(r, "confirm")}>
              Ist Mitglied ({formatPrice(r.price_member) ?? "–"}) – Zahlungsmail senden
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy === r.id}
              onClick={() => void decide(r, "reject")}
            >
              Kein Mitglied ({formatPrice(r.price_non_member) ?? "–"}) – Zahlungsmail senden
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
