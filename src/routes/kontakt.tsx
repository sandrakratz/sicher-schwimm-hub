import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Phone, MapPin } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/kontakt")({
  head: () => ({
    meta: [
      { title: "Kontakt – Sicher Schwimmen e.V. Hennef" },
      { name: "description", content: "Kontakt zum Schwimmverein Sicher Schwimmen e.V. in Hennef (Rhein-Sieg-Kreis). E-Mail info@sicher-schwimmen.com, Telefon 0178 / 1142945." },
      { property: "og:title", content: "Kontakt – Sicher Schwimmen e.V." },
      { property: "og:description", content: "Sprechen Sie uns an – wir helfen bei Fragen zu Schwimmkursen, Mitgliedschaft und Vereinsaktivitäten in Hennef." },
      { property: "og:url", content: "https://sicher-schwimmen.com/kontakt" },
    ],
    links: [{ rel: "canonical", href: "https://sicher-schwimmen.com/kontakt" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: "Sicher Schwimmen e.V.",
        url: "https://sicher-schwimmen.com",
        email: "info@sicher-schwimmen.com",
        telephone: "+49-178-1142945",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Hennef (Sieg)",
          addressRegion: "Nordrhein-Westfalen",
          addressCountry: "DE",
        },
        areaServed: [
          { "@type": "City", name: "Hennef" },
          { "@type": "AdministrativeArea", name: "Rhein-Sieg-Kreis" },
        ],
      }),
    }],
  }),
  component: Page,
});

const schema = z.object({
  from_name: z.string().trim().min(2).max(100),
  from_email: z.string().trim().email().max(255),
  category: z.string().min(1),
  subject: z.string().trim().max(200).optional(),
  body: z.string().trim().min(5).max(4000),
});

function Page() {
  const [category, setCategory] = useState("other");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      from_name: fd.get("from_name"),
      from_email: fd.get("from_email"),
      category,
      subject: fd.get("subject"),
      body: fd.get("body"),
    });
    if (!parsed.success) { toast.error("Bitte Eingaben prüfen"); return; }
    setLoading(true);
    const { data: inserted, error } = await supabase.from("messages").insert(parsed.data).select("id, created_at").maybeSingle();
    setLoading(false);
    if (error) { toast.error("Nachricht konnte nicht gesendet werden"); return; }
    fetch("/api/public/notify-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateName: "contact-message",
        idempotencyKey: inserted?.id ? `contact-message-${inserted.id}` : undefined,
        templateData: { ...parsed.data, created_at: inserted?.created_at || new Date().toISOString() },
      }),
    }).catch(() => {});
    setDone(true);
  }

  return (
    <PublicLayout>
      <AlertDialog open={done}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nachricht eingegangen</AlertDialogTitle>
            <AlertDialogDescription>
              Vielen Dank! Ihre Nachricht ist bei uns eingegangen und wird von unserem Team bearbeitet. Wir melden uns so schnell wie möglich.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDone(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <section className="bg-hero text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="font-display text-5xl font-bold mb-3">Kontakt</h1>
          <p className="text-white/85 text-lg">Wir freuen uns auf Ihre Nachricht.</p>
        </div>
      </section>
      <section className="container mx-auto px-4 py-16 grid lg:grid-cols-3 gap-8">
        <div className="space-y-4">
          {[
            { icon: MapPin, title: "Adresse", text: "Hennef, Rhein-Sieg-Kreis" },
            { icon: Mail, title: "E-Mail", text: "info@sicher-schwimmen.com" },
            { icon: Phone, title: "Telefon", text: "0178 / 1142945 (Michael Kratz)" },
          ].map(i => (
            <Card key={i.title} className="border-0 shadow-soft">
              <CardContent className="p-5 flex gap-4 items-start">
                <div className="h-11 w-11 rounded-xl bg-secondary text-primary flex items-center justify-center shrink-0"><i.icon className="h-5 w-5" /></div>
                <div>
                  <div className="font-semibold text-primary-deep">{i.title}</div>
                  <div className="text-muted-foreground text-sm">{i.text}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="lg:col-span-2">
          {done ? (
            <Card className="border-0 shadow-card text-center">
              <CardContent className="p-10">
                <h2 className="font-display text-3xl font-bold text-primary-deep mb-3">Nachricht gesendet</h2>
                <p className="text-muted-foreground">Wir melden uns so schnell wie möglich bei Ihnen.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-card">
              <CardContent className="p-8">
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div><Label htmlFor="from_name">Name *</Label><Input id="from_name" name="from_name" required maxLength={100} /></div>
                    <div><Label htmlFor="from_email">E-Mail *</Label><Input id="from_email" type="email" name="from_email" required maxLength={255} /></div>
                  </div>
                  <div>
                    <Label>Kategorie *</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="membership">Mitgliedschaft</SelectItem>
                        <SelectItem value="courses">Kurse</SelectItem>
                        <SelectItem value="payments">Zahlungen</SelectItem>
                        <SelectItem value="privacy">Datenschutz</SelectItem>
                        <SelectItem value="other">Sonstiges</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label htmlFor="subject">Betreff</Label><Input id="subject" name="subject" maxLength={200} /></div>
                  <div><Label htmlFor="body">Nachricht *</Label><Textarea id="body" name="body" rows={6} required maxLength={4000} /></div>
                  <Button type="submit" variant="accent" size="lg" className="w-full" disabled={loading}>
                    {loading ? "Wird gesendet..." : "Nachricht senden"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
