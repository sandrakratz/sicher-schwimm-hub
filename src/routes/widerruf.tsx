import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, ShieldCheck, FileX2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

export const Route = createFileRoute("/widerruf")({
  head: () => ({
    meta: [
      { title: "Vertrag widerrufen – Sicher Schwimmen e.V." },
      { name: "description", content: "Online-Widerrufsformular für Schwimmkurs-Verträge beim Sicher Schwimmen e.V. Widerrufsbelehrung, Muster-Widerrufsformular und Eingangsbestätigung." },
      { name: "robots", content: "index,follow" },
      { property: "og:title", content: "Vertrag widerrufen – Sicher Schwimmen e.V." },
      { property: "og:description", content: "Rechtssicherer Widerruf eines Schwimmkurs-Vertrags inkl. Belehrung und Online-Formular." },
      { property: "og:url", content: "https://sicher-schwimmen.com/widerruf" },
    ],
    links: [{ rel: "canonical", href: "https://sicher-schwimmen.com/widerruf" }],
  }),
  component: Page,
});

const DEFAULT_REVOCATION =
  "Hiermit widerrufe ich den von mir abgeschlossenen Vertrag über den oben genannten Schwimmkurs.";

const schema = z.object({
  parent_first_name: z.string().trim().min(1, "Vorname erforderlich").max(100),
  parent_last_name: z.string().trim().min(1, "Nachname erforderlich").max(100),
  email: z.string().trim().email("Gültige E-Mail-Adresse erforderlich").max(255),
  phone: z.string().trim().min(3, "Telefonnummer erforderlich").max(50),
  child_name: z.string().trim().min(1, "Name des Kindes erforderlich").max(150),
  course_name: z.string().trim().min(1, "Kurs erforderlich").max(200),
  booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format JJJJ-MM-TT"),
  notes: z.string().trim().max(2000).optional(),
  revocation_text: z.string().trim().min(5, "Widerrufstext erforderlich").max(2000),
  confirm: z.literal(true, { errorMap: () => ({ message: "Bitte bestätigen Sie den Widerruf." }) }),
});

type FormState = {
  parent_first_name: string;
  parent_last_name: string;
  email: string;
  phone: string;
  child_name: string;
  course_name: string;
  booking_date: string;
  notes: string;
  revocation_text: string;
  confirm: boolean;
  website: string; // honeypot
};

const initial: FormState = {
  parent_first_name: "",
  parent_last_name: "",
  email: "",
  phone: "",
  child_name: "",
  course_name: "",
  booking_date: "",
  notes: "",
  revocation_text: DEFAULT_REVOCATION,
  confirm: false,
  website: "",
};

function Page() {
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ reference: string } | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((p) => ({ ...p, [key]: value }));
    if (errors[key as string]) {
      setErrors((p) => {
        const n = { ...p };
        delete n[key as string];
        return n;
      });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({
      ...form,
      notes: form.notes || undefined,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0];
        if (typeof k === "string" && !fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      setErrors(fieldErrors);
      toast.error("Bitte prüfen Sie Ihre Eingaben.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/public/submit-cancellation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...parsed.data,
          website: form.website,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        toast.error(json?.error || "Widerruf konnte nicht übermittelt werden.");
        return;
      }
      setSuccess({ reference: json.reference_number });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("[widerruf] submit", err);
      toast.error("Netzwerkfehler. Bitte versuchen Sie es später erneut.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicLayout>
      <section className="bg-primary-deep text-white">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="flex items-center gap-3 mb-3">
            <FileX2 className="h-8 w-8 text-accent" aria-hidden="true" />
            <h1 className="font-display text-3xl md:text-4xl font-bold">
              Vertrag widerrufen
            </h1>
          </div>
          <p className="max-w-2xl text-white/85">
            Hier können Sie als Verbraucher einen abgeschlossenen
            Schwimmkurs-Vertrag mit Sicher Schwimmen e.V. rechtssicher
            widerrufen. Lesen Sie zunächst die Widerrufsbelehrung und füllen Sie
            anschließend das Formular aus.
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-10 md:py-14 max-w-3xl space-y-8">
        {success ? (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden="true" />
                <h2 className="font-display text-2xl font-bold text-primary-deep">
                  Vielen Dank. Ihr Widerruf wurde erfolgreich übermittelt.
                </h2>
              </div>
              <p>
                <strong>Referenznummer:</strong>{" "}
                <span className="font-mono">{success.reference}</span>
              </p>
              <p>
                Eine Eingangsbestätigung wurde an Ihre E-Mail-Adresse versendet.
                Bitte bewahren Sie die Referenznummer für eventuelle Rückfragen
                auf.
              </p>
              <div className="pt-2">
                <Button asChild variant="outline">
                  <Link to="/">Zur Startseite</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="font-display text-2xl font-bold text-primary-deep">
                  Widerrufsbelehrung
                </h2>

                <div>
                  <h3 className="font-semibold mb-1">Widerrufsrecht</h3>
                  <p>
                    Sie haben das Recht, binnen <strong>vierzehn Tagen</strong>{" "}
                    ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die
                    Widerrufsfrist beträgt vierzehn Tage ab dem Tag des
                    Vertragsabschlusses bzw. der Zuteilungsbestätigung des
                    Schwimmkurses.
                  </p>
                  <p className="mt-2">
                    Um Ihr Widerrufsrecht auszuüben, müssen Sie uns – Sicher
                    Schwimmen e.V., Hennef (Sieg), E-Mail{" "}
                    <a
                      className="text-primary-deep underline"
                      href="mailto:widerruf@sicher-schwimmen.com"
                    >
                      widerruf@sicher-schwimmen.com
                    </a>{" "}
                    – mittels einer eindeutigen Erklärung (z. B. ein mit der
                    Post versandter Brief oder E-Mail) über Ihren Entschluss,
                    diesen Vertrag zu widerrufen, informieren. Sie können dafür
                    das nachfolgende Online-Formular oder das beigefügte
                    Muster-Widerrufsformular verwenden, das jedoch nicht
                    vorgeschrieben ist.
                  </p>
                  <p className="mt-2">
                    Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die
                    Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf
                    der Widerrufsfrist absenden.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-1">Folgen des Widerrufs</h3>
                  <p>
                    Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle
                    Zahlungen, die wir von Ihnen erhalten haben, unverzüglich
                    und spätestens binnen vierzehn Tagen ab dem Tag
                    zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf
                    bei uns eingegangen ist. Für diese Rückzahlung verwenden
                    wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen
                    Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde
                    ausdrücklich etwas anderes vereinbart; in keinem Fall
                    werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.
                  </p>
                  <p className="mt-2">
                    Haben Sie verlangt, dass die Dienstleistung während der
                    Widerrufsfrist beginnen soll, so haben Sie uns einen
                    angemessenen Betrag zu zahlen, der dem Anteil der bis zu
                    dem Zeitpunkt, zu dem Sie uns von der Ausübung des
                    Widerrufsrechts unterrichten, bereits erbrachten
                    Dienstleistungen im Vergleich zum Gesamtumfang der im
                    Vertrag vorgesehenen Dienstleistungen entspricht.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-1">Kontakt</h3>
                  <p>
                    Sicher Schwimmen e.V. · Hennef (Rhein-Sieg-Kreis) · E-Mail{" "}
                    <a
                      className="text-primary-deep underline"
                      href="mailto:widerruf@sicher-schwimmen.com"
                    >
                      widerruf@sicher-schwimmen.com
                    </a>
                  </p>
                </div>

                <Alert>
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>Hinweis zur Online-Übermittlung</AlertTitle>
                  <AlertDescription>
                    Wenn Sie Ihren Widerruf über das unten stehende Online-
                    Formular übermitteln, werden wir Ihnen unverzüglich eine
                    Bestätigung des Zugangs per E-Mail zusenden. Alternativ
                    können Sie den Widerruf auch formlos an die oben genannte
                    E-Mail-Adresse senden.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h2 className="font-display text-2xl font-bold text-primary-deep mb-1">
                  Muster-Widerrufsformular
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Pflichtfelder sind mit * gekennzeichnet.
                </p>

                <form onSubmit={onSubmit} noValidate className="space-y-5">
                  {/* Honeypot — visually hidden, ignored by users */}
                  <div className="hidden" aria-hidden="true">
                    <label>
                      Bitte leer lassen:
                      <input
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={form.website}
                        onChange={(e) => set("website", e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field id="parent_first_name" label="Vorname (Erziehungsberechtigte:r) *" error={errors.parent_first_name}>
                      <Input id="parent_first_name" autoComplete="given-name" required
                        value={form.parent_first_name}
                        onChange={(e) => set("parent_first_name", e.target.value)} />
                    </Field>
                    <Field id="parent_last_name" label="Nachname (Erziehungsberechtigte:r) *" error={errors.parent_last_name}>
                      <Input id="parent_last_name" autoComplete="family-name" required
                        value={form.parent_last_name}
                        onChange={(e) => set("parent_last_name", e.target.value)} />
                    </Field>
                    <Field id="email" label="E-Mail-Adresse *" error={errors.email}>
                      <Input id="email" type="email" autoComplete="email" required
                        value={form.email}
                        onChange={(e) => set("email", e.target.value)} />
                    </Field>
                    <Field id="phone" label="Telefonnummer *" error={errors.phone}>
                      <Input id="phone" type="tel" autoComplete="tel" required
                        value={form.phone}
                        onChange={(e) => set("phone", e.target.value)} />
                    </Field>
                    <Field id="child_name" label="Name des Kindes *" error={errors.child_name}>
                      <Input id="child_name" required
                        value={form.child_name}
                        onChange={(e) => set("child_name", e.target.value)} />
                    </Field>
                    <Field id="course_name" label="Gebuchter Schwimmkurs *" error={errors.course_name}>
                      <Input id="course_name" required
                        value={form.course_name}
                        onChange={(e) => set("course_name", e.target.value)} />
                    </Field>
                    <Field id="booking_date" label="Datum der Kurszuteilung / Buchungsbestätigung *" error={errors.booking_date}>
                      <Input id="booking_date" type="date" required
                        value={form.booking_date}
                        onChange={(e) => set("booking_date", e.target.value)} />
                    </Field>
                  </div>

                  <Field id="notes" label="Bemerkungen (freiwillig)" error={errors.notes}>
                    <Textarea id="notes" rows={3} maxLength={2000}
                      value={form.notes}
                      onChange={(e) => set("notes", e.target.value)} />
                  </Field>

                  <Field id="revocation_text" label="Widerrufserklärung *" error={errors.revocation_text}>
                    <Textarea id="revocation_text" rows={4} required maxLength={2000}
                      value={form.revocation_text}
                      onChange={(e) => set("revocation_text", e.target.value)} />
                  </Field>

                  <div className="flex items-start gap-3 rounded-md border p-4 bg-secondary/40">
                    <Checkbox
                      id="confirm"
                      checked={form.confirm}
                      onCheckedChange={(v) => set("confirm", v === true)}
                    />
                    <div className="flex-1">
                      <Label htmlFor="confirm" className="font-medium leading-snug">
                        Ich erkläre hiermit den Widerruf des oben genannten
                        Vertrages. *
                      </Label>
                      {errors.confirm && (
                        <p className="text-sm text-destructive mt-1">{errors.confirm}</p>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-2 rounded-md border p-4 bg-muted/40">
                    <p>
                      <strong>Datenschutzhinweis:</strong> Die in diesem
                      Formular erhobenen Daten verarbeiten wir ausschließlich
                      zur Bearbeitung Ihres Widerrufs (Art. 6 Abs. 1 lit. b und
                      c DSGVO). Zur Nachvollziehbarkeit speichern wir
                      zusätzlich Ihre IP-Adresse und den Zeitpunkt der
                      Übermittlung.
                    </p>
                    <p>
                      <strong>Aufbewahrungsdauer:</strong> Wir speichern die
                      Widerrufsdaten gemäß gesetzlichen Aufbewahrungs- und
                      Verjährungsfristen (in der Regel 3 Jahre, §195 BGB) und
                      löschen sie danach.
                    </p>
                    <p>
                      Weitere Informationen finden Sie in unserer{" "}
                      <Link to="/datenschutz" className="text-primary-deep underline">
                        Datenschutzerklärung
                      </Link>
                      .
                    </p>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="submit" variant="accent" size="lg" disabled={loading}>
                      {loading ? "Wird gesendet…" : "Widerruf absenden"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PublicLayout>
  );
}

function Field({
  id, label, error, children,
}: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
