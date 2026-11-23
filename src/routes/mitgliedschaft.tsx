import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Heart } from "lucide-react";
import { toast } from "sonner";
import { useFormTracking } from "@/lib/analytics/forms";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HoneypotField, SubmitButton } from "@/components/form-support";
import { TextField } from "@/components/public/TextField";
import {
  MembershipBenefits,
  MembershipSubmittedDialog,
  TierCards,
  type AccountResult,
} from "@/components/public/MembershipIntro";
import { MembershipFamilySection } from "@/components/public/MembershipFamilySection";
import { useFamilyMembers } from "@/components/public/use-family-members";
import {
  AccountPasswordSection,
  GuardianSection,
  MembershipConsents,
  SepaMandateSection,
} from "@/components/public/MembershipFormSections";
import {
  familyMembersPayload,
  isMinorDob,
  TIERS,
  validateMembership,
  type MembershipTier,
  type ValidMembership,
} from "@/components/public/membership-form";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { MEMBERSHIP_BILLING_NOTE } from "@/lib/billing-config";
import { todayBerlinIso } from "@/lib/format";
import { maxMembershipStart } from "@/lib/member-claim";
import { submitMembershipSignup } from "@/lib/membership-signup.functions";
import { useContactDefaults } from "@/hooks/use-contact-defaults";

export const Route = createFileRoute("/mitgliedschaft")({
  head: () => ({
    meta: [
      { title: "Mitglied werden – Schwimmverein Hennef | Sicher Schwimmen e.V." },
      {
        name: "description",
        content:
          "Mitglied im Schwimmverein Sicher Schwimmen e.V. in Hennef werden: Einzel- (60 €), Familien- (96 €) oder Fördermitgliedschaft. Bevorzugte Kursplätze und vergünstigte Kursgebühren.",
      },
      {
        name: "keywords",
        content:
          "Schwimmverein Mitglied Hennef, Vereinsmitgliedschaft Schwimmen, Familienmitgliedschaft Schwimmverein, Rhein-Sieg-Kreis",
      },
      { property: "og:title", content: "Mitglied werden – Sicher Schwimmen e.V." },
      {
        property: "og:description",
        content:
          "Werden Sie Teil unserer Schwimmgemeinschaft in Hennef – mit Vorteilen bei Kursplätzen und Kursgebühren.",
      },
      { property: "og:url", content: "https://sicher-schwimmen.com/mitgliedschaft" },
    ],
    links: [{ rel: "canonical", href: "https://sicher-schwimmen.com/mitgliedschaft" }],
  }),
  component: Page,
});

/** Benachrichtigung an den Vorstand (ohne Antwort abzuwarten) – keine Bankdaten per E-Mail. */
function notifyAdmin(v: ValidMembership, createdAt: string) {
  const idem =
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const d = v.data;
  fetch("/api/public/notify-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      templateName: "membership-application",
      idempotencyKey: `membership-${idem}`,
      templateData: {
        full_name: `${d.first_name} ${d.last_name}`,
        email: d.email,
        phone: d.phone,
        city: d.address_city,
        membership_type: d.membership_type,
        // Nur das Ergebnis der Pflichtfeld-Prüfung: alle Blöcke sind Pflicht
        // und wurden in validateMembership bereits geprüft.
        checks: {
          personal: true,
          address: true,
          sepa: true,
          consents: true,
          minor: v.isMinorMember,
          minor_ok: v.isMinorMember ? Boolean(v.minorConsents) : undefined,
        },
        created_at: createdAt,
      },
    }),
  }).catch(() => {});
}

function Page() {
  const family = useFamilyMembers();
  const [tier, setTier] = useState<MembershipTier>("family");
  const [dob, setDob] = useState("");
  const showMinor = tier === "children_youth" || isMinorDob(dob);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const ft = useFormTracking("mitgliedschaft");
  const [accountResult, setAccountResult] = useState<AccountResult>("none");
  const signupFn = useServerFn(submitMembershipSignup);
  const { defaults, ready } = useContactDefaults();
  const today = todayBerlinIso();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // Spamschutz (Honeypot)
    if (String(fd.get("website") || "").trim() !== "") {
      setDone(true);
      return;
    }
    const v = validateMembership(fd, tier, family.children);
    if (!v.ok) {
      ft.invalid(v.fields, v.code);
      toast.error(v.message);
      return;
    }
    ft.attempt();
    setLoading(true);
    const createdAt = new Date().toISOString();
    // start_date fehlt noch in den generierten Supabase-Typen, daher die Typzusicherung
    const { error } = await supabase.from("memberships").insert({
      ...v.data,
      date_of_birth: v.data.date_of_birth || null,
      family_members:
        tier === "family"
          ? familyMembersPayload(family.partner, family.children, v.data.last_name)
          : null,
      consent_at: createdAt,
      member_email: v.memberEmail,
      member_phone: v.memberPhone,
      minor_consents: v.minorConsents,
      payer_role: v.payerRole,
    } as TablesInsert<"memberships">);
    if (error) {
      setLoading(false);
      console.warn("[memberships.insert]", error.code, error.message);
      ft.failed("speichern_fehlgeschlagen");
      toast.error("Antrag konnte nicht gesendet werden.");
      return;
    }
    ft.succeeded();
    notifyAdmin(v, createdAt);

    // Konto automatisch anlegen (pending bis Admin-Freigabe)
    try {
      const result = await signupFn({
        data: {
          email: v.data.email,
          first_name: v.data.first_name,
          last_name: v.data.last_name,
          password: v.password || undefined,
        },
      });
      setAccountResult(result.status);
    } catch (err) {
      console.warn("[membership-signup]", err);
      setAccountResult("failed");
    }

    setLoading(false);
    setDone(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <PublicLayout>
      <MembershipSubmittedDialog
        open={done}
        accountResult={accountResult}
        onClose={() => {
          setDone(false);
          setAccountResult("none");
        }}
      />
      <section className="bg-hero text-white py-20">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <Heart className="h-12 w-12 mx-auto text-accent mb-4" />
          <h1 className="font-display text-5xl md:text-6xl font-bold mb-4">Mitglied werden</h1>
          <p className="text-white/85 text-lg">
            Werden Sie Teil unserer Schwimmgemeinschaft und unterstützen Sie sichere
            Schwimmausbildung in Hennef.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <MembershipBenefits />
        <TierCards tier={tier} onSelect={setTier} />
        <p className="text-center text-sm text-muted-foreground max-w-2xl mx-auto mb-12 -mt-6">
          {MEMBERSHIP_BILLING_NOTE}
        </p>

        {done ? (
          <Card className="max-w-2xl mx-auto shadow-card border-0 text-center">
            <CardContent className="p-10">
              <Check className="h-16 w-16 text-success mx-auto mb-4" />
              <h2 className="font-display text-3xl font-bold text-primary-deep mb-3">
                Antrag eingereicht
              </h2>
              <p className="text-muted-foreground">
                Vielen Dank! Die Mitgliedschaft wird erst nach Freigabe durch den Vorstand aktiv.
                Wir melden uns per E-Mail.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="max-w-3xl mx-auto shadow-card border-0">
            <CardContent className="p-8">
              <h2 className="font-display text-2xl font-bold text-primary-deep mb-2">
                Mitgliedsantrag
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Hinweis: Die Mitgliedschaft wird erst nach Genehmigung durch den Vereinsvorstand
                aktiv.
              </p>
              {/* key: nach dem Laden bekannter Kontaktdaten neu aufbauen, damit sie vorbelegt sind */}
              <form
                key={ready ? "prefilled" : "loading"}
                onSubmit={onSubmit}
                {...ft.formProps}
                className="space-y-6"
              >
                <div>
                  <Label>Mitgliedschaftsart</Label>
                  <Select value={tier} onValueChange={(t) => setTier(t as MembershipTier)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIERS.map((t) => (
                        <SelectItem key={t.type} value={t.type}>
                          {t.name} – {t.price}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <TextField
                    id="first_name"
                    name="first_name"
                    label="Vorname *"
                    required
                    maxLength={100}
                    defaultValue={defaults.firstName}
                  />
                  <TextField
                    id="last_name"
                    name="last_name"
                    label="Nachname *"
                    required
                    maxLength={100}
                    defaultValue={defaults.lastName}
                  />
                  <TextField
                    id="date_of_birth"
                    type="date"
                    name="date_of_birth"
                    label="Geburtsdatum *"
                    required
                    defaultValue={defaults.dateOfBirth}
                    onChange={(e) => setDob(e.target.value)}
                  />
                  <div>
                    <Label htmlFor="start_date">Mitglied ab *</Label>
                    <Input
                      id="start_date"
                      type="date"
                      name="start_date"
                      required
                      min={today}
                      max={maxMembershipStart(today)}
                      defaultValue={today}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Frühestens heute, höchstens 6 Monate im Voraus. Der Beitrag gilt ab diesem
                      Datum (Eintritt nach dem 1. Juli: halber Jahresbeitrag). Kurse, die ab diesem
                      Datum beginnen, erhalten den Mitgliedspreis, sofern die Mitgliedschaft
                      zustande kommt. Nach unserer Bestätigung ist sie verbindlich; Austritt ist nur
                      mit sechs Wochen Frist zum Jahresende möglich.
                    </p>
                  </div>
                  <TextField
                    id="email"
                    type="email"
                    name="email"
                    label="E-Mail *"
                    required
                    maxLength={255}
                    defaultValue={defaults.email}
                  />
                  <TextField
                    id="phone"
                    type="tel"
                    name="phone"
                    label="Telefon *"
                    required
                    minLength={5}
                    maxLength={40}
                    defaultValue={defaults.phone}
                  />
                  <TextField
                    id="address_street"
                    name="address_street"
                    label="Straße & Nr. *"
                    required
                    maxLength={200}
                    defaultValue={defaults.street}
                  />
                  <TextField
                    id="address_zip"
                    name="address_zip"
                    label="PLZ *"
                    required
                    maxLength={20}
                    defaultValue={defaults.zip}
                  />
                  <TextField
                    id="address_city"
                    name="address_city"
                    label="Ort *"
                    required
                    maxLength={100}
                    defaultValue={defaults.city}
                  />
                </div>

                <GuardianSection showMinor={showMinor} />
                {tier === "family" && <MembershipFamilySection family={family} />}
                <SepaMandateSection
                  showMinor={showMinor}
                  minorHint={showMinor || tier === "family"}
                />
                <MembershipConsents />
                <AccountPasswordSection />
                <HoneypotField />

                <SubmitButton
                  loading={loading}
                  loadingText="Antrag wird gesendet…"
                  className="w-full"
                >
                  Mitgliedsantrag absenden
                </SubmitButton>
              </form>
            </CardContent>
          </Card>
        )}
      </section>
    </PublicLayout>
  );
}
