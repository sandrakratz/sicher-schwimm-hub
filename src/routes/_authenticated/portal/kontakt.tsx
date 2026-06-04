import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/portal/kontakt")({
  component: PortalContact,
});

function PortalContact() {
  const [cat, setCat] = useState("other");
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: p } = await supabase.from("profiles").select("first_name,last_name,email").eq("id", u.user.id).maybeSingle();
    setLoading(true);
    const { error } = await supabase.from("messages").insert({
      from_user_id: u.user.id,
      from_name: [p?.first_name, p?.last_name].filter(Boolean).join(" ") || u.user.email!,
      from_email: p?.email || u.user.email!,
      category: cat,
      subject: String(fd.get("subject") || ""),
      body: String(fd.get("body") || ""),
    });
    setLoading(false);
    if (error) toast.error(error.message); else {
      toast.success("Nachricht gesendet");
      (e.currentTarget as HTMLFormElement).reset();
    }
  }
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-bold text-primary-deep mb-6">Verein kontaktieren</h1>
      <Card className="border-0 shadow-soft">
        <CardContent className="p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>Kategorie</Label>
              <Select value={cat} onValueChange={setCat}>
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
            <div><Label htmlFor="body">Nachricht</Label><Textarea id="body" name="body" rows={6} required maxLength={4000} /></div>
            <Button type="submit" variant="accent" disabled={loading}>Senden</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
