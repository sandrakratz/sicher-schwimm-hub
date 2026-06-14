import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Check, Users, Heart, User, HandHeart, Waves, Euro, Star, Vote } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useServerFn } from "@tanstack/react-start";
import { submitMembershipSignup } from "@/lib/membership-signup.functions";

export const Route = createFileRoute("/mitgliedschaft")({
  head: () => ({
    meta: [
      { title: "Mitglied werden – Schwimmverein Hennef | Sicher Schwimmen e.V." },
      { name: "description", content: "Mitglied im Schwimmverein Sicher Schwimmen e.V. in Hennef werden: Einzel- (60 €), Familien- (96 €) oder Fördermitgliedschaft. Bevorzugte Kursplätze und vergünstigte Kursgebühren." },
      { name: "keywords", content: "Schwimmverein Mitglied Hennef, Vereinsmitgliedschaft Schwimmen, Familienmitgliedschaft Schwimmverein, Rhein-Sieg-Kreis" },
      { property: "og:title", content: "Mitglied werden – Sicher Schwimmen e.V." },
      { property: "og:description", content: "Werden Sie Teil unserer Schwimmgemeinschaft in Hennef – mit Vorteilen bei Kursplätzen und Kursgebühren." },
      { property: "og:url", content: "https://sicher-schwimmen.com/mitgliedschaft" },
    ],
    links: [{ rel: "canonical", href: "https://sicher-schwimmen.com/mitgliedschaft" }],
  }),
  component: Page,
});

const tiers = [
  { type: "children_youth", icon: User, name: "Kinder & Jugend", price: "60 €/Jahr", desc: "Einzelmitgliedschaft für alle unter 18." },
  { type: "adult", icon: User, name: "Erwachsene", price: "60 €/Jahr", desc: "Einzelmitgliedschaft ab 18 Jahren." },
  { type: "family", icon: Users, name: "Familie", price: "96 €/Jahr", desc: "Ab 3 Personen, max. 2 Erwachsene + Kinder unter 18 im selben Haushalt." },
  { type: "supporting", icon: HandHeart, name: "Förderung", price: "ab 60 €/Jahr", desc: "Passive Mitgliedschaft ohne Stimmrecht, Beitrag nach oben frei wählbar." },
];

const billingNote = "Beitrag fällig jeweils zum 1. März per SEPA-Lastschrift. Bei Eintritt nach dem 1. Juli wird im Beitrittsjahr nur der halbe Jahresbeitrag (50 %) berechnet.";


const schema = z.object({
  membership_type: z.enum(["children_youth","adult","family","supporting"]),
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  date_of_birth: z.string().optional(),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional(),
  address_street: z.string().trim().max(200).optional(),
  address_zip: z.string().trim().max(20).optional(),
  address_city: z.string().trim().max(100).optional(),
  guardian_name: z.string().trim().max(200).optional(),
  guardian_email: z.string().trim().max(255).optional(),
  guardian_phone: z.string().trim().max(40).optional(),
  sepa_account_holder: z.string().trim().min(1, "Kontoinhaber erforderlich").max(200),
  sepa_iban: z.string().trim().min(15, "IBAN ungültig").max(42).regex(/^[A-Z]{2}[0-9A-Z ]+$/i, "IBAN ungültig"),
  sepa_bic: z.string().trim().max(11).optional(),
  sepa_bank_name: z.string().trim().min(1, "Bank erforderlich").max(200),
  sepa_signature_place: z.string().trim().min(1, "Ort erforderlich").max(120),
  sepa_signature_date: z.string().min(1, "Datum erforderlich"),
  sepa_mandate_accepted: z.boolean().refine(v => v, "SEPA-Mandat erforderlich"),
  accepted_statutes: z.boolean().refine(v => v),
  accepted_rules: z.boolean().refine(v => v),
  accepted_privacy: z.boolean().refine(v => v),
});

type FamilyMember = { name: string; date_of_birth: string };

function Page() {
  const [partner, setPartner] = useState<FamilyMember>({ name: "", date_of_birth: "" });
  const [children, setChildren] = useState<FamilyMember[]>([
    { name: "", date_of_birth: "" },
    { name: "", date_of_birth: "" },
    { name: "", date_of_birth: "" },
    { name: "", date_of_birth: "" },
  ]);
  const updateChild = (i: number, patch: Partial<FamilyMember>) =>
    setChildren(prev => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c));

  const [tier, setTier] = useState("family");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [accountResult, setAccountResult] = useState<"none" | "created" | "created_no_password" | "exists" | "failed">("none");
  const signupFn = useServerFn(submitMembershipSignup);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const rawPassword = String(fd.get("account_password") || "").trim();
    const rawPasswordConfirm = String(fd.get("account_password_confirm") || "").trim();

    if (rawPassword || rawPasswordConfirm) {
      if (rawPassword.length < 8) { toast.error("Passwort muss mindestens 8 Zeichen lang sein."); return; }
      if (rawPassword !== rawPasswordConfirm) { toast.error("Passwörter stimmen nicht überein."); return; }
    }

    const obj: Record<string, unknown> = {
      membership_type: tier,
      first_name: fd.get("first_name"),
      last_name: fd.get("last_name"),
      date_of_birth: fd.get("date_of_birth") || undefined,
      email: fd.get("email"),
      phone: fd.get("phone"),
      address_street: fd.get("address_street"),
      address_zip: fd.get("address_zip"),
      address_city: fd.get("address_city"),
      guardian_name: fd.get("guardian_name"),
      guardian_email: fd.get("guardian_email"),
      guardian_phone: fd.get("guardian_phone"),
      sepa_account_holder: fd.get("sepa_account_holder"),
      sepa_iban: (fd.get("sepa_iban") as string | null)?.replace(/\s+/g, "").toUpperCase(),
      sepa_bic: (fd.get("sepa_bic") as string | null)?.toUpperCase() || undefined,
      sepa_bank_name: fd.get("sepa_bank_name"),
      sepa_signature_place: fd.get("sepa_signature_place"),
      sepa_signature_date: fd.get("sepa_signature_date"),
      sepa_mandate_accepted: fd.get("sepa_mandate_accepted") === "on",
      accepted_statutes: fd.get("accepted_statutes") === "on",
      accepted_rules: fd.get("accepted_rules") === "on",
      accepted_privacy: fd.get("accepted_privacy") === "on",
    };
    const parsed = schema.safeParse(obj);
    if (!parsed.success) {
      toast.error("Bitte alle Pflichtfelder & Zustimmungen ausfüllen.");
      return;
    }
    setLoading(true);
    const family_members = tier === "family" ? {
      partner: partner.name.trim() ? { name: partner.name.trim(), date_of_birth: partner.date_of_birth || null } : null,
      children: children
        .filter(c => c.name.trim())
        .map(c => ({ name: c.name.trim(), date_of_birth: c.date_of_birth || null })),
    } : null;
    const idem = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
    const createdAt = new Date().toISOString();
    const { error } = await supabase.from("memberships").insert({
      ...parsed.data,
      date_of_birth: parsed.data.date_of_birth || null,
      family_members,
      consent_at: createdAt,
    });
    if (error) {
      setLoading(false);
      console.warn("[memberships.insert]", error.code, error.message);
      toast.error("Antrag konnte nicht gesendet werden.");
      return;
    }
    // Fire-and-forget admin notification email
    fetch("/api/public/notify-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateName: "membership-application",
        idempotencyKey: `membership-${idem}`,
        templateData: {
          full_name: `${parsed.data.first_name} ${parsed.data.last_name}`,
          email: parsed.data.email,
          phone: parsed.data.phone,
          city: parsed.data.address_city,
          membership_type: parsed.data.membership_type,
          iban: parsed.data.sepa_iban,
          created_at: createdAt,
        },
      }),
    }).catch(() => {});

    // Konto automatisch anlegen (pending bis Admin-Freigabe)
    try {
      const result = await signupFn({
        data: {
          email: parsed.data.email,
          first_name: parsed.data.first_name,
          last_name: parsed.data.last_name,
          password: rawPassword || undefined,
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
      <AlertDialog open={done}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Mitgliedsantrag eingegangen</AlertDialogTitle>
            <AlertDialogDescription>
              Ihr Mitgliedsantrag ist eingegangen. Er wird vom Vereinsvorstand geprüft. Sie erhalten eine Rückmeldung per E-Mail.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {submitted && signupResult === "idle" && (
            <div className="mt-2 rounded-md border bg-muted/30 p-4 space-y-3">
              <div>
                <h4 className="font-semibold text-primary-deep">Konto anlegen (empfohlen)</h4>
                <p className="text-xs text-muted-foreground">
                  Legen Sie direkt Ihr Konto an, um nach der Freischaltung Zugang zum Mitgliederbereich zu erhalten.
                </p>
              </div>
              <div>
                <Label htmlFor="acct_email">E-Mail</Label>
                <Input id="acct_email" type="email" value={submitted.email} readOnly className="bg-muted" />
              </div>
              <div>
                <Label htmlFor="acct_pw">Passwort (mind. 8 Zeichen)</Label>
                <Input id="acct_pw" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} autoComplete="new-password" />
              </div>
              <div>
                <Label htmlFor="acct_pw2">Passwort wiederholen</Label>
                <Input id="acct_pw2" type="password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} minLength={8} autoComplete="new-password" />
              </div>
              <Button onClick={onCreateAccount} disabled={signupLoading} variant="accent" className="w-full">
                {signupLoading ? "Wird angelegt…" : "Konto erstellen"}
              </Button>
            </div>
          )}

          {signupResult === "ok" && (
            <div className="mt-2 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-900">
              Konto wurde angelegt. Bitte bestätigen Sie Ihre E-Mail-Adresse über den Link, den wir Ihnen gerade gesendet haben. Die Freischaltung erfolgt anschließend durch einen Administrator.
            </div>
          )}

          {signupResult === "exists" && (
            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-2">
              <p>Für diese E-Mail existiert bereits ein Konto.</p>
              <Button asChild variant="outline" size="sm"><a href="/auth">Zum Login</a></Button>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogAction onClick={() => { setDone(false); setSignupResult("idle"); }}>Schließen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <section className="bg-hero text-white py-20">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <Heart className="h-12 w-12 mx-auto text-accent mb-4" />
          <h1 className="font-display text-5xl md:text-6xl font-bold mb-4">Mitglied werden</h1>
          <p className="text-white/85 text-lg">
            Werden Sie Teil unserer Schwimmgemeinschaft und unterstützen Sie
            sichere Schwimmausbildung in Hennef.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-deep text-center mb-3">Warum sich eine Mitgliedschaft lohnt</h2>
          <p className="text-center text-muted-foreground mb-10 max-w-2xl mx-auto">Als Mitglied profitieren Sie nicht nur von vergünstigten Kursen, sondern unterstützen aktiv sichere Schwimmausbildung in Hennef.</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Waves, title: "Kostenlose Wasserzeit", desc: "Einmal im Monat exklusive Wasserzeit für Mitglieder – Termine werden vom Verein bekannt gegeben." },
              { icon: Euro, title: "Vergünstigte Kurse", desc: "Mitglieder zahlen für Schwimmkurse 150 € statt 200 € (10 Einheiten à 45 Min.)." },
              { icon: Star, title: "Bevorzugte Plätze", desc: "Bei der Kursvergabe werden Vereinsmitglieder bevorzugt berücksichtigt." },
              { icon: Vote, title: "Mitbestimmung", desc: "Stimmrecht in der Mitgliederversammlung und aktive Mitgestaltung des Vereins." },
            ].map((b) => (
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

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          {tiers.map((t) => (
            <Card key={t.type}
              onClick={() => setTier(t.type)}
              className={`cursor-pointer transition-all border-2 ${tier === t.type ? "border-accent shadow-glow -translate-y-1" : "border-transparent shadow-soft hover:-translate-y-1"}`}>
              <CardContent className="p-6 text-center">
                <t.icon className="h-10 w-10 text-primary mx-auto mb-3" />
                <h3 className="font-display font-bold text-lg text-primary-deep">{t.name}</h3>
                <div className="text-2xl font-bold text-accent my-2">{t.price}</div>
                <p className="text-sm text-muted-foreground">{t.desc}</p>
                {tier === t.type && (
                  <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent"><Check className="h-3.5 w-3.5" /> Ausgewählt</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground max-w-2xl mx-auto mb-12 -mt-6">{billingNote}</p>



        {done ? (
          <Card className="max-w-2xl mx-auto shadow-card border-0 text-center">
            <CardContent className="p-10">
              <Check className="h-16 w-16 text-success mx-auto mb-4" />
              <h2 className="font-display text-3xl font-bold text-primary-deep mb-3">Antrag eingereicht</h2>
              <p className="text-muted-foreground">
                Vielen Dank! Die Mitgliedschaft wird erst nach Freigabe durch den Vorstand aktiv. Wir melden uns per E-Mail.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="max-w-3xl mx-auto shadow-card border-0">
            <CardContent className="p-8">
              <h2 className="font-display text-2xl font-bold text-primary-deep mb-2">Mitgliedsantrag</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Hinweis: Die Mitgliedschaft wird erst nach Genehmigung durch den Vereinsvorstand aktiv.
              </p>
              <form onSubmit={onSubmit} className="space-y-6">
                <div>
                  <Label>Mitgliedschaftsart</Label>
                  <Select value={tier} onValueChange={setTier}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tiers.map(t => <SelectItem key={t.type} value={t.type}>{t.name} – {t.price}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div><Label htmlFor="first_name">Vorname *</Label><Input id="first_name" name="first_name" required maxLength={100} /></div>
                  <div><Label htmlFor="last_name">Nachname *</Label><Input id="last_name" name="last_name" required maxLength={100} /></div>
                  <div><Label htmlFor="date_of_birth">Geburtsdatum</Label><Input id="date_of_birth" type="date" name="date_of_birth" /></div>
                  <div><Label htmlFor="email">E-Mail *</Label><Input id="email" type="email" name="email" required maxLength={255} /></div>
                  <div><Label htmlFor="phone">Telefon</Label><Input id="phone" name="phone" maxLength={40} /></div>
                  <div><Label htmlFor="address_street">Straße & Nr.</Label><Input id="address_street" name="address_street" maxLength={200} /></div>
                  <div><Label htmlFor="address_zip">PLZ</Label><Input id="address_zip" name="address_zip" maxLength={20} /></div>
                  <div><Label htmlFor="address_city">Ort</Label><Input id="address_city" name="address_city" maxLength={100} /></div>
                </div>
                <div className="border-t pt-5">
                  <h3 className="font-semibold text-primary-deep mb-3">Erziehungsberechtigte/r (bei Minderjährigen)</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div><Label htmlFor="guardian_name">Name</Label><Input id="guardian_name" name="guardian_name" maxLength={200} /></div>
                    <div><Label htmlFor="guardian_email">E-Mail</Label><Input id="guardian_email" type="email" name="guardian_email" maxLength={255} /></div>
                    <div><Label htmlFor="guardian_phone">Telefon</Label><Input id="guardian_phone" name="guardian_phone" maxLength={40} /></div>
                  </div>
                </div>

                {tier === "family" && (
                  <div className="border-t pt-5">
                    <h3 className="font-semibold text-primary-deep mb-1">Familienangaben</h3>
                    <p className="text-xs text-muted-foreground mb-4">Bitte tragen Sie Partner/in und Kinder (bis zu 4) ein. Nicht ausgefüllte Felder werden ignoriert.</p>
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium mb-2">Partner/in</h4>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div><Label>Name</Label><Input value={partner.name} onChange={e => setPartner(p => ({ ...p, name: e.target.value }))} maxLength={200} /></div>
                          <div><Label>Geburtsdatum</Label><Input type="date" value={partner.date_of_birth} onChange={e => setPartner(p => ({ ...p, date_of_birth: e.target.value }))} /></div>
                        </div>
                      </div>
                      {children.map((c, i) => (
                        <div key={i}>
                          <h4 className="text-sm font-medium mb-2">Kind {i + 1}</h4>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div><Label>Name</Label><Input value={c.name} onChange={e => updateChild(i, { name: e.target.value })} maxLength={200} /></div>
                            <div><Label>Geburtsdatum</Label><Input type="date" value={c.date_of_birth} onChange={e => updateChild(i, { date_of_birth: e.target.value })} /></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}


                <div className="border-t pt-5">
                  <h3 className="font-semibold text-primary-deep mb-1">SEPA-Lastschriftmandat</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Gläubiger-Identifikationsnummer: <em>wird vom Verein eingetragen</em> · Mandatsreferenz: <em>Mitgliedsnummer (wird vergeben)</em>
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Ich ermächtige den Verein Sicher Schwimmen e.V., Zahlungen von meinem Konto mittels
                    Lastschrift einzuziehen. Zugleich weise ich mein Kreditinstitut an, die auf mein Konto
                    gezogenen Lastschriften einzulösen.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="md:col-span-2"><Label htmlFor="sepa_account_holder">Kontoinhaber/in *</Label><Input id="sepa_account_holder" name="sepa_account_holder" required maxLength={200} /></div>
                    <div className="md:col-span-2"><Label htmlFor="sepa_iban">IBAN *</Label><Input id="sepa_iban" name="sepa_iban" required maxLength={42} placeholder="DE00 0000 0000 0000 0000 00" /></div>
                    <div><Label htmlFor="sepa_bic">BIC</Label><Input id="sepa_bic" name="sepa_bic" maxLength={11} /></div>
                    <div><Label htmlFor="sepa_bank_name">Kreditinstitut *</Label><Input id="sepa_bank_name" name="sepa_bank_name" required maxLength={200} /></div>
                    <div><Label htmlFor="sepa_signature_place">Ort *</Label><Input id="sepa_signature_place" name="sepa_signature_place" required maxLength={120} /></div>
                    <div><Label htmlFor="sepa_signature_date">Datum *</Label><Input id="sepa_signature_date" type="date" name="sepa_signature_date" required defaultValue={new Date().toISOString().slice(0,10)} /></div>
                  </div>
                  <label className="flex gap-3 items-start text-sm cursor-pointer mt-4">
                    <Checkbox name="sepa_mandate_accepted" required />
                    <span>Ich erteile das SEPA-Lastschriftmandat. Bei Minderjährigen erfolgt die Unterschrift durch die gesetzlichen Vertreter. *</span>
                  </label>
                </div>

                <div className="space-y-3 border-t pt-5">
                  <label className="flex gap-3 items-start text-sm cursor-pointer">
                    <Checkbox name="accepted_statutes" required /> <span>Ich akzeptiere die <a href="/satzung" className="text-primary underline">Vereinssatzung</a>. *</span>
                  </label>
                  <label className="flex gap-3 items-start text-sm cursor-pointer">
                    <Checkbox name="accepted_rules" required /> <span>Ich akzeptiere die <a href="/mitgliedsordnung" className="text-primary underline">Mitgliedsordnung</a>. *</span>
                  </label>
                  <label className="flex gap-3 items-start text-sm cursor-pointer">
                    <Checkbox name="accepted_privacy" required /> <span>Ich akzeptiere die <a href="/datenschutz" className="text-primary underline">Datenschutzerklärung</a>. *</span>
                  </label>
                </div>
                <Button type="submit" variant="accent" size="lg" className="w-full" disabled={loading}>
                  {loading ? "Wird gesendet..." : "Mitgliedsantrag absenden"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </section>
    </PublicLayout>
  );
}
