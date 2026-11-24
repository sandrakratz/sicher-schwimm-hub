import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fullName } from "@/lib/format";

/** Nachricht eines angemeldeten Mitglieds an den Verein (landet im Eingang der Verwaltung). */
export function ContactForm() {
  const [cat, setCat] = useState("other");
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: p } = await supabase
      .from("profiles")
      .select("first_name,last_name,email")
      .eq("id", u.user.id)
      .maybeSingle();
    setLoading(true);
    const { error } = await supabase.from("messages").insert({
      from_user_id: u.user.id,
      from_name: fullName(p?.first_name, p?.last_name) || u.user.email!,
      from_email: p?.email || u.user.email!,
      category: cat,
      subject: String(fd.get("subject") || ""),
      body: String(fd.get("body") || ""),
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Nachricht gesendet");
      form.reset();
    }
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="contact-cat">Worum geht es?</Label>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger id="contact-cat">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="membership">Mitgliedschaft</SelectItem>
            <SelectItem value="courses">Kurse</SelectItem>
            <SelectItem value="payments">Zahlungen</SelectItem>
            <SelectItem value="privacy">Datenschutz</SelectItem>
            <SelectItem value="other">Sonstiges</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="subject">Betreff</Label>
        <Input id="subject" name="subject" maxLength={200} />
      </div>
      <div>
        <Label htmlFor="body">Nachricht</Label>
        <Textarea id="body" name="body" rows={6} required maxLength={4000} />
      </div>
      <Button type="submit" variant="accent" disabled={loading}>
        Senden
      </Button>
    </form>
  );
}
