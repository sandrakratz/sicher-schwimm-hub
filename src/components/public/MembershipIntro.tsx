import { Link } from "@tanstack/react-router";
import { Check, Euro, Star, Vote, Waves } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

import { TIERS, type MembershipTier } from "./membership-form";

const BENEFITS = [
  {
    icon: Waves,
    title: "Kostenlose Wasserzeit",
    desc: "Einmal im Monat exklusive Wasserzeit für Mitglieder – Termine werden vom Verein bekannt gegeben.",
  },
  {
    icon: Euro,
    title: "Vergünstigte Kurse",
    desc: "Mitglieder zahlen für Schwimmkurse weniger als Nichtmitglieder. Die Preise stehen in der jeweiligen Kursausschreibung.",
  },
  {
    icon: Star,
    title: "Bevorzugte Plätze",
    desc: "Bei der Kursvergabe werden Vereinsmitglieder bevorzugt berücksichtigt.",
  },
  {
    icon: Vote,
    title: "Mitbestimmung",
    desc: "Stimmrecht in der Mitgliederversammlung und aktive Mitgestaltung des Vereins.",
  },
];

export function MembershipBenefits() {
  return (
    <div className="max-w-5xl mx-auto mb-16">
      <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-deep text-center mb-3">
        Warum sich eine Mitgliedschaft lohnt
      </h2>
      <p className="text-center text-muted-foreground mb-10 max-w-2xl mx-auto">
        Als Mitglied profitieren Sie nicht nur von vergünstigten Kursen, sondern unterstützen aktiv
        sichere Schwimmausbildung in Hennef.
      </p>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        {BENEFITS.map((b) => (
          <Card key={b.title} className="shadow-soft border-0">
            <CardContent className="p-6 text-center">
              <b.icon className="h-10 w-10 text-accent mx-auto mb-3" />
              <h3 className="font-display font-bold text-primary-deep mb-2">{b.title}</h3>
              <p className="text-sm text-muted-foreground">{b.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function TierCards({
  tier,
  onSelect,
}: {
  tier: MembershipTier;
  onSelect: (t: MembershipTier) => void;
}) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
      {TIERS.map((t) => (
        <Card
          key={t.type}
          onClick={() => onSelect(t.type)}
          className={`cursor-pointer transition-all border-2 ${tier === t.type ? "border-accent shadow-glow -translate-y-1" : "border-transparent shadow-soft hover:-translate-y-1"}`}
        >
          <CardContent className="p-6 text-center">
            <t.icon className="h-10 w-10 text-primary mx-auto mb-3" />
            <h3 className="font-display font-bold text-lg text-primary-deep">{t.name}</h3>
            <div className="text-2xl font-bold text-accent my-2">{t.price}</div>
            <p className="text-sm text-muted-foreground">{t.desc}</p>
            {tier === t.type && (
              <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent">
                <Check className="h-3.5 w-3.5" /> Ausgewählt
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export type AccountResult = "none" | "created" | "created_no_password" | "exists" | "failed";

const OK_BOX = "mt-2 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-900";
const WARN_BOX = "mt-2 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900";

/** Bestätigung nach dem Absenden, je nach Ergebnis der automatischen Kontoanlage. */
export function MembershipSubmittedDialog({
  open,
  accountResult,
  onClose,
}: {
  open: boolean;
  accountResult: AccountResult;
  onClose: () => void;
}) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Mitgliedsantrag eingegangen</AlertDialogTitle>
          <AlertDialogDescription>
            Ihr Mitgliedsantrag ist eingegangen. Er wird vom Vereinsvorstand geprüft. Sie erhalten
            eine Rückmeldung per E-Mail.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {accountResult === "created" && (
          <div className={OK_BOX}>
            Ihr Konto wurde angelegt. Bitte bestätigen Sie Ihre E-Mail-Adresse über den Link, den
            wir Ihnen gerade gesendet haben. Die Freischaltung erfolgt anschließend durch den
            Vereinsvorstand.
          </div>
        )}
        {accountResult === "created_no_password" && (
          <div className={OK_BOX}>
            Ihr Konto wurde angelegt. Wir haben Ihnen eine E-Mail gesendet, mit der Sie Ihr Passwort
            vergeben können. Nach Bestätigung Ihrer E-Mail wird Ihr Konto vom Vereinsvorstand
            freigeschaltet.
          </div>
        )}
        {accountResult === "exists" && (
          <div className={`${WARN_BOX} space-y-2`}>
            <p>Für diese E-Mail existiert bereits ein Konto. Sie können sich direkt anmelden.</p>
            <Button asChild variant="outline" size="sm">
              <Link to="/auth">Zum Login</Link>
            </Button>
          </div>
        )}
        {accountResult === "failed" && (
          <div className={WARN_BOX}>
            Ihr Antrag wurde gespeichert, das automatische Anlegen Ihres Kontos ist jedoch
            fehlgeschlagen. Der Vorstand wird Sie kontaktieren.
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose}>Schließen</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
