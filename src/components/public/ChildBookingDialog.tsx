import { Link } from "@tanstack/react-router";
import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HoneypotField } from "@/components/form-support";
import { PaymentSummary } from "@/components/PaymentSummary";
import type { BookingSuccess } from "@/components/AdultBookingDialog";
import { useFormTracking } from "@/lib/analytics/forms";
import { formatPrice, todayBerlinIso } from "@/lib/format";
import { proratePrice } from "@/lib/prorated-price";
import {
  bookCourseTerm,
  type CourseProgram,
  type CourseTerm,
} from "@/lib/courses-public.functions";
import { TextField } from "./TextField";
import { MEMBER_DISCOUNT_NOTE, formatTermRange } from "./course-page-helpers";

type Kid = { childName: string; childLastName: string; childDob: string; healthInfo: string };

/** Antwort von bookCourseTerm, soweit sie hier ausgewertet wird. */
type BookResult = {
  blocked?: boolean;
  status?: "confirmed" | "waiting";
  courseName?: string;
  memberCheckPending?: boolean;
};

/** Neben dem ersten Kind höchstens drei Geschwister in einem Durchgang */
const MAX_KIDS = 4;

const emptyKid = (childLastName = ""): Kid => ({
  childName: "",
  childLastName,
  childDob: "",
  healthInfo: "",
});

const fullName = (first: string, last: string) => `${first.trim()} ${last.trim()}`.trim();

/**
 * Angaben zu einem Kind. Das erste Kind (`primary`) trägt die festen Feld-IDs und
 * übernimmt beim Antippen des Nachnamens den Nachnamen der Eltern.
 */
function KidFields({
  kid,
  idPrefix,
  primary,
  parentLast,
  onChange,
}: {
  kid: Kid;
  idPrefix: string;
  primary: boolean;
  parentLast: string;
  onChange: (k: keyof Kid, v: string) => void;
}) {
  const label = (base: string) => (primary ? `${base} des Kindes *` : `${base} *`);
  const id = (k: keyof Kid) => `${idPrefix}${k}`;
  return (
    <>
      <div className="grid sm:grid-cols-2 gap-3">
        <TextField
          className="space-y-1.5"
          id={id("childName")}
          label={label("Vorname")}
          required
          value={kid.childName}
          onChange={(e) => onChange("childName", e.target.value)}
        />
        <TextField
          className="space-y-1.5"
          id={id("childLastName")}
          label={label("Nachname")}
          required
          value={kid.childLastName}
          {...(primary
            ? {
                placeholder: parentLast || undefined,
                onFocus: () => {
                  if (!kid.childLastName && parentLast) onChange("childLastName", parentLast);
                },
              }
            : {})}
          onChange={(e) => onChange("childLastName", e.target.value)}
        />
        <TextField
          className="space-y-1.5"
          id={id("childDob")}
          label={label("Geburtsdatum")}
          type="date"
          required
          value={kid.childDob}
          onChange={(e) => onChange("childDob", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id("healthInfo")}>Gesundheitliche Hinweise (freiwillig)</Label>
        <Textarea
          id={id("healthInfo")}
          rows={2}
          value={kid.healthInfo}
          onChange={(e) => onChange("healthInfo", e.target.value)}
        />
      </div>
    </>
  );
}

/** Checkbox mit Beschriftung (Zustimmungen, Mitgliedsangabe). */
function CheckRow({
  id,
  checked,
  onChange,
  className = "",
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex items-start gap-2 ${className}`.trim()}>
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
      <Label htmlFor={id} className="text-sm font-normal leading-snug">
        {children}
      </Label>
    </div>
  );
}

/** Verbindliche Buchung eines Kinderkurses (Eltern + ein Kind, optional Geschwister). */
export function ChildBookingDialog({
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
  const ft = useFormTracking("kursbuchung_kind");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    parentFirstName: "",
    parentLastName: "",
    parentEmail: "",
    parentPhone: "",
    parentStreet: "",
    parentZip: "",
    parentCity: "",
    message: "",
    isMember: false,
    acceptTerms: false,
    gdprConsent: false,
    healthConsent: false,
    website: "",
  });
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  // kids[0] = angemeldetes Kind, danach Geschwister
  const [kids, setKids] = useState<Kid[]>([emptyKid()]);
  const setKid = (i: number, k: keyof Kid, v: string) =>
    setKids((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const siblings = kids.length - 1;

  const parentLast = form.parentLastName.trim();
  const hasHealthInfo = kids.some((k) => k.healthInfo.trim());

  // Bereits gestartete Kurse: anteilig nach den noch ausstehenden Terminen (Server rechnet identisch)
  const prorated = proratePrice(
    form.isMember
      ? (term?.price_member ?? program.price_member ?? null)
      : (term?.price_non_member ?? program.price_non_member ?? null),
    (term?.dates ?? []).filter((d) => d.index != null).map((d) => d.date),
    todayBerlinIso(),
  );
  const price = prorated.price;
  const totalPrice = price != null ? price * (1 + siblings) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!term) return;
    if (!form.acceptTerms || !form.gdprConsent) {
      ft.invalid(
        [!form.acceptTerms && "accept_terms", !form.gdprConsent && "gdpr_consent"].filter(
          (x): x is string => Boolean(x),
        ),
      );
      toast.error("Bitte bestätigen Sie die Kursbedingungen und die Datenschutzhinweise.");
      return;
    }
    if (hasHealthInfo && !form.healthConsent) {
      ft.invalid(["health_consent"]);
      toast.error(
        "Bitte willigen Sie in die Verarbeitung der Gesundheitsangaben ein oder löschen Sie diese Angaben.",
      );
      return;
    }
    ft.attempt();
    setSubmitting(true);
    try {
      const toBook = [kids[0], ...kids.slice(1).filter((k) => k.childName.trim())].map((k) => ({
        childName: fullName(k.childName, k.childLastName),
        childDob: k.childDob,
        healthInfo: k.healthInfo,
      }));
      if (toBook.some((k) => k.childName.split(/\s+/).length < 2)) {
        ft.failed("kindname_unvollstaendig");
        toast.error("Bitte Vor- und Nachnamen jedes Kindes angeben.");
        return;
      }
      // Erste erfolgreiche Antwort (liefert Kursname und Mitgliedsprüfung)
      let first: BookResult | null = null;
      const confirmed: string[] = [];
      const waiting: string[] = [];
      const failed: string[] = [];
      for (const kid of toBook) {
        let r: BookResult;
        try {
          r = (await bookCourseTerm({
            data: {
              courseId: term.id,
              parentName: fullName(form.parentFirstName, form.parentLastName),
              parentEmail: form.parentEmail,
              parentPhone: form.parentPhone,
              parentStreet: form.parentStreet,
              parentZip: form.parentZip,
              parentCity: form.parentCity,
              childName: kid.childName,
              childDob: kid.childDob,
              healthInfo: kid.healthInfo,
              healthConsent: kid.healthInfo.trim() ? true : undefined,
              message: form.message,
              isMember: form.isMember,
              acceptTerms: true,
              gdprConsent: true,
              website: form.website,
            },
          })) as BookResult;
        } catch (err) {
          // Erstes Kind ohne Erfolg → normale Fehlermeldung, nichts wurde gebucht.
          if (!first) throw err;
          failed.push(kid.childName);
          toast.error(
            `${kid.childName}: ${err instanceof Error ? err.message : "konnte nicht gebucht werden."}`,
          );
          continue;
        }
        if (r?.blocked) {
          if (!first) {
            ft.failed("gesperrt");
            onBlocked();
            return;
          }
          failed.push(kid.childName);
          toast.error(`${kid.childName} konnte nicht gebucht werden. Bitte kontaktieren Sie uns.`);
          continue;
        }
        first = first ?? r;
        (r?.status === "waiting" ? waiting : confirmed).push(kid.childName);
      }
      if (!first) return;
      const booked = [...confirmed, ...waiting];
      if (confirmed.length && waiting.length) {
        toast.info(`Auf der Warteliste: ${waiting.join(", ")}`);
      }
      if (failed.length) {
        toast.warning(
          `Gebucht wurde: ${booked.join(", ")}. Nicht gebucht: ${failed.join(", ")} – bitte nicht erneut absenden, sondern uns kontaktieren.`,
          { duration: 12000 },
        );
      }
      ft.succeeded();
      onSuccess({
        status: confirmed.length ? "confirmed" : "waiting",
        courseName: `${first.courseName ?? term.name}${booked.length > 1 ? ` (${booked.join(", ")})` : ""}`,
        startsOn: term.starts_on,
        paymentDueDays: program.payment_due_days,
        amount: price != null && confirmed.length ? price * confirmed.length : null,
        memberCheck: Boolean(first.memberCheckPending),
      });
    } catch (err) {
      ft.failed("buchung_fehlgeschlagen");
      toast.error(
        err instanceof Error ? err.message : "Die Buchung konnte nicht abgeschlossen werden.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  /** Kontaktfeld der Eltern (gesteuert über `form`). */
  const parentField = (
    k: keyof typeof form & `parent${string}`,
    label: string,
    props: Partial<React.ComponentProps<typeof TextField>> = {},
  ) => (
    <TextField
      className="space-y-1.5"
      id={k}
      label={label}
      required
      value={form[k] as string}
      onChange={(e) => set(k, e.target.value)}
      {...props}
    />
  );

  return (
    <Dialog
      open={term !== null}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Verbindlich buchen</DialogTitle>
          <DialogDescription>
            {program.name}
            {term?.starts_on ? ` · ${formatTermRange(term.starts_on, term.ends_on)}` : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} {...ft.formProps} className="space-y-4">
          <HoneypotField value={form.website} onChange={(v) => set("website", v)} />
          <div className="grid sm:grid-cols-2 gap-3">
            {parentField("parentFirstName", "Vorname Erziehungsberechtigte:r *", {
              maxLength: 60,
            })}
            {parentField("parentLastName", "Nachname Erziehungsberechtigte:r *", {
              maxLength: 60,
            })}
            {parentField("parentEmail", "E-Mail *", { type: "email" })}
            {parentField("parentPhone", "Telefon (für Notfälle) *", {
              type: "tel",
              minLength: 5,
              maxLength: 60,
            })}
            {parentField("parentStreet", "Straße und Hausnummer *", {
              className: "space-y-1.5 sm:col-span-2",
            })}
            {parentField("parentZip", "PLZ *", { inputMode: "numeric" })}
            {parentField("parentCity", "Ort *")}
          </div>

          {kids.map((kid, i) =>
            i === 0 ? (
              <KidFields
                key={0}
                kid={kid}
                idPrefix=""
                primary
                parentLast={parentLast}
                onChange={(k, v) => setKid(0, k, v)}
              />
            ) : (
              <div key={i} className="rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Geschwisterkind {i}</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setKids((l) => l.filter((_, j) => j !== i))}
                  >
                    Entfernen
                  </Button>
                </div>
                <KidFields
                  kid={kid}
                  idPrefix={`sibling${i}-`}
                  primary={false}
                  parentLast={parentLast}
                  onChange={(k, v) => setKid(i, k, v)}
                />
              </div>
            ),
          )}
          {kids.length < MAX_KIDS && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setKids((l) => [...l, emptyKid(l[0].childLastName || parentLast)])}
            >
              + Weiteres Kind anmelden (Geschwister)
            </Button>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="message">Nachricht</Label>
            <Textarea
              id="message"
              rows={2}
              value={form.message}
              onChange={(e) => set("message", e.target.value)}
            />
          </div>

          {hasHealthInfo && (
            <CheckRow
              id="healthConsent"
              checked={form.healthConsent}
              onChange={(v) => set("healthConsent", v)}
              className="rounded-md border border-primary/30 bg-primary/5 p-3"
            >
              Ich willige ausdrücklich ein, dass der Verein die oben gemachten Gesundheitsangaben
              zur sicheren Durchführung des Kurses verarbeitet (Art. 9 Abs. 2 lit. a DSGVO). Die
              Angabe ist freiwillig; ich kann die Einwilligung jederzeit mit Wirkung für die Zukunft
              widerrufen (info@sicher-schwimmen.com). *
            </CheckRow>
          )}

          <CheckRow id="isMember" checked={form.isMember} onChange={(v) => set("isMember", v)}>
            Wir sind Mitglied im Sicher-Schwimmen e.V. (Mitgliedspreis
            {program.price_member != null ? ` ${formatPrice(program.price_member)}` : ""})
          </CheckRow>
          <p className="text-xs text-muted-foreground">{MEMBER_DISCOUNT_NOTE}</p>
          {form.isMember && (
            <p className="text-xs text-muted-foreground">
              Wir prüfen die Mitgliedschaft. Wird sie nicht sofort im System gefunden, erhalten Sie
              die Zahlungsaufforderung erst nach unserer Prüfung; ohne Mitgliedschaft gilt der
              Normalpreis.
            </p>
          )}
          <PaymentSummary
            startsOn={term?.starts_on}
            paymentDueDays={program.payment_due_days}
            amount={totalPrice}
          />
          {prorated.prorated && (
            <p className="text-xs text-muted-foreground">
              Der Kurs hat bereits begonnen. Die Kursgebühr von {formatPrice(prorated.fullPrice)}{" "}
              wird um die {prorated.past} von {prorated.total} Terminen gekürzt, die schon
              stattgefunden haben: {formatPrice(price)} pro Kind. Die Zahlung ist nur per
              Sofortüberweisung möglich.
            </p>
          )}

          <CheckRow
            id="acceptTerms"
            checked={form.acceptTerms}
            onChange={(v) => set("acceptTerms", v)}
          >
            Ich buche verbindlich und akzeptiere die{" "}
            <Link to="/kursbedingungen" className="underline text-primary" target="_blank">
              Kursteilnahmebedingungen
            </Link>
            . *
          </CheckRow>
          <CheckRow
            id="gdprConsent"
            checked={form.gdprConsent}
            onChange={(v) => set("gdprConsent", v)}
          >
            Ich habe die{" "}
            <Link to="/datenschutz" className="underline text-primary" target="_blank">
              Datenschutzhinweise
            </Link>{" "}
            gelesen. *
          </CheckRow>

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
