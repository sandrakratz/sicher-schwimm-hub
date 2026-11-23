import { Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { BILLING } from "@/lib/billing-config";
import { todayBerlinIso } from "@/lib/format";
import { TextField } from "./TextField";
import { MINOR_CONSENTS } from "./membership-form";

/** Ganze Zeile klickbare Pflicht-Checkbox (ungesteuert, Wert kommt über FormData). */
function RequiredCheck({
  name,
  className = "",
  children,
}: {
  name: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex gap-3 items-start text-sm cursor-pointer ${className}`.trim()}>
      <Checkbox name={name} required /> <span>{children}</span>
    </label>
  );
}

/** Erziehungsberechtigte; bei minderjährigen Mitgliedern zusätzlich Kontakt und Zustimmungen. */
export function GuardianSection({ showMinor }: { showMinor: boolean }) {
  return (
    <div className="border-t pt-5">
      <h3 className="font-semibold text-primary-deep mb-3">
        Erziehungsberechtigte/r (bei Minderjährigen){showMinor ? " *" : ""}
      </h3>
      {showMinor && (
        <p className="text-xs text-muted-foreground -mt-2 mb-3">
          Die oben eingetragenen Personendaten sind die des Mitglieds (Kind). Hier bitte die
          gesetzlichen Vertreter eintragen.
        </p>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        <TextField id="guardian_name" name="guardian_name" label="Name" maxLength={200} />
        <TextField
          id="guardian_email"
          type="email"
          name="guardian_email"
          label="E-Mail"
          maxLength={255}
        />
        <TextField id="guardian_phone" name="guardian_phone" label="Telefon" maxLength={40} />
      </div>
      {showMinor && (
        <div className="mt-5 space-y-4">
          <div className="rounded-lg border-2 border-accent/40 bg-accent/5 p-4 text-sm space-y-2">
            <p className="font-semibold text-primary-deep">Mitgliedschaft bei Minderjährigen</p>
            <p>
              Die Mitgliedschaft wird für das minderjährige Mitglied selbst beantragt. Die
              gesetzlichen Vertreter stimmen der Aufnahme in Sicher Schwimmen e.V. zu und handeln
              bis zum Eintritt der Volljährigkeit als gesetzliche Vertreter des minderjährigen
              Mitglieds.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-primary-deep mb-1">
              Kontaktdaten des Mitglieds (Kind/Jugendliche/r)
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              Wir benötigen die Kontaktdaten des Mitglieds, damit wir es rechtzeitig vor Erreichen
              der Volljährigkeit direkt über seine bestehende Mitgliedschaft und die weiteren
              Schritte informieren können.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <TextField
                id="member_email"
                type="email"
                name="member_email"
                label="E-Mail des Mitglieds *"
                required
                maxLength={255}
              />
              <TextField
                id="member_phone"
                type="tel"
                name="member_phone"
                label="Telefon des Mitglieds (optional)"
                maxLength={40}
              />
            </div>
          </div>
          <div className="space-y-3">
            {MINOR_CONSENTS.map((c) => (
              <RequiredCheck key={c.key} name={c.key}>
                {c.text} *
              </RequiredCheck>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** SEPA-Lastschriftmandat. `minorHint`: Hinweis auf ein späteres neues Mandat bei Volljährigkeit. */
export function SepaMandateSection({
  showMinor,
  minorHint,
}: {
  showMinor: boolean;
  minorHint: boolean;
}) {
  return (
    <div className="border-t pt-5">
      <h3 className="font-semibold text-primary-deep mb-1">SEPA-Lastschriftmandat</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Gläubiger-Identifikationsnummer: {BILLING.creditorId}
      </p>
      <p className="text-sm text-muted-foreground mb-4">
        Ich ermächtige den Verein Sicher Schwimmen e.V., Zahlungen von meinem Konto mittels
        Lastschrift einzuziehen. Zugleich weise ich mein Kreditinstitut an, die auf mein Konto
        gezogenen Lastschriften einzulösen.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label htmlFor="payer_role">Wer ist Kontoinhaber/in bzw. zahlt den Beitrag? *</Label>
          {/* key: Vorauswahl wechselt mit „minderjährig“ */}
          <select
            id="payer_role"
            name="payer_role"
            defaultValue={showMinor ? "guardian" : "member"}
            key={showMinor ? "m" : "a"}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="member">Das Mitglied selbst</option>
            <option value="guardian">Erziehungsberechtigte/r</option>
            <option value="other">Andere Person</option>
          </select>
        </div>
        <TextField
          className="md:col-span-2"
          id="sepa_account_holder"
          name="sepa_account_holder"
          label="Name Kontoinhaber/in *"
          required
          maxLength={200}
        />
        <TextField
          className="md:col-span-2"
          id="sepa_iban"
          name="sepa_iban"
          label="IBAN *"
          required
          maxLength={42}
          placeholder="DE00 0000 0000 0000 0000 00"
        />
        <TextField id="sepa_bic" name="sepa_bic" label="BIC" maxLength={11} />
        <TextField
          id="sepa_bank_name"
          name="sepa_bank_name"
          label="Kreditinstitut *"
          required
          maxLength={200}
        />
        <TextField
          id="sepa_signature_place"
          name="sepa_signature_place"
          label="Ort *"
          required
          maxLength={120}
        />
        <TextField
          id="sepa_signature_date"
          type="date"
          name="sepa_signature_date"
          label="Datum *"
          required
          defaultValue={todayBerlinIso()}
        />
      </div>
      <RequiredCheck name="sepa_mandate_accepted" className="mt-4">
        Ich erteile das SEPA-Lastschriftmandat. Bei Minderjährigen erfolgt die Unterschrift durch
        die gesetzlichen Vertreter. *
      </RequiredCheck>
      {minorHint && (
        <p className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-primary-deep">
          Wenn ein minderjähriges Mitglied volljährig wird und die Mitgliedschaft fortgeführt wird,
          kann für die weitere Beitragszahlung ein neues bzw. gesondertes SEPA-Lastschriftmandat
          erforderlich sein. Der Verein wird das Mitglied rechtzeitig darüber informieren.
        </p>
      )}
    </div>
  );
}

const LEGAL_CONSENTS = [
  { name: "accepted_statutes", to: "/satzung", label: "Vereinssatzung" },
  { name: "accepted_rules", to: "/mitgliedsordnung", label: "Mitgliedsordnung" },
  { name: "accepted_privacy", to: "/datenschutz", label: "Datenschutzerklärung" },
] as const;

export function MembershipConsents() {
  return (
    <div className="space-y-3 border-t pt-5">
      {LEGAL_CONSENTS.map((c) => (
        <RequiredCheck key={c.name} name={c.name}>
          Ich akzeptiere die{" "}
          <Link to={c.to} className="text-primary underline">
            {c.label}
          </Link>
          . *
        </RequiredCheck>
      ))}
    </div>
  );
}

export function AccountPasswordSection() {
  return (
    <div className="border-t pt-5">
      <h3 className="font-semibold text-primary-deep mb-1">Mitgliederkonto (optional)</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Wir legen für Sie automatisch ein Konto für den Mitgliederbereich an. Sie können hier direkt
        ein Passwort vergeben — oder das Feld leer lassen, dann erhalten Sie per E-Mail einen Link,
        um Ihr Passwort selbst zu setzen. Die Freischaltung erfolgt nach Prüfung durch den
        Vereinsvorstand.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        <TextField
          id="account_password"
          type="password"
          name="account_password"
          label="Passwort (mind. 8 Zeichen, optional)"
          minLength={8}
          autoComplete="new-password"
        />
        <TextField
          id="account_password_confirm"
          type="password"
          name="account_password_confirm"
          label="Passwort wiederholen"
          minLength={8}
          autoComplete="new-password"
        />
      </div>
    </div>
  );
}
