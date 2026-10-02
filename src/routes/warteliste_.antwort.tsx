import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/form-support";
import { toast } from "sonner";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { formatDateBerlin } from "@/lib/format";
import { getWaitlistOffer, respondWaitlistOffer } from "@/lib/waitlist.functions";
import { useContactDefaults } from "@/hooks/use-contact-defaults";
import { Textarea } from "@/components/ui/textarea";
import { StayChoice } from "./warteliste_.rueckfrage";

export const Route = createFileRoute("/warteliste_/antwort")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? (search["token"] as string) : "",
    aktion: search["aktion"] === "absage" ? ("absage" as const) : ("zusage" as const),
  }),
  head: () => ({
    meta: [
      { title: "Platzangebot beantworten | Sicher Schwimmen e.V." },
      {
        name: "description",
        content: "Nehmen Sie Ihren Kursplatz aus der Warteliste an oder sagen Sie ihn ab.",
      },
      { property: "og:title", content: "Platzangebot beantworten" },
      {
        property: "og:description",
        content: "Zusage oder Absage zu Ihrem Kursplatz aus der Warteliste.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OfferResponsePage,
});

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <PublicLayout>
      <section className="container mx-auto max-w-2xl px-4 py-16">{children}</section>
    </PublicLayout>
  );
}

function OfferResponsePage() {
  const { token, aktion } = useSearch({ from: "/warteliste_/antwort" });
  const [result, setResult] = useState<null | {
    accepted: boolean;
    immediate?: boolean;
    dueDate?: string;
    deactivated?: boolean;
    stay?: boolean;
  }>(null);
  const [stay, setStay] = useState<boolean | null>(null);
  const [when, setWhen] = useState<"now" | "date">("now");
  const [fromDate, setFromDate] = useState("");
  const [reason, setReason] = useState("");
  const [askDecline, setAskDecline] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["waitlist-offer", token],
    enabled: !!token,
    queryFn: () => getWaitlistOffer({ data: { token } }),
  });

  const { defaults, ready } = useContactDefaults();

  if (!token) {
    return (
      <Frame>
        <h1 className="font-display text-3xl font-bold text-primary-deep">Ungültiger Link</h1>
        <p className="mt-3 text-muted-foreground">Bitte nutzen Sie den Link aus unserer E-Mail.</p>
      </Frame>
    );
  }

  if (isLoading) {
    return (
      <Frame>
        <p className="text-muted-foreground">Angebot wird geladen…</p>
      </Frame>
    );
  }

  if (!data?.found) {
    return (
      <Frame>
        <XCircle className="mb-4 h-12 w-12 text-destructive" />
        <h1 className="font-display text-3xl font-bold text-primary-deep">
          Angebot nicht gefunden
        </h1>
        <p className="mt-3 text-muted-foreground">
          Dieses Platzangebot ist nicht mehr gültig. Bei Fragen erreichen Sie uns unter
          info@sicher-schwimmen.com.
        </p>
      </Frame>
    );
  }

  if (result) {
    return (
      <Frame>
        {result.accepted ? (
          <>
            <CheckCircle2 className="mb-4 h-12 w-12 text-success" />
            <h1 className="font-display text-3xl font-bold text-primary-deep">
              Platz verbindlich gebucht
            </h1>
            <p className="mt-3 text-muted-foreground">
              Vielen Dank! Die Buchungsbestätigung mit allen Zahlungsinformationen ist per E-Mail
              unterwegs.
              {result.immediate
                ? " Da der Kurs in Kürze startet, ist die Kursgebühr sofort per Echtzeit-/Sofortüberweisung zu zahlen."
                : result.dueDate
                  ? ` Die Kursgebühr ist bis zum ${formatDateBerlin(result.dueDate)} fällig.`
                  : ""}
            </p>
          </>
        ) : (
          <>
            <CheckCircle2 className="mb-4 h-12 w-12 text-muted-foreground" />
            <h1 className="font-display text-3xl font-bold text-primary-deep">Absage notiert</h1>
            <p className="mt-3 text-muted-foreground">
              Danke für Ihre Rückmeldung – wir geben den Platz an die nächste Familie weiter.
            </p>
            {result.deactivated ? (
              <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                Sie haben ein Platzangebot nun zum 3. Mal abgesagt. Um allen wartenden Familien eine
                faire Chance zu geben, wurde Ihr Wartelistenplatz deaktiviert. Eine erneute
                Kursbuchung ist nur nach Rücksprache mit unserem Vorstand möglich
                (info@sicher-schwimmen.com).
              </p>
            ) : (
              <p className="mt-3 text-muted-foreground">
                {result.stay
                  ? "Ihr Kind bleibt auf der Warteliste – wir melden uns, sobald wieder ein passender Platz frei ist."
                  : "Ihr Kind wurde von der Warteliste genommen."}
              </p>
            )}
          </>
        )}
        <p className="mt-6 text-sm">
          <Link to="/kurse" className="underline">
            Zur Kursübersicht
          </Link>
        </p>
      </Frame>
    );
  }

  if (data.status !== "offered" || data.expired) {
    return (
      <Frame>
        <Clock className="mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="font-display text-3xl font-bold text-primary-deep">
          {data.expired ? "Frist abgelaufen" : "Bereits beantwortet"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          Dieses Platzangebot ist nicht mehr aktiv. Melden Sie sich gern unter
          info@sicher-schwimmen.com, wenn Sie weiterhin Interesse haben.
        </p>
      </Frame>
    );
  }

  async function submit(action: "accept" | "decline", form?: HTMLFormElement) {
    if (action === "decline") {
      if (stay === null)
        return toast.error("Bitte angeben, ob Ihr Kind auf der Warteliste bleiben soll.");
      if (stay && when === "date" && !fromDate) return toast.error("Bitte ein Datum wählen.");
    }
    setLoading(true);
    try {
      const fd = form ? new FormData(form) : null;
      const res = await respondWaitlistOffer({
        data: {
          token,
          action,
          ...(action === "decline"
            ? {
                stay: stay === true,
                availableFrom: stay && when === "date" ? fromDate : null,
                reason: reason.trim() || null,
              }
            : {}),
          street: String(fd?.get("street") || ""),
          zip: String(fd?.get("zip") || ""),
          city: String(fd?.get("city") || ""),
          childDob: String(fd?.get("child_dob") || ""),
        },
      });
      if (!res.ok) {
        toast.error(
          res.reason === "expired"
            ? "Die Frist für dieses Angebot ist leider abgelaufen."
            : res.reason === "address_required"
              ? "Bitte geben Sie die vollständige Rechnungsanschrift an."
              : res.reason === "dob_required"
                ? "Bitte geben Sie das Geburtsdatum Ihres Kindes an."
                : res.reason === "duplicate"
                  ? "Für Ihr Kind liegt bereits eine Buchung für diesen Kurs vor."
                  : "Das Angebot konnte nicht verarbeitet werden.",
        );
        return;
      }
      setResult({
        accepted: res.action === "accept",
        immediate: "immediatePayment" in res ? res.immediatePayment : undefined,
        dueDate: "paymentDueDate" in res ? res.paymentDueDate : undefined,
        deactivated: "deactivated" in res ? res.deactivated : undefined,
        stay: stay === true,
      });
    } catch (err) {
      console.error(err);
      toast.error("Es ist ein Fehler aufgetreten. Bitte später erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  const course = data.course;

  return (
    <Frame>
      <h1 className="font-display text-3xl font-bold text-primary-deep">Ihr Platzangebot</h1>
      <p className="mt-2 text-muted-foreground">
        Für <strong>{data.childName}</strong> ist ein Platz frei geworden
        {data.expiresAt ? ` – bitte antworten Sie bis ${formatDateBerlin(data.expiresAt)}.` : "."}
      </p>

      {course && (
        <Card className="mt-6">
          <CardContent className="space-y-1 pt-6 text-sm">
            <p>
              <strong>Kurs:</strong> {course.name}
            </p>
            {course.startsOn && (
              <p>
                <strong>Zeitraum:</strong> {formatDateBerlin(course.startsOn)}
                {course.endsOn ? ` bis ${formatDateBerlin(course.endsOn)}` : ""}
              </p>
            )}
            {course.schedule && (
              <p>
                <strong>Zeiten:</strong> {course.schedule}
              </p>
            )}
            {course.location && (
              <p>
                <strong>Ort:</strong> {course.location}
              </p>
            )}
            {course.price != null && (
              <p>
                <strong>Kursgebühr:</strong>{" "}
                {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
                  Number(course.price),
                )}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {aktion === "absage" || askDecline ? (
        <div className="mt-8 space-y-5">
          <p className="text-muted-foreground">
            Schade! Bevor Sie absagen, beantworten Sie uns bitte kurz:
          </p>
          <StayChoice
            stay={stay}
            setStay={setStay}
            when={when}
            setWhen={setWhen}
            date={fromDate}
            setDate={setFromDate}
          />
          <div className="space-y-2">
            <Label htmlFor="reason">Grund / Anmerkung (optional)</Label>
            <Textarea
              id="reason"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Hinweis: Nach 3 abgesagten oder unbeantworteten Platzangeboten wird der Wartelistenplatz
            automatisch deaktiviert.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" disabled={loading} onClick={() => submit("decline")}>
              Platz absagen
            </Button>
            <Button variant="accent" asChild>
              <Link to="/warteliste/antwort" search={{ token, aktion: "zusage" }}>
                Doch annehmen
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <form
          key={ready ? "prefilled" : "loading"}
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit("accept", e.currentTarget);
          }}
        >
          <p className="text-sm text-muted-foreground">
            Für die verbindliche Buchung und den Zahlungsbeleg benötigen wir Ihre
            Rechnungsanschrift.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {data.needsDob && (
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="child_dob">Geburtsdatum des Kindes *</Label>
                <Input
                  id="child_dob"
                  name="child_dob"
                  type="date"
                  required
                  max={new Date().toISOString().slice(0, 10)}
                />
              </div>
            )}
            <div className="space-y-2 md:col-span-3">
              <Label htmlFor="street">Straße und Hausnummer *</Label>
              <Input
                id="street"
                name="street"
                required
                maxLength={160}
                defaultValue={defaults.street}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">PLZ *</Label>
              <Input id="zip" name="zip" required maxLength={12} defaultValue={defaults.zip} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="city">Ort *</Label>
              <Input id="city" name="city" required maxLength={120} defaultValue={defaults.city} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton loading={loading}>Platz verbindlich annehmen</SubmitButton>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => setAskDecline(true)}
            >
              Platz absagen
            </Button>
          </div>
        </form>
      )}
    </Frame>
  );
}
