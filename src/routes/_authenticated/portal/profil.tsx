import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PayoutIbanCard } from "@/components/trainer/PayoutIbanCard";
import { useServerFn } from "@tanstack/react-start";
import { updateOwnFamilyContacts } from "@/lib/family-contacts.functions";

export const Route = createFileRoute("/_authenticated/portal/profil")({
  component: Profile,
});

function Profile() {
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [family, setFamily] = useState<
    Array<{
      name?: string;
      date_of_birth?: string;
      role?: string;
      email?: string | null;
      phone?: string | null;
      membership_id?: string;
      slot?: "partner" | "child" | "item";
      index?: number;
    }>
  >([]);
  const [savingFamily, setSavingFamily] = useState(false);
  const updateContacts = useServerFn(updateOwnFamilyContacts);
  const [isTrainer, setIsTrainer] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      setIsTrainer((roleRows ?? []).some((r) => r.role === "trainer"));
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .maybeSingle();
      setP(profile);
      const { data: ms } = await supabase
        .from("memberships")
        .select("id,family_members,status")
        .eq("user_id", data.user.id)
        .order("created_at", { ascending: false });
      const fm = (ms || []).flatMap((m: any) => {
        const f = m.family_members;
        if (!f) return [];
        if (Array.isArray(f))
          return f.map((x: any, i: number) => ({
            ...x,
            role: "Familienmitglied",
            membership_id: m.id,
            slot: "item",
            index: i,
          }));
        const out: any[] = [];
        if (f.partner?.name)
          out.push({ ...f.partner, role: "Partner:in", membership_id: m.id, slot: "partner" });
        if (Array.isArray(f.children))
          f.children.forEach((c: any, i: number) => {
            if (c?.name)
              out.push({ ...c, role: "Kind", membership_id: m.id, slot: "child", index: i });
          });
        return out;
      });
      setFamily(fm);
    });
  }, []);

  function updateFamily(i: number, patch: { email?: string; phone?: string }) {
    setFamily((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  async function saveFamily() {
    const ids = Array.from(new Set(family.map((f) => f.membership_id).filter(Boolean)));
    setSavingFamily(true);
    try {
      for (const id of ids as string[]) {
        const mine = family.filter((f) => f.membership_id === id);
        const partner = mine.find((f) => f.slot === "partner");
        const children: Array<{ email: string; phone: string }> = [];
        mine
          .filter((f) => f.slot === "child")
          .forEach((f) => {
            children[f.index as number] = { email: f.email ?? "", phone: f.phone ?? "" };
          });
        const list: Array<{ email: string; phone: string }> = [];
        mine
          .filter((f) => f.slot === "item")
          .forEach((f) => {
            list[f.index as number] = { email: f.email ?? "", phone: f.phone ?? "" };
          });
        await updateContacts({
          data: {
            membership_id: id,
            list: Array.from(list, (c) => c ?? { email: "", phone: "" }),
            partner: partner ? { email: partner.email ?? "", phone: partner.phone ?? "" } : null,
            // Einträge ohne Namen (werden nicht angezeigt) bleiben leer
            children: Array.from(children, (c) => c ?? { email: "", phone: "" }),
          },
        });
      }
      toast.success("Kontaktdaten der Familienmitglieder gespeichert");
    } catch (e: any) {
      toast.error(e?.message || "Speichern fehlgeschlagen");
    } finally {
      setSavingFamily(false);
    }
  }

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
    if (error) toast.error(error.message);
    else toast.success("Profil gespeichert");
  }

  if (!p) return <div>Lädt...</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-bold text-primary-deep mb-6">Mein Profil</h1>
      <Card className="border-0 shadow-soft">
        <CardContent className="p-6">
          <form onSubmit={save} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">Vorname</Label>
                <Input id="first_name" name="first_name" defaultValue={p.first_name || ""} />
              </div>
              <div>
                <Label htmlFor="last_name">Nachname</Label>
                <Input id="last_name" name="last_name" defaultValue={p.last_name || ""} />
              </div>
              <div className="sm:col-span-2">
                <Label>E-Mail</Label>
                <Input value={p.email} disabled />
              </div>
              <div>
                <Label htmlFor="phone">Telefon</Label>
                <Input id="phone" name="phone" defaultValue={p.phone || ""} />
              </div>
              <div>
                <Label htmlFor="address_street">Straße</Label>
                <Input
                  id="address_street"
                  name="address_street"
                  defaultValue={p.address_street || ""}
                />
              </div>
              <div>
                <Label htmlFor="address_zip">PLZ</Label>
                <Input id="address_zip" name="address_zip" defaultValue={p.address_zip || ""} />
              </div>
              <div>
                <Label htmlFor="address_city">Ort</Label>
                <Input id="address_city" name="address_city" defaultValue={p.address_city || ""} />
              </div>
            </div>
            <Button type="submit" variant="accent" disabled={loading}>
              Speichern
            </Button>
          </form>
        </CardContent>
      </Card>
      {isTrainer && (
        <PayoutIbanCard
          defaultHolder={[p.first_name, p.last_name].filter(Boolean).join(" ") || undefined}
        />
      )}
      {family.length > 0 && (
        <Card className="border-0 shadow-soft mt-6">
          <CardContent className="p-6">
            <h2 className="font-display text-xl font-semibold text-primary-deep mb-3">
              Familienmitglieder
            </h2>
            <ul className="divide-y">
              {family.map((f, i) => (
                <li key={i} className="py-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">
                      {f.name || "Ohne Namen"}{" "}
                      <span className="text-xs text-muted-foreground font-normal">({f.role})</span>
                    </span>
                    <span className="text-muted-foreground">
                      {f.date_of_birth ? new Date(f.date_of_birth).toLocaleDateString("de-DE") : ""}
                    </span>
                  </div>
                  {f.slot ? (
                    <div className="grid sm:grid-cols-2 gap-3 mt-2">
                      <div>
                        <Label className="text-xs">E-Mail</Label>
                        <Input
                          type="email"
                          value={f.email ?? ""}
                          onChange={(e) => updateFamily(i, { email: e.target.value })}
                          maxLength={255}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Telefon</Label>
                        <Input
                          type="tel"
                          value={f.phone ?? ""}
                          onChange={(e) => updateFamily(i, { phone: e.target.value })}
                          maxLength={40}
                        />
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            {family.some((f) => f.slot) && (
              <Button
                type="button"
                variant="accent"
                className="mt-3"
                onClick={saveFamily}
                disabled={savingFamily}
              >
                {savingFamily ? "Speichern…" : "Kontaktdaten speichern"}
              </Button>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Telefon und E-Mail können Sie hier selbst ergänzen. Änderungen an Namen oder
              Geburtsdaten bitte an info@sicher-schwimmen.com melden.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
