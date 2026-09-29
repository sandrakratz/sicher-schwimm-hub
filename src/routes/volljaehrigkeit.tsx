import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { getMajorityConfirmation, submitMajorityConfirmation } from "@/lib/majority.functions";

export const Route = createFileRoute("/volljaehrigkeit")({
  validateSearch: (s) => z.object({ token: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Datenbestätigung zur Volljährigkeit – Sicher Schwimmen e.V." },
      { name: "description", content: "Bestätige Deine Daten, damit Deine Mitgliedschaft ab 18 nahtlos weiterläuft." },
      { property: "og:title", content: "Datenbestätigung zur Volljährigkeit" },
      { property: "og:description", content: "Mitgliedschaft ab Volljährigkeit bei Sicher Schwimmen e.V. bestätigen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

type Info = Awaited<ReturnType<typeof getMajorityConfirmation>>;

function Page() {
  const { token } = Route.useSearch();
  const load = useServerFn(getMajorityConfirmation);
  const submit = useServerFn(submitMajorityConfirmation);
  const [info, setInfo] = useState<Info | null>(null);
  const [payment, setPayment] = useState<"keep" | "own_sepa" | "transfer">("keep");
  const [terminate, setTerminate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { account: boolean; terminate: boolean }>(null);

  useEffect(() => {
    if (!token || !/^[a-f0-9]{48}$/.test(token)) { setInfo({ found: false }); return; }
    load({ data: { token } }).then(setInfo).catch(() => setInfo({ found: false }));
  }, [token]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const r = await submit({ data: {
        token: token!,
        email: String(fd.get("email") || ""),
        phone: String(fd.get("phone") || ""),
        address_street: String(fd.get("address_street") || ""),
        address_zip: String(fd.get("address_zip") || ""),
        address_city: String(fd.get("address_city") || ""),
        payment,
        sepa_account_holder: String(fd.get("sepa_account_holder") || "") || undefined,
        sepa_iban: String(fd.get("sepa_iban") || "") || undefined,
        sepa_mandate: fd.get("sepa_mandate") === "on",
        wants_termination: terminate,
        termination_note: String(fd.get("termination_note") || "") || undefined,
      } });
      setDone({ account: r.account, terminate });
    } catch (err: any) {
      toast.error(err?.message?.includes("[") ? "Bitte die Angaben prüfen (z. B. PLZ, Telefon, E-Mail)." : err?.message || "Speichern fehlgeschlagen.");
    } finally { setBusy(false); }
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold text-primary-deep mb-2">Datenbestätigung zur Volljährigkeit</h1>
      {!info && <p className="text-muted-foreground">Wird geladen …</p>}
      {info && !info.found && (
        <Card><CardContent className="p-6">Dieser Link ist ungültig. Bitte melde Dich unter info@sicher-schwimmen.com.</CardContent></Card>
      )}
      {info?.found && (done || info.done) && (
        <Card><CardContent className="p-6 space-y-3">
          <p className="font-semibold">Vielen Dank – Deine Angaben sind bei uns angekommen.</p>
          {done?.terminate ? (
            <p>Wir haben Deinen Kündigungswunsch erhalten und melden uns zur Bestätigung nach unserer Satzung bei Dir.</p>
          ) : (done?.account ?? true) ? (
            <p>Deine Mitgliedschaft läuft ab Deinem 18. Geburtstag einfach weiter. Du erhältst gleich eine E-Mail, mit der Du ein Passwort für Deinen eigenen Mitgliederzugang festlegst. Danach kannst Du Dich <Link to="/auth" className="underline">hier anmelden</Link>.</p>
          ) : (
            <p>Deine Mitgliedschaft läuft weiter. Den Mitgliederzugang richten wir in Kürze für Dich ein.</p>
          )}
        </CardContent></Card>
      )}
      {info?.found && !info.done && !done && (
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="rounded-lg border-2 border-accent/40 bg-accent/5 p-4 text-sm space-y-2">
            <p>Hallo {info.first_name}, schön, dass Du dabei bist! Deine Mitgliedschaft endet mit dem 18. Geburtstag <strong>nicht</strong> – Du musst keinen neuen Antrag stellen. Bitte prüfe nur kurz Deine Daten.</p>
            {info.is_family && <p>Ab dem 18. Geburtstag fällst Du aus der Familienbeitragsregelung heraus; es gilt dann der Beitrag für erwachsene Mitglieder.</p>}
            <p>Nach dem Absenden bekommst Du automatisch einen eigenen Zugang zum Mitgliederbereich.</p>
          </div>

          <Card><CardContent className="p-6 grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2 text-sm text-muted-foreground">Mitglied: <strong className="text-foreground">{info.first_name} {info.last_name}</strong>{info.date_of_birth ? `, geb. ${new Date(info.date_of_birth).toLocaleDateString("de-DE")}` : ""}</div>
            <div className="md:col-span-2"><Label htmlFor="email">Deine E-Mail-Adresse *</Label><Input id="email" name="email" type="email" required defaultValue={info.email} maxLength={255} /><p className="text-xs text-muted-foreground mt-1">Diese Adresse wird Dein Login.</p></div>
            <div className="md:col-span-2"><Label htmlFor="phone">Deine Telefonnummer *</Label><Input id="phone" name="phone" type="tel" required defaultValue={info.phone} maxLength={40} /></div>
            <div className="md:col-span-2"><Label htmlFor="address_street">Straße & Hausnummer *</Label><Input id="address_street" name="address_street" required defaultValue={info.address_street} maxLength={200} /></div>
            <div><Label htmlFor="address_zip">PLZ *</Label><Input id="address_zip" name="address_zip" required pattern="\d{5}" defaultValue={info.address_zip} /></div>
            <div><Label htmlFor="address_city">Ort *</Label><Input id="address_city" name="address_city" required defaultValue={info.address_city} maxLength={100} /></div>
          </CardContent></Card>

          <label className="flex gap-3 items-start text-sm cursor-pointer">
            <Checkbox checked={terminate} onCheckedChange={v => setTerminate(!!v)} />
            <span>Ich möchte die Mitgliedschaft <strong>nicht</strong> fortführen und nach Maßgabe der Satzung kündigen.</span>
          </label>

          {terminate ? (
            <Card><CardContent className="p-6"><Label htmlFor="termination_note">Anmerkung (optional)</Label><Textarea id="termination_note" name="termination_note" maxLength={1000} /></CardContent></Card>
          ) : (
            <Card><CardContent className="p-6 space-y-3">
              <p className="font-semibold text-primary-deep">Zahlungsart ab Volljährigkeit *</p>
              {[
                ["keep", `Wie bisher weiter${info.current_account_holder ? ` (Konto von ${info.current_account_holder}${info.current_iban_hint ? `, ${info.current_iban_hint}` : ""})` : ""}`],
                ["own_sepa", "Ab jetzt von meinem eigenen Konto (neues SEPA-Lastschriftmandat)"],
                ["transfer", "Ich überweise den Beitrag selbst"],
              ].map(([v, l]) => (
                <label key={v} className="flex gap-2 items-start text-sm cursor-pointer">
                  <input type="radio" name="payment_opt" checked={payment === v} onChange={() => setPayment(v as any)} className="mt-1" /> {l}
                </label>
              ))}
              {payment === "own_sepa" && (
                <div className="grid gap-3 pt-2">
                  <div><Label htmlFor="sepa_account_holder">Kontoinhaber/in *</Label><Input id="sepa_account_holder" name="sepa_account_holder" required maxLength={200} defaultValue={`${info.first_name} ${info.last_name}`} /></div>
                  <div><Label htmlFor="sepa_iban">IBAN *</Label><Input id="sepa_iban" name="sepa_iban" required maxLength={40} /></div>
                  <label className="flex gap-3 items-start text-sm cursor-pointer"><Checkbox name="sepa_mandate" required /><span>Ich ermächtige Sicher Schwimmen e.V., den Mitgliedsbeitrag von meinem Konto mittels Lastschrift einzuziehen. *</span></label>
                </div>
              )}
            </CardContent></Card>
          )}

          <Button type="submit" size="lg" disabled={busy} className="w-full">{busy ? "Wird gesendet …" : terminate ? "Kündigungswunsch senden" : "Daten bestätigen"}</Button>
        </form>
      )}
    </div>
  );
}
