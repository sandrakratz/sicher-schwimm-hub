import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Waves } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTimeBerlin } from "@/lib/format";
import {
  FAMILY_SWIM,
  REQUEST_STATUS_LABEL,
  needsGrandstandSupervision,
  weekdayDate,
  type RequestStatus,
} from "@/lib/familienschwimmen";
import {
  cancelFamilySwim,
  getMyFamilySwim,
  submitFamilySwim,
  type MyFamilySwim,
} from "@/lib/familienschwimmen.functions";

export const Route = createFileRoute("/_authenticated/portal/familienschwimmen")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Familienschwimmen – Mitgliederbereich | Sicher Schwimmen e.V." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const NOTICES = [
  "Das Angebot ist ausschließlich für Vereinsmitglieder.",
  "Jedes Kind muss von einer erwachsenen Begleitperson begleitet werden. Die Begleitperson übernimmt die Verantwortung für das eigene Kind.",
  `Die Wasserzeit beträgt 45 Minuten (${FAMILY_SWIM.waterTime}). Das Bad muss spätestens um ${FAMILY_SWIM.leaveBy} verlassen werden.`,
  `Pro Termin können je nach Termin ${FAMILY_SWIM.capacityMin} bis ${FAMILY_SWIM.capacityMax} Personen teilnehmen.`,
  "Eine Anmeldung ist zunächst nur eine Platzanfrage. Verbindlich ist die Teilnahme erst durch die Zusage des Vereins.",
  "Die Plätze werden fair vergeben: Familien, die bisher seltener dabei waren, kommen zuerst dran. Wer zugesagte Termine kurzfristig (weniger als 48 Stunden vorher) absagt oder nicht erscheint, rutscht bei der nächsten Vergabe nach hinten.",
];

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "confirmed" || s === "attended") return "default";
  if (s === "waitlist" || s === "requested") return "secondary";
  if (s === "no_show" || s === "declined") return "destructive";
  return "outline";
}

function Page() {
  const [data, setData] = useState<MyFamilySwim | null>(null);
  const [loading, setLoading] = useState(true);
  const [eventIds, setEventIds] = useState<string[]>([]);
  const [personKeys, setPersonKeys] = useState<string[]>([]);
  const [bronze, setBronze] = useState(false);
  const [grandstand, setGrandstand] = useState("");
  const [note, setNote] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setData(await getMyFamilySwim());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Termine konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const selected = useMemo(
    () => (data?.persons ?? []).filter((p) => personKeys.includes(p.key)),
    [data, personKeys],
  );
  const needsStand = needsGrandstandSupervision(selected);
  const adults = selected.filter((p) => p.role === "adult").length;
  const children = selected.length - adults;
  const bookable = (data?.events ?? []).filter((e) => e.open && !e.myRequest);

  async function submit() {
    setSaving(true);
    try {
      await submitFamilySwim({
        data: {
          eventIds,
          personKeys,
          bronzeConfirmed: bronze,
          grandstandName: grandstand,
          note,
          accepted: true,
        },
      });
      toast.success("Platzanfrage gesendet. Die Bestätigung kommt per E-Mail.");
      setEventIds([]);
      setPersonKeys([]);
      setBronze(false);
      setGrandstand("");
      setNote("");
      setAccepted(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function cancel(id: string, late: boolean) {
    const text = late
      ? `Der Termin ist in weniger als ${FAMILY_SWIM.lateCancelHours} Stunden. Eine Absage jetzt zählt als Strafpunkt bei der nächsten Vergabe. Trotzdem absagen?`
      : "Diese Anmeldung wirklich absagen?";
    if (!confirm(text)) return;
    try {
      await cancelFamilySwim({ data: { requestId: id } });
      toast.success("Abgesagt.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Absage fehlgeschlagen.");
    }
  }

  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  if (loading)
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Wird geladen…
      </div>
    );

  const mine = (data?.events ?? []).filter((e) => e.myRequest);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-2 text-accent text-sm font-semibold uppercase tracking-wider">
          <Waves className="h-4 w-4" /> Für Vereinsmitglieder
        </div>
        <h1 className="text-3xl font-bold text-primary-deep mt-1">Familienschwimmen</h1>
        <p className="text-muted-foreground mt-2">
          {FAMILY_SWIM.location} · Wasserzeit {FAMILY_SWIM.waterTime} · eine Bahn. Ein Übungsleiter
          ist immer vor Ort.
        </p>
      </div>

      {!data?.eligible && (
        <Card>
          <CardContent className="p-5 text-sm">{data?.reason}</CardContent>
        </Card>
      )}

      {mine.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-primary-deep">Meine Anmeldungen</h2>
          {mine.map((e) => (
            <Card key={e.id}>
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{weekdayDate(e.event_date)}</div>
                  <div className="text-sm text-muted-foreground">
                    {e.start_time}–{e.end_time} Uhr · {e.myRequest!.seats}{" "}
                    {e.myRequest!.seats === 1 ? "Person" : "Personen"}:{" "}
                    {e.myRequest!.persons.map((p) => p.name).join(", ")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(e.myRequest!.status)}>
                    {REQUEST_STATUS_LABEL[e.myRequest!.status as RequestStatus] ??
                      e.myRequest!.status}
                  </Badge>
                  {e.myRequest!.canCancel && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => cancel(e.myRequest!.id, e.myRequest!.late)}
                    >
                      Absagen
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {data?.eligible && (
        <section className="space-y-5">
          <h2 className="text-xl font-semibold text-primary-deep">Platz anfragen</h2>

          <Card>
            <CardContent className="p-5 space-y-3">
              <h3 className="font-semibold">1. Wunschtermine</h3>
              {bookable.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aktuell sind keine Termine zur Anmeldung offen.
                </p>
              )}
              {bookable.map((e) => (
                <label key={e.id} className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={eventIds.includes(e.id)}
                    onCheckedChange={() => setEventIds((l) => toggle(l, e.id))}
                  />
                  <span>
                    <span className="font-medium">{weekdayDate(e.event_date)}</span>{" "}
                    <span className="text-sm text-muted-foreground">
                      · {e.start_time}–{e.end_time} Uhr · Anmeldeschluss{" "}
                      {formatDateTimeBerlin(e.registration_deadline)}
                    </span>
                  </span>
                </label>
              ))}
              {(data?.events ?? [])
                .filter((e) => !e.open && !e.myRequest)
                .map((e) => (
                  <div key={e.id} className="text-sm text-muted-foreground">
                    {weekdayDate(e.event_date)} – {e.closedReason}
                  </div>
                ))}
              <p className="text-xs text-muted-foreground">
                Ihr dürft mehrere Termine anfragen. Vergeben wird fair: Zuerst bekommt jede Familie
                höchstens einen Termin, danach werden freie Plätze weiterverteilt.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-3">
              <h3 className="font-semibold">2. Wer kommt mit ins Wasser?</h3>
              <p className="text-sm text-muted-foreground">
                Zur Auswahl stehen die Personen aus eurem Mitgliedskonto. Nur wer im Wasser ist,
                zählt zu den Plätzen.
              </p>
              {(data?.persons ?? []).map((p) => (
                <label key={p.key} className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={personKeys.includes(p.key)}
                    onCheckedChange={() => setPersonKeys((l) => toggle(l, p.key))}
                  />
                  <span>
                    {p.name}{" "}
                    <span className="text-sm text-muted-foreground">
                      ({p.role === "adult" ? "erwachsen" : "Kind"})
                    </span>
                  </span>
                </label>
              ))}
              {selected.length > 0 && (
                <p className="text-sm font-medium">
                  {selected.length} {selected.length === 1 ? "Person" : "Personen"} ({adults}{" "}
                  Erwachsene, {children} Kinder)
                </p>
              )}
            </CardContent>
          </Card>

          {needsStand && (
            <Card className="border-accent/50">
              <CardContent className="p-5 space-y-3">
                <h3 className="font-semibold">Kinder ohne erwachsene Begleitung im Wasser</h3>
                <p className="text-sm text-muted-foreground">
                  Kinder, die nicht mit einem Elternteil im Wasser sind, brauchen mindestens das
                  Bronzeabzeichen. Außerdem muss eine volljährige Aufsichtsperson auf der Tribüne
                  sein. Sie geht nicht ins Wasser und zählt nicht zu den Plätzen.
                </p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={bronze} onCheckedChange={(v) => setBronze(v === true)} />
                  <span className="text-sm">
                    Ich bestätige: Die Kinder, die ohne erwachsene Begleitung ins Wasser gehen,
                    haben mindestens das Bronzeabzeichen.
                  </span>
                </label>
                <p className="text-sm font-medium">
                  Bitte den Schwimmausweis des Kindes zum Termin mitbringen. Ohne Nachweis kann das
                  Kind nicht ohne erwachsene Begleitung ins Wasser.
                </p>
                <div>
                  <label className="text-sm font-medium" htmlFor="grandstand">
                    Name der volljährigen Aufsichtsperson auf der Tribüne
                  </label>
                  <Input
                    id="grandstand"
                    value={grandstand}
                    onChange={(e) => setGrandstand(e.target.value)}
                    maxLength={120}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-5 space-y-3">
              <h3 className="font-semibold">3. Hinweise und Absenden</h3>
              <label className="text-sm font-medium" htmlFor="note">
                Anmerkung (optional)
              </label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={2}
              />
              <ul className="list-disc pl-5 text-sm space-y-1 text-muted-foreground">
                {NOTICES.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} />
                <span className="text-sm">
                  Ich habe die Hinweise gelesen und bestätige sie. Mir ist klar, dass dies zunächst
                  nur eine Platzanfrage ist.
                </span>
              </label>
              <Button
                disabled={saving || !accepted || eventIds.length === 0 || personKeys.length === 0}
                onClick={submit}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Platz anfragen
              </Button>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
