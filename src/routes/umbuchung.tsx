import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTimeBerlin } from "@/lib/format";
import { ORG } from "@/lib/billing-config";
import {
  confirmTransferConsent,
  getTransferConsent,
} from "@/lib/course-transfer-consent.functions";

export const Route = createFileRoute("/umbuchung")({
  validateSearch: (s) => z.object({ token: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Kursumbuchung bestätigen – Sicher Schwimmen e.V." },
      {
        name: "description",
        content: "Bestätigen Sie die Umbuchung Ihres Kindes in einen anderen Kurs.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

type Info = Awaited<ReturnType<typeof getTransferConsent>>;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <PublicLayout>
      <section className="container mx-auto max-w-2xl px-4 py-12">{children}</section>
    </PublicLayout>
  );
}

function Page() {
  const { token } = Route.useSearch();
  const load = useServerFn(getTransferConsent);
  const confirm = useServerFn(confirmTransferConsent);
  const [info, setInfo] = useState<Info | null>(null);
  const [doneAt, setDoneAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token || !/^[a-f0-9]{48}$/.test(token)) {
      setInfo({ found: false });
      return;
    }
    load({ data: { token } })
      .then(setInfo)
      .catch(() => setInfo({ found: false }));
  }, [token]);

  async function onConfirm() {
    setBusy(true);
    try {
      const r = await confirm({ data: { token: token! } });
      setDoneAt(r.confirmedAt);
    } catch (e) {
      toast.error(
        (e as Error)?.message ||
          "Die Zustimmung konnte nicht gespeichert werden. Bitte später erneut versuchen.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!info)
    return (
      <Frame>
        <p className="text-muted-foreground">Wird geladen …</p>
      </Frame>
    );

  if (!info.found) {
    return (
      <Frame>
        <XCircle className="mb-4 h-12 w-12 text-destructive" />
        <h1 className="font-display text-3xl font-bold text-primary-deep">Link ungültig</h1>
        <p className="mt-3 text-muted-foreground">
          Bitte nutzen Sie den Link aus unserer E-Mail oder melden Sie sich unter {ORG.email}.
        </p>
      </Frame>
    );
  }

  const s = info.snapshot;
  const confirmedAt = doneAt ?? (info.done ? info.confirmedAt : null);

  if (confirmedAt) {
    return (
      <Frame>
        <CheckCircle2 className="mb-4 h-12 w-12 text-success" />
        <h1 className="font-display text-3xl font-bold text-primary-deep">
          Vielen Dank – Zustimmung gespeichert
        </h1>
        <p className="mt-3 text-muted-foreground">
          Sie haben der Umbuchung von <strong>{s.child_name ?? "Ihrem Kind"}</strong> in den Kurs „
          {s.new_course}“ am {formatDateTimeBerlin(confirmedAt)} zugestimmt. Sie müssen nichts
          weiter tun.
        </p>
      </Frame>
    );
  }

  return (
    <Frame>
      <h1 className="font-display text-3xl font-bold text-primary-deep">
        Kursumbuchung bestätigen
      </h1>
      <p className="mt-2 text-muted-foreground">
        Bitte prüfen Sie die Angaben und stimmen Sie der Umbuchung von{" "}
        <strong>{s.child_name ?? "Ihrem Kind"}</strong> zu.
      </p>
      <Card className="mt-6">
        <CardContent className="space-y-2 pt-6 text-sm">
          <p>
            <strong>Bisheriger Kurs:</strong> {s.old_course}
          </p>
          <p>
            <strong>Neuer Kurs:</strong> {s.new_course}
          </p>
          {s.reason && (
            <p>
              <strong>Grund:</strong> {s.reason}
            </p>
          )}
          {s.new_schedule && (
            <p>
              <strong>Zeit:</strong> {s.new_schedule}
            </p>
          )}
          {s.new_location && (
            <p>
              <strong>Ort:</strong> {s.new_location}
            </p>
          )}
          {s.sessions.length > 0 && (
            <div>
              <strong>Nächste Termine:</strong>
              <ul className="ml-5 list-disc">
                {s.sessions.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="border-t pt-2">
            {s.amount_due ? (
              <p>
                <strong>Restbetrag:</strong> {s.amount_due}
                {s.due_date ? ` – zahlbar bis ${s.due_date} (Bankverbindung siehe E-Mail)` : ""}
              </p>
            ) : s.refund ? (
              <p>
                <strong>Guthaben:</strong> {s.refund} – wir melden uns wegen Erstattung bzw.
                Verrechnung.
              </p>
            ) : (
              <p>Die Kursgebühr ist vollständig beglichen – es entstehen keine weiteren Kosten.</p>
            )}
          </div>
        </CardContent>
      </Card>
      <p className="mt-4 text-xs text-muted-foreground">
        Mit Ihrem Klick stimmen Sie der Umbuchung
        {s.amount_due || s.refund ? " und der oben genannten Gebührenverrechnung" : ""} zu. Die
        Zustimmung wird mit Datum und Uhrzeit bei uns gespeichert.
      </p>
      <div className="mt-6">
        <Button disabled={busy} onClick={onConfirm}>
          {busy ? "Wird gespeichert …" : "Ja, ich stimme der Umbuchung zu"}
        </Button>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Nicht einverstanden oder Fragen? Schreiben Sie uns an {ORG.email} oder rufen Sie an:{" "}
        {ORG.phone}.
      </p>
    </Frame>
  );
}
