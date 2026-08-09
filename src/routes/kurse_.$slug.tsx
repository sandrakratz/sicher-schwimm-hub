import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock, MapPin, Users, Tag, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { BILLING } from "@/lib/billing-config";
import { formatDateBerlin } from "@/lib/format";
import { getCourseProgram, bookCourseTerm, type CourseProgram, type CourseTerm } from "@/lib/courses-public.functions";

export const Route = createFileRoute("/kurse_/$slug")({
  loader: async ({ params }) => {
    const program = await getCourseProgram({ data: { slug: params.slug } });
    if (!program) throw notFound();
    return program;
  },
  head: ({ loaderData }) => {
    const p = loaderData as CourseProgram | undefined;
    const title = p ? `${p.name} – Schwimmkurs buchen | Sicher Schwimmen e.V.` : "Schwimmkurs | Sicher Schwimmen e.V.";
    const desc = p?.description
      ? `${p.description} Freie Termine online verbindlich buchen.`
      : "Schwimmkurs mit freien Terminen online verbindlich buchen.";
    return {
      meta: [
        { title },
        { name: "description", content: desc.slice(0, 158) },
        { property: "og:title", content: title },
        { property: "og:description", content: desc.slice(0, 158) },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ProgramPage,
  errorComponent: () => (
    <PublicLayout>
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold text-primary-deep mb-4">Kurs nicht gefunden</h1>
        <Button asChild><Link to="/kurse">Zur Kursübersicht</Link></Button>
      </section>
    </PublicLayout>
  ),
  notFoundComponent: () => (
    <PublicLayout>
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold text-primary-deep mb-4">Kurs nicht gefunden</h1>
        <Button asChild><Link to="/kurse">Zur Kursübersicht</Link></Button>
      </section>
    </PublicLayout>
  ),
});

function fmtPrice(v: number | null) {
  if (v == null) return null;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(v));
}

function ProgramPage() {
  const program = Route.useLoaderData() as CourseProgram;
  const [bookingTerm, setBookingTerm] = useState<CourseTerm | null>(null);
  const [result, setResult] = useState<{ status: "confirmed" | "waiting"; courseName: string } | null>(null);

  return (
    <PublicLayout>
      <section className="bg-hero text-white py-16">
        <div className="container mx-auto px-4">
          <Link to="/kurse" className="text-white/80 text-sm underline">← Alle Kurse</Link>
          <h1 className="font-display text-4xl md:text-5xl font-bold mt-3 mb-3">{program.name}</h1>
          {program.description && <p className="text-white/85 max-w-2xl">{program.description}</p>}
        </div>
      </section>

      <section className="container mx-auto px-4 py-12 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="font-display text-2xl font-bold text-primary-deep">Buchbare Zeiträume</h2>

          {program.terms.length === 0 ? (
            <Card className="border-0 shadow-soft">
              <CardContent className="p-6">
                <p className="text-muted-foreground mb-4">
                  Für diesen Kurs stehen aktuell keine Termine zur Buchung bereit. Gerne nehmen wir Sie auf die Warteliste auf.
                </p>
                <Button asChild variant="accent"><Link to="/kurs-anfragen">Für Warteliste anfragen</Link></Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {program.terms.map((t) => (
                <Card key={t.id} className="border-0 shadow-soft">
                  <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-primary-deep">{t.name}</span>
                        {t.is_full ? (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">Ausgebucht</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-success/15 text-success border-success/30">
                            {t.free_slots != null ? `${t.free_slots} freie Plätze` : "Plätze frei"}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        {t.starts_on ? formatDateBerlin(t.starts_on) : "Termin folgt"}
                        {t.ends_on ? ` – ${formatDateBerlin(t.ends_on)}` : ""}
                      </div>
                      {t.schedule && <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1"><Clock className="h-4 w-4" />{t.schedule}</div>}
                      {t.location && <div className="text-sm text-muted-foreground flex items-start gap-2 mt-1"><MapPin className="h-4 w-4 mt-0.5" />{t.location}</div>}
                    </div>
                    <div className="shrink-0">
                      {t.is_full ? (
                        <Button asChild variant="outline"><Link to="/kurs-anfragen">Warteliste anfragen</Link></Button>
                      ) : (
                        <Button variant="accent" onClick={() => setBookingTerm(t)}>Verbindlich buchen</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Mit der Buchung gelten unsere{" "}
            <Link to="/kursbedingungen" className="text-primary underline font-semibold">Kursteilnahmebedingungen</Link>.
            Die Buchung ist verbindlich; ein 14-tägiges{" "}
            <Link to="/widerruf" className="text-primary underline font-semibold">Widerrufsrecht</Link> besteht.
          </p>
        </div>

        <aside className="space-y-6">
          <Card className="border-0 shadow-soft">
            <CardContent className="p-6 space-y-2 text-sm">
              <h2 className="font-display text-lg font-bold text-primary-deep mb-2">Kursinfos</h2>
              {program.target_group && <div className="flex items-start gap-2"><Users className="h-4 w-4 mt-0.5" />{program.target_group}</div>}
              {program.age_range && <div className="flex items-center gap-2"><Users className="h-4 w-4" />Alter: {program.age_range}</div>}
              {program.duration && <div className="flex items-center gap-2"><Clock className="h-4 w-4" />{program.duration}</div>}
              {program.location && <div className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5" />{program.location}</div>}
              {(program.price_member != null || program.price_non_member != null) && (
                <div className="flex items-start gap-2 pt-1">
                  <Tag className="h-4 w-4 mt-0.5" />
                  <div>
                    {program.price_non_member != null && <div>{fmtPrice(program.price_non_member)} Normalpreis</div>}
                    {program.price_member != null && <div className="text-primary font-semibold">{fmtPrice(program.price_member)} für Mitglieder</div>}
                  </div>
                </div>
              )}
              {program.requirements && (
                <div className="pt-2 border-t mt-3">
                  <div className="font-semibold text-primary-deep mb-1">Voraussetzungen</div>
                  <p className="text-muted-foreground">{program.requirements}</p>
                </div>
              )}
              {program.min_age_years != null && (
                <p className="text-xs text-muted-foreground pt-2">
                  Mindestalter zu Kursbeginn: {program.min_age_years} Jahre.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-soft">
            <CardContent className="p-6 text-sm">
              <h2 className="font-display text-lg font-bold text-primary-deep mb-2">Bankverbindung</h2>
              <p className="text-muted-foreground mb-3">Zahlung erst nach der Buchungsbestätigung – innerhalb von 14 Tagen, spätestens einen Tag vor Kursbeginn.</p>
              <dl className="space-y-1 text-muted-foreground">
                <div><span className="font-semibold text-foreground">Empfänger:</span> {BILLING.recipient}</div>
                <div><span className="font-semibold text-foreground">IBAN:</span> {BILLING.iban}</div>
                <div><span className="font-semibold text-foreground">BIC:</span> {BILLING.bic}</div>
              </dl>
            </CardContent>
          </Card>
        </aside>
      </section>

      <BookingDialog
        program={program}
        term={bookingTerm}
        onClose={() => setBookingTerm(null)}
        onSuccess={(r) => { setBookingTerm(null); setResult(r); }}
      />

      <AlertDialog open={result !== null} onOpenChange={(o) => { if (!o) { setResult(null); window.location.reload(); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {result?.status === "waiting" ? "Auf die Warteliste gesetzt" : "Buchung bestätigt"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {result?.status === "waiting"
                ? `Der Kurs „${result?.courseName}“ ist inzwischen ausgebucht. Wir haben Sie auf die Warteliste gesetzt und melden uns, sobald ein Platz frei wird. Eine Bestätigung per E-Mail ist unterwegs.`
                : `Ihre Buchung für „${result?.courseName}“ ist verbindlich eingegangen. Sie erhalten in Kürze eine Bestätigung per E-Mail mit allen Zahlungsinformationen.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => { setResult(null); window.location.reload(); }}>Alles klar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PublicLayout>
  );
}

function BookingDialog({
  program, term, onClose, onSuccess,
}: {
  program: CourseProgram;
  term: CourseTerm | null;
  onClose: () => void;
  onSuccess: (r: { status: "confirmed" | "waiting"; courseName: string }) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    parentName: "", parentEmail: "", parentPhone: "",
    parentStreet: "", parentZip: "", parentCity: "",
    childName: "", childDob: "", healthInfo: "", message: "",
    isMember: false, acceptTerms: false, gdprConsent: false, website: "",
  });

  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!term) return;
    if (!form.acceptTerms || !form.gdprConsent) {
      toast.error("Bitte bestätigen Sie die Kursbedingungen und die Datenschutzhinweise.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await bookCourseTerm({
        data: {
          courseId: term.id,
          parentName: form.parentName,
          parentEmail: form.parentEmail,
          parentPhone: form.parentPhone,
          parentStreet: form.parentStreet,
          parentZip: form.parentZip,
          parentCity: form.parentCity,
          childName: form.childName,
          childDob: form.childDob,
          healthInfo: form.healthInfo,
          message: form.message,
          isMember: form.isMember,
          acceptTerms: true,
          gdprConsent: true,
          website: form.website,
        },
      });
      onSuccess({ status: res.status as "confirmed" | "waiting", courseName: res.courseName ?? term.name });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Die Buchung konnte nicht abgeschlossen werden.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={term !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Verbindlich buchen</DialogTitle>
          <DialogDescription>
            {program.name}
            {term?.starts_on ? ` · ${formatDateBerlin(term.starts_on)}${term.ends_on ? ` – ${formatDateBerlin(term.ends_on)}` : ""}` : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <input
            type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
            className="hidden" value={form.website} onChange={(e) => set("website", e.target.value)}
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="parentName">Name Erziehungsberechtigte:r *</Label>
              <Input id="parentName" required value={form.parentName} onChange={(e) => set("parentName", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="parentEmail">E-Mail *</Label>
              <Input id="parentEmail" type="email" required value={form.parentEmail} onChange={(e) => set("parentEmail", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="parentPhone">Telefon</Label>
              <Input id="parentPhone" value={form.parentPhone} onChange={(e) => set("parentPhone", e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="parentStreet">Straße und Hausnummer *</Label>
              <Input id="parentStreet" required value={form.parentStreet} onChange={(e) => set("parentStreet", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="parentZip">PLZ *</Label>
              <Input id="parentZip" required inputMode="numeric" value={form.parentZip} onChange={(e) => set("parentZip", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="parentCity">Ort *</Label>
              <Input id="parentCity" required value={form.parentCity} onChange={(e) => set("parentCity", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="childName">Name des Kindes *</Label>
              <Input id="childName" required value={form.childName} onChange={(e) => set("childName", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="childDob">Geburtsdatum des Kindes *</Label>
              <Input id="childDob" type="date" required value={form.childDob} onChange={(e) => set("childDob", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="healthInfo">Gesundheitliche Hinweise</Label>
            <Textarea id="healthInfo" rows={2} value={form.healthInfo} onChange={(e) => set("healthInfo", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="message">Nachricht</Label>
            <Textarea id="message" rows={2} value={form.message} onChange={(e) => set("message", e.target.value)} />
          </div>

          <div className="flex items-start gap-2">
            <Checkbox id="isMember" checked={form.isMember} onCheckedChange={(v) => set("isMember", Boolean(v))} />
            <Label htmlFor="isMember" className="text-sm font-normal leading-snug">
              Wir sind Mitglied im Sicher-Schwimmen e.V. (Mitgliedspreis
              {program.price_member != null ? ` ${fmtPrice(program.price_member)}` : ""})
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox id="acceptTerms" checked={form.acceptTerms} onCheckedChange={(v) => set("acceptTerms", Boolean(v))} />
            <Label htmlFor="acceptTerms" className="text-sm font-normal leading-snug">
              Ich buche verbindlich und akzeptiere die{" "}
              <Link to="/kursbedingungen" className="underline text-primary" target="_blank">Kursteilnahmebedingungen</Link>. *
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox id="gdprConsent" checked={form.gdprConsent} onCheckedChange={(v) => set("gdprConsent", Boolean(v))} />
            <Label htmlFor="gdprConsent" className="text-sm font-normal leading-snug">
              Ich habe die{" "}
              <Link to="/datenschutz" className="underline text-primary" target="_blank">Datenschutzhinweise</Link> gelesen. *
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Abbrechen</Button>
            <Button type="submit" variant="accent" disabled={submitting}>
              {submitting ? "Wird gebucht…" : "Verbindlich buchen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
