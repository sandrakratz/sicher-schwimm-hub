import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { HoneypotField, SubmitButton } from "@/components/form-support";
import { toast } from "sonner";
import { CheckCircle2, ListOrdered } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { joinWaitlist } from "@/lib/waitlist.functions";

export const Route = createFileRoute("/warteliste")({
  validateSearch: (search: Record<string, unknown>) => ({
    programm: typeof search['programm'] === "string" ? (search['programm'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Warteliste Schwimmkurs Hennef | Sicher Schwimmen e.V." },
      {
        name: "description",
        content:
          "Tragen Sie Ihr Kind unverbindlich auf die Warteliste für unsere Schwimmkurse in Hennef und im Rhein-Sieg-Kreis ein – wir melden uns automatisch, sobald ein Platz frei wird.",
      },
      { property: "og:title", content: "Warteliste für Schwimmkurse – Sicher Schwimmen e.V." },
      {
        property: "og:description",
        content: "Automatische Platzvergabe: Sobald ein Kursplatz frei wird, erhalten Sie ein Angebot per E-Mail.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://sicher-schwimmen.com/warteliste" },
    ],
    links: [{ rel: "canonical", href: "https://sicher-schwimmen.com/warteliste" }],
  }),
  component: WaitlistPage,
});

function WaitlistPage() {
  const search = useSearch({ from: "/warteliste" });
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: programs } = useQuery({
    queryKey: ["public-programs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_programs")
        .select("id,name,slug")
        .eq("is_public", true)
        .order("sort_order");
      return data ?? [];
    },
  });

  const preselected = programs?.find((p) => p.slug === search.programm)?.id;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (String(fd.get("website") || "").trim() !== "") {
      setDone(true);
      return;
    }
    if (fd.get("gdpr_consent") !== "on") {
      toast.error("Bitte bestätigen Sie die Datenschutzhinweise.");
      return;
    }
    setLoading(true);
    try {
      const res = await joinWaitlist({
        data: {
          programId: (String(fd.get("program_id") || "") || null) as string | null,
          parentName: String(fd.get("parent_name") || ""),
          parentEmail: String(fd.get("parent_email") || ""),
          parentPhone: String(fd.get("parent_phone") || ""),
          childName: String(fd.get("child_name") || ""),
          childDob: String(fd.get("child_dob") || ""),
          notes: String(fd.get("notes") || ""),
          gdprConsent: true,
        },
      });
      if (!res.ok) {
        toast.error("Eintrag nicht möglich. Bitte wenden Sie sich an info@sicher-schwimmen.com.");
        return;
      }
      setDone(true);
    } catch (err) {
      console.error(err);
      toast.error("Eintrag konnte nicht gespeichert werden. Bitte später erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <PublicLayout>
        <section className="container mx-auto max-w-xl px-4 py-24 text-center">
          <CheckCircle2 className="mx-auto mb-6 h-16 w-16 text-success" />
          <h1 className="mb-4 font-display text-4xl font-bold text-primary-deep">Sie stehen auf der Warteliste</h1>
          <p className="text-lg text-muted-foreground">
            Wir haben Ihnen eine Bestätigung per E-Mail geschickt. Sobald ein Platz frei wird, erhalten Sie automatisch
            ein Platzangebot mit Zusage-Link.
          </p>
          <p className="mt-6 text-sm text-muted-foreground">
            <Link to="/kurse" className="underline">
              Zurück zur Kursübersicht
            </Link>
          </p>
        </section>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <section className="container mx-auto max-w-3xl px-4 py-12 md:py-16">
        <div className="mb-8 text-center">
          <ListOrdered className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h1 className="font-display text-3xl font-bold text-primary-deep md:text-4xl">Warteliste</h1>
          <p className="mt-3 text-muted-foreground">
            Tragen Sie Ihr Kind unverbindlich ein. Sobald in einem passenden Kurs ein Platz frei wird, erhalten Sie
            automatisch ein Platzangebot per E-Mail. Aktive Vereinsmitglieder werden bevorzugt berücksichtigt, danach
            gilt die Reihenfolge des Eingangs.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={onSubmit} className="space-y-5">
              <HoneypotField />

              <div className="space-y-2">
                <Label htmlFor="program_id">Gewünschtes Angebot</Label>
                <select
                  id="program_id"
                  name="program_id"
                  defaultValue={preselected ?? ""}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Keine Angabe / egal</option>
                  {(programs ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="child_name">Name des Kindes *</Label>
                  <Input id="child_name" name="child_name" required maxLength={120} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="child_dob">Geburtsdatum</Label>
                  <Input id="child_dob" name="child_dob" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parent_name">Name Elternteil *</Label>
                  <Input id="parent_name" name="parent_name" required maxLength={120} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parent_email">E-Mail *</Label>
                  <Input id="parent_email" name="parent_email" type="email" required maxLength={200} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="parent_phone">Telefon</Label>
                  <Input id="parent_phone" name="parent_phone" maxLength={60} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Anmerkungen (z. B. Schwimmerfahrung, Wunschzeiten)</Label>
                <Textarea id="notes" name="notes" rows={4} maxLength={2000} />
              </div>

              <div className="flex items-start gap-3">
                <Checkbox id="gdpr_consent" name="gdpr_consent" />
                <Label htmlFor="gdpr_consent" className="text-sm font-normal leading-relaxed">
                  Ich habe die{" "}
                  <Link to="/datenschutz" className="underline">
                    Datenschutzhinweise
                  </Link>{" "}
                  gelesen und bin mit der Speicherung meiner Daten zur Bearbeitung der Warteliste einverstanden. *
                </Label>
              </div>

              <SubmitButton loading={loading}>Auf die Warteliste setzen</SubmitButton>
            </form>
          </CardContent>
        </Card>
      </section>
    </PublicLayout>
  );
}
