import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { CancellationButton } from "@/components/CancellationButton";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/kurs-anfragen")({
  head: () => ({
    meta: [
      { title: "Schwimmkurs anfragen / Warteliste Hennef | Sicher Schwimmen e.V." },
      { name: "description", content: "Schwimmkurs in Hennef anfragen oder auf die Warteliste setzen lassen – für Seepferdchen, Bronze, Silber, Gold, Wassergewöhnung und Anfängerkurse." },
      { property: "og:title", content: "Schwimmkurs anfragen – Sicher Schwimmen e.V." },
      { property: "og:description", content: "Setzen Sie Ihr Kind auf die Warteliste oder fragen Sie einen Schwimmkurs in Hennef an." },
      { property: "og:url", content: "https://sicher-schwimmen.com/kurs-anfragen" },
    ],
    links: [{ rel: "canonical", href: "https://sicher-schwimmen.com/kurs-anfragen" }],
  }),
  component: RequestPage,
});

const schema = z.object({
  parent_name: z.string().trim().min(2).max(100),
  parent_email: z.string().trim().email().max(255),
  parent_phone: z.string().trim().max(40).optional(),
  child_name: z.string().trim().max(100).optional(),
  child_dob: z.string().optional(),
  swimming_level: z.string().trim().max(100).optional(),
  desired_course: z.string().trim().max(100).optional(),
  health_info: z.string().trim().max(1000).optional(),
  message: z.string().trim().max(2000).optional(),
  gdpr_consent: z.boolean().refine((v) => v, "Bitte Datenschutz bestätigen"),
  contact_permission: z.boolean(),
});

function RequestPage() {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      parent_name: String(fd.get("parent_name") || ""),
      parent_email: String(fd.get("parent_email") || ""),
      parent_phone: String(fd.get("parent_phone") || ""),
      child_name: String(fd.get("child_name") || ""),
      child_dob: String(fd.get("child_dob") || "") || undefined,
      swimming_level: String(fd.get("swimming_level") || ""),
      desired_course: String(fd.get("desired_course") || ""),
      health_info: String(fd.get("health_info") || ""),
      message: String(fd.get("message") || ""),
      gdpr_consent: fd.get("gdpr_consent") === "on",
      contact_permission: fd.get("contact_permission") === "on",
    };
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Bitte Eingaben prüfen");
      return;
    }
    setLoading(true);
    const idem = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
    const createdAt = new Date().toISOString();
    const { error } = await supabase.from("course_requests").insert({
      ...parsed.data,
      child_dob: parsed.data.child_dob || null,
    });
    setLoading(false);
    if (error) {
      console.warn("[course_requests.insert]", error.code, error.message);
      toast.error("Anfrage konnte nicht gesendet werden");
      return;
    }
    fetch("/api/public/notify-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateName: "course-request",
        idempotencyKey: `course-request-${idem}`,
        templateData: { ...parsed.data, created_at: createdAt },
      }),
    }).catch(() => {});
    setDone(true);
  }

  if (done) {
    return (
      <PublicLayout>
        <AlertDialog open={done}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Anfrage eingegangen</AlertDialogTitle>
              <AlertDialogDescription>
                Ihre Kursanfrage ist eingegangen und wird bearbeitet. Wir melden uns mit den nächsten Schritten per E-Mail.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setDone(false)}>OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <section className="container mx-auto px-4 py-24 text-center max-w-xl">
          <CheckCircle2 className="h-16 w-16 text-success mx-auto mb-6" />
          <h1 className="font-display text-4xl font-bold text-primary-deep mb-4">Vielen Dank!</h1>
          <p className="text-muted-foreground text-lg">
            Ihre Anfrage ist bei uns eingegangen. Wir melden uns so schnell wie möglich.
          </p>
        </section>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <section className="bg-hero text-white py-16">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-3">Kursanfrage & Warteliste</h1>
          <p className="text-white/85">Bitte füllen Sie das Formular aus – wir melden uns mit den nächsten Schritten.</p>
        </div>
      </section>
      <section className="container mx-auto px-4 py-12 max-w-3xl">
        <Card className="shadow-card border-0">
          <CardContent className="p-8">
            <form onSubmit={onSubmit} className="space-y-6">
              <div>
                <h3 className="font-display font-bold text-xl text-primary-deep mb-4">Eltern / Erziehungsberechtigte</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="parent_name">Name *</Label>
                    <Input id="parent_name" name="parent_name" required maxLength={100} />
                  </div>
                  <div>
                    <Label htmlFor="parent_email">E-Mail *</Label>
                    <Input id="parent_email" type="email" name="parent_email" required maxLength={255} />
                  </div>
                  <div>
                    <Label htmlFor="parent_phone">Telefon</Label>
                    <Input id="parent_phone" name="parent_phone" maxLength={40} />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-display font-bold text-xl text-primary-deep mb-4">Kind</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="child_name">Name des Kindes</Label>
                    <Input id="child_name" name="child_name" maxLength={100} />
                  </div>
                  <div>
                    <Label htmlFor="child_dob">Geburtsdatum</Label>
                    <Input id="child_dob" type="date" name="child_dob" />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="swimming_level">Aktuelles Schwimmlevel</Label>
                    <Input id="swimming_level" name="swimming_level" placeholder="z.B. Anfänger, Seepferdchen, Bronze..." maxLength={100} />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-display font-bold text-xl text-primary-deep mb-4">Wunsch</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="desired_course">Gewünschter Kurs</Label>
                    <Input id="desired_course" name="desired_course" placeholder="z.B. Seepferdchen-Vorbereitung" maxLength={100} />
                  </div>
                  <div>
                    <Label htmlFor="health_info">Gesundheitliche Hinweise (optional)</Label>
                    <Textarea id="health_info" name="health_info" rows={2} maxLength={1000} />
                  </div>
                  <div>
                    <Label htmlFor="message">Nachricht</Label>
                    <Textarea id="message" name="message" rows={3} maxLength={2000} />
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-t pt-6">
                <label className="flex gap-3 items-start cursor-pointer">
                  <Checkbox name="gdpr_consent" required />
                  <span className="text-sm">Ich habe die <a href="/datenschutz" className="text-primary underline">Datenschutzerklärung</a> gelesen und stimme der Verarbeitung meiner Daten zu. *</span>
                </label>
                <label className="flex gap-3 items-start cursor-pointer">
                  <Checkbox name="contact_permission" />
                  <span className="text-sm">Ich möchte zu Kursangeboten kontaktiert werden.</span>
                </label>
              </div>

              <Button type="submit" variant="accent" size="lg" className="w-full" disabled={loading}>
                {loading ? "Wird gesendet..." : "Anfrage absenden"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <div className="max-w-3xl mx-auto mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>Sie haben bereits gebucht und möchten widerrufen?</p>
          <CancellationButton variant="outline" size="sm" />
        </div>
      </section>
    </PublicLayout>
  );
}
