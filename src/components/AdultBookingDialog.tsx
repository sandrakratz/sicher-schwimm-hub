import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PaymentSummary } from "@/components/PaymentSummary";
import { useContactDefaults } from "@/hooks/use-contact-defaults";
import { formatDateBerlin, formatPrice } from "@/lib/format";
import {
  bookCourseTerm,
  type CourseProgram,
  type CourseTerm,
} from "@/lib/courses-public.functions";

export type BookingSuccess = {
  status: "confirmed" | "waiting";
  courseName: string;
  startsOn: string | null;
  paymentDueDays: number | null;
  amount: number | null;
  /** Angabe "Mitglied" wird noch geprüft: Zahlungsaufforderung folgt per E-Mail */
  memberCheck?: boolean;
};

/**
 * Verbindliche Buchung für Erwachsene, die für sich selbst buchen:
 * nur Kontaktdaten und Rechnungsadresse – keine Angaben zu Kindern, Geburtsdatum oder Gesundheit.
 */
export function AdultBookingDialog({
  program,
  term,
  onClose,
  onSuccess,
  onBlocked,
}: {
  program: CourseProgram;
  term: CourseTerm | null;
  onClose: () => void;
  onSuccess: (r: BookingSuccess) => void;
  onBlocked: () => void;
}) {
  const { defaults, ready } = useContactDefaults();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    street: "",
    zip: "",
    city: "",
    message: "",
    isMember: false,
    ageConfirmed: false,
    acceptTerms: false,
    gdprConsent: false,
    website: "",
  });
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  // Bekannte Daten angemeldeter Personen vorbelegen
  useEffect(() => {
    if (!ready || !defaults.signedIn) return;
    setForm((f) => ({
      ...f,
      firstName: f.firstName || defaults.firstName,
      lastName: f.lastName || defaults.lastName,
      email: f.email || defaults.email,
      phone: f.phone || defaults.phone,
      street: f.street || defaults.street,
      zip: f.zip || defaults.zip,
      city: f.city || defaults.city,
      isMember: f.isMember || defaults.isMember === true,
    }));
  }, [ready, defaults]);

  const memberPrice = term?.price_member ?? program.price_member ?? null;
  const nonMemberPrice = term?.price_non_member ?? program.price_non_member ?? null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!term || submitting) return;
    if (!form.ageConfirmed || !form.acceptTerms || !form.gdprConsent) {
      toast.error(
        "Bitte bestätigen Sie Ihre Volljährigkeit, die Kursbedingungen und die Datenschutzhinweise.",
      );
      return;
    }
    setSubmitting(true);
    try {
      const r = (await bookCourseTerm({
        data: {
          audience: "adult",
          courseId: term.id,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          street: form.street,
          zip: form.zip,
          city: form.city,
          message: form.message,
          isMember: form.isMember,
          ageConfirmed: true,
          acceptTerms: true,
          gdprConsent: true,
          website: form.website,
        },
      })) as
        | {
            blocked?: boolean;
            status?: string;
            courseName?: string;
            price?: number | null;
            memberCheckPending?: boolean;
          }
        | undefined;
      if (r?.blocked) {
        onBlocked();
        return;
      }
      onSuccess({
        status: r?.status === "waiting" ? "waiting" : "confirmed",
        courseName: r?.courseName ?? term.name,
        startsOn: term.starts_on,
        paymentDueDays: program.payment_due_days,
        amount: r?.price ?? null,
        memberCheck: Boolean(r?.memberCheckPending),
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Die Buchung konnte nicht abgeschlossen werden.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={term !== null}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Verbindlich buchen</DialogTitle>
          <DialogDescription>
            {program.name}
            {term?.starts_on
              ? ` · ${formatDateBerlin(term.starts_on)}${term.ends_on ? ` – ${formatDateBerlin(term.ends_on)}` : ""}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
            value={form.website}
            onChange={(e) => set("website", e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ab-first">Vorname *</Label>
              <Input
                id="ab-first"
                required
                maxLength={60}
                autoComplete="given-name"
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ab-last">Nachname *</Label>
              <Input
                id="ab-last"
                required
                maxLength={60}
                autoComplete="family-name"
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ab-email">E-Mail *</Label>
              <Input
                id="ab-email"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ab-phone">Telefon (für Rückfragen) *</Label>
              <Input
                id="ab-phone"
                type="tel"
                required
                minLength={5}
                maxLength={60}
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ab-street">Straße und Hausnummer (für die Rechnung) *</Label>
              <Input
                id="ab-street"
                required
                autoComplete="street-address"
                value={form.street}
                onChange={(e) => set("street", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ab-zip">PLZ *</Label>
              <Input
                id="ab-zip"
                required
                inputMode="numeric"
                autoComplete="postal-code"
                value={form.zip}
                onChange={(e) => set("zip", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ab-city">Ort *</Label>
              <Input
                id="ab-city"
                required
                autoComplete="address-level2"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ab-message">Nachricht (optional)</Label>
            <Textarea
              id="ab-message"
              rows={2}
              maxLength={2000}
              value={form.message}
              onChange={(e) => set("message", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-start gap-2">
              <Checkbox
                id="ab-member"
                checked={form.isMember}
                onCheckedChange={(v) => set("isMember", Boolean(v))}
              />
              <Label htmlFor="ab-member" className="text-sm font-normal leading-snug">
                Ich bin Mitglied im Sicher-Schwimmen e.V.
                {memberPrice != null ? ` (Mitgliedspreis ${formatPrice(memberPrice)})` : ""}
              </Label>
            </div>
            {form.isMember && (
              <p className="pl-6 text-xs text-muted-foreground">
                Wir prüfen Ihre Mitgliedschaft. Findet das System sie nicht sofort, erhalten Sie die
                Zahlungsaufforderung erst nach unserer Prüfung. Ohne Mitgliedschaft gilt{" "}
                {formatPrice(nonMemberPrice) ?? "der Normalpreis"}.
              </p>
            )}
          </div>

          <PaymentSummary
            startsOn={term?.starts_on}
            paymentDueDays={program.payment_due_days}
            amount={form.isMember ? memberPrice : nonMemberPrice}
          />

          <div className="flex items-start gap-2">
            <Checkbox
              id="ab-age"
              checked={form.ageConfirmed}
              onCheckedChange={(v) => set("ageConfirmed", Boolean(v))}
            />
            <Label htmlFor="ab-age" className="text-sm font-normal leading-snug">
              Ich bin mindestens 18 Jahre alt und buche für mich selbst. *
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="ab-terms"
              checked={form.acceptTerms}
              onCheckedChange={(v) => set("acceptTerms", Boolean(v))}
            />
            <Label htmlFor="ab-terms" className="text-sm font-normal leading-snug">
              Ich buche verbindlich und akzeptiere die{" "}
              <Link to="/kursbedingungen" className="text-primary underline" target="_blank">
                Kursteilnahmebedingungen
              </Link>
              . *
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="ab-gdpr"
              checked={form.gdprConsent}
              onCheckedChange={(v) => set("gdprConsent", Boolean(v))}
            />
            <Label htmlFor="ab-gdpr" className="text-sm font-normal leading-snug">
              Ich habe die{" "}
              <Link to="/datenschutz" className="text-primary underline" target="_blank">
                Datenschutzhinweise
              </Link>{" "}
              gelesen. *
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Abbrechen
            </Button>
            <Button type="submit" variant="accent" disabled={submitting}>
              {submitting ? "Wird gebucht…" : "Verbindlich buchen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
