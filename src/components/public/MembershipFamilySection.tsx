import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TextField } from "./TextField";
import {
  CHILDREN_WITHOUT_PROOF,
  INITIAL_CHILD_ROWS,
  MAX_CHILDREN,
  filledCount,
  type FamilyMember,
} from "./membership-form";
import type { FamilyMembers } from "./use-family-members";

/** Eingabezeile für eine Person (Partner/in oder Kind). */
function FamilyMemberFields({
  title,
  member,
  dobRequired,
  emailLabel,
  onChange,
}: {
  title: string;
  member: FamilyMember;
  dobRequired: boolean;
  emailLabel: string;
  onChange: (patch: Partial<FamilyMember>) => void;
}) {
  return (
    <div>
      <h4 className="text-sm font-medium mb-2">{title}</h4>
      <div className="grid md:grid-cols-3 gap-4">
        <TextField
          label="Vorname"
          value={member.name}
          onChange={(e) => onChange({ name: e.target.value })}
          maxLength={100}
        />
        <TextField
          label="Nachname"
          value={member.last_name}
          placeholder="wie oben, falls leer"
          onChange={(e) => onChange({ last_name: e.target.value })}
          maxLength={100}
        />
        <TextField
          label={`Geburtsdatum${dobRequired ? " *" : ""}`}
          type="date"
          required={dobRequired}
          value={member.date_of_birth}
          onChange={(e) => onChange({ date_of_birth: e.target.value })}
        />
        <TextField
          className="md:col-span-2"
          label={emailLabel}
          type="email"
          value={member.email ?? ""}
          onChange={(e) => onChange({ email: e.target.value })}
          maxLength={255}
        />
        <TextField
          label="Telefon (optional)"
          type="tel"
          value={member.phone ?? ""}
          onChange={(e) => onChange({ phone: e.target.value })}
          maxLength={40}
        />
      </div>
    </div>
  );
}

const NOTICE_BOX = "rounded-lg border-2 border-accent/40 bg-accent/5 p-4 text-sm";

export function MembershipFamilySection({ family }: { family: FamilyMembers }) {
  const { partner, children } = family;
  const manyChildren = filledCount(children) > CHILDREN_WITHOUT_PROOF;
  return (
    <div className="border-t pt-5">
      <h3 className="font-semibold text-primary-deep mb-1">Familienangaben</h3>
      <div className={`my-4 ${NOTICE_BOX} space-y-2`}>
        <p className="font-semibold text-primary-deep">
          Wichtig bei minderjährigen Familienmitgliedern
        </p>
        <p>
          Bei einer Familienmitgliedschaft sind die einzelnen Familienangehörigen jeweils
          eigenständige Vereinsmitglieder.
        </p>
        <p>
          Der Familienbeitrag gilt gemäß der Beitragsordnung für maximal zwei Erwachsene und die im
          selben Haushalt lebenden Kinder und Jugendlichen bis zur Vollendung des 18. Lebensjahres.
        </p>
        <p>
          Wird ein minderjähriges Familienmitglied volljährig, endet dadurch nicht automatisch
          dessen Vereinsmitgliedschaft. Das Mitglied wird ab diesem Zeitpunkt als erwachsenes
          Mitglied geführt und fällt aus der Familienbeitragsregelung heraus. Für das erwachsene
          Mitglied gilt der jeweils gültige Beitrag für erwachsene Mitglieder.
        </p>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Bitte tragen Sie Partner/in und alle Kinder ein. Weitere Kinder können Sie mit „Weiteres
        Kind hinzufügen“ ergänzen. Nicht ausgefüllte Felder werden ignoriert.
      </p>
      <div className="space-y-4">
        <FamilyMemberFields
          title="Partner/in"
          member={partner}
          dobRequired={false}
          emailLabel="E-Mail (optional)"
          onChange={family.updatePartner}
        />
        {children.map((c, i) => (
          <FamilyMemberFields
            key={i}
            title={`Kind ${i + 1}`}
            member={c}
            dobRequired={Boolean(c.name.trim())}
            emailLabel="E-Mail des Kindes (optional, v. a. für Jugendliche)"
            onChange={(patch) => family.updateChild(i, patch)}
          />
        ))}
        {manyChildren && (
          <div className={NOTICE_BOX}>
            <p className="font-semibold text-primary-deep mb-1">
              Nachweis erforderlich (Haushaltsbescheinigung)
            </p>
            <p>
              Bei mehr als 3 Kindern benötigen wir einen Nachweis, aus dem hervorgeht, dass alle
              Familienmitglieder unter der Haushaltsadresse gemeldet sind (z. B. eine
              Haushaltsbescheinigung des Einwohnermeldeamts). Bitte senden Sie uns diesen nach der
              Anmeldung zu.
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={family.addChild}
            disabled={children.length >= MAX_CHILDREN}
          >
            <Plus className="h-4 w-4 mr-1" /> Weiteres Kind hinzufügen
          </Button>
          {children.length > INITIAL_CHILD_ROWS && (
            <Button type="button" variant="ghost" size="sm" onClick={family.removeLastChild}>
              <Minus className="h-4 w-4 mr-1" /> Letztes Kind entfernen
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={family.proofDialogOpen} onOpenChange={family.setProofDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Haushaltsbescheinigung erforderlich</AlertDialogTitle>
            <AlertDialogDescription>
              Bei mehr als 3 Kindern benötigen wir einen Nachweis, aus dem eindeutig hervorgeht,
              dass alle Familienmitglieder unter der Haushaltsadresse gemeldet sind (z. B. eine
              Haushaltsbescheinigung des Einwohnermeldeamts). Bitte senden Sie uns diesen nach der
              Anmeldung zu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Verstanden</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
