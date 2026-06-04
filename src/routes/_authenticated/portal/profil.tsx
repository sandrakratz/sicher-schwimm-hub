import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/portal/profil")({
  component: Profile,
});

function Profile() {
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
      setP(profile);
    });
  }, []);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!p) return;
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      first_name: String(fd.get("first_name") || ""),
      last_name: String(fd.get("last_name") || ""),
      phone: String(fd.get("phone") || ""),
      address_street: String(fd.get("address_street") || ""),
      address_zip: String(fd.get("address_zip") || ""),
      address_city: String(fd.get("address_city") || ""),
    };
    const { error } = await supabase.from("profiles").update(payload).eq("id", p.id);
    setLoading(false);
    if (error) toast.error(error.message); else toast.success("Profil gespeichert");
  }

  if (!p) return <div>Lädt...</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-bold text-primary-deep mb-6">Mein Profil</h1>
      <Card className="border-0 shadow-soft">
        <CardContent className="p-6">
          <form onSubmit={save} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label htmlFor="first_name">Vorname</Label><Input id="first_name" name="first_name" defaultValue={p.first_name || ""} /></div>
              <div><Label htmlFor="last_name">Nachname</Label><Input id="last_name" name="last_name" defaultValue={p.last_name || ""} /></div>
              <div className="sm:col-span-2"><Label>E-Mail</Label><Input value={p.email} disabled /></div>
              <div><Label htmlFor="phone">Telefon</Label><Input id="phone" name="phone" defaultValue={p.phone || ""} /></div>
              <div><Label htmlFor="address_street">Straße</Label><Input id="address_street" name="address_street" defaultValue={p.address_street || ""} /></div>
              <div><Label htmlFor="address_zip">PLZ</Label><Input id="address_zip" name="address_zip" defaultValue={p.address_zip || ""} /></div>
              <div><Label htmlFor="address_city">Ort</Label><Input id="address_city" name="address_city" defaultValue={p.address_city || ""} /></div>
            </div>
            <Button type="submit" variant="accent" disabled={loading}>Speichern</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
