import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/mitgliedschaften")({
  component: Page,
});

const TYPE_LABEL: Record<string, string> = {
  children_youth: "Kinder & Jugend",
  adult: "Erwachsene",
  family: "Familie",
  supporting: "Förderung",
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("de-DE"); } catch { return d; }
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-1.5 border-b border-border/50 last:border-0">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="col-span-2 text-sm break-words">{value || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

function Page() {
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);

  async function load() {
    const { data } = await supabase.from("memberships").select("*").order("created_at", { ascending: false });
    setRows(data || []);
  }
  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: "pending" | "active" | "suspended" | "terminated") {
    const { error } = await supabase.from("memberships").update({
      status,
      approved_at: status === "active" ? new Date().toISOString() : null,
    }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Aktualisiert"); load(); setSelected(null); }
  }

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-3xl font-bold text-primary-deep mb-6">Mitgliedschaften</h1>
      <Card className="border-0 shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Datum</TableHead><TableHead>Name</TableHead><TableHead>E-Mail</TableHead><TableHead>Art</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aktionen</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Keine Anträge.</TableCell></TableRow>}
              {rows.map(r => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                  <TableCell className="text-xs">{fmtDate(r.created_at)}</TableCell>
                  <TableCell>{r.first_name} {r.last_name}</TableCell>
                  <TableCell className="text-xs">{r.email}</TableCell>
                  <TableCell><Badge variant="outline">{TYPE_LABEL[r.membership_type] || r.membership_type}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                  <TableCell className="text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" onClick={() => setSelected(r)}>Details</Button>
                    {r.status !== "active" && <Button size="sm" variant="accent" onClick={() => setStatus(r.id, "active")}>Genehmigen</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mitgliedsantrag · {selected?.first_name} {selected?.last_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-6">
              <section>
                <h3 className="font-display font-bold text-primary-deep mb-2">Antragsdaten</h3>
                <Row label="Eingegangen" value={fmtDate(selected.created_at)} />
                <Row label="Status" value={<Badge variant="outline">{selected.status}</Badge>} />
                <Row label="Genehmigt am" value={fmtDate(selected.approved_at)} />
                <Row label="Mitgliedschaftsart" value={TYPE_LABEL[selected.membership_type] || selected.membership_type} />
              </section>

              <section>
                <h3 className="font-display font-bold text-primary-deep mb-2">Person</h3>
                <Row label="Name" value={`${selected.first_name} ${selected.last_name}`} />
                <Row label="Geburtsdatum" value={fmtDate(selected.date_of_birth)} />
                <Row label="E-Mail" value={selected.email} />
                <Row label="Telefon" value={selected.phone} />
                <Row label="Adresse" value={[selected.address_street, [selected.address_zip, selected.address_city].filter(Boolean).join(" ")].filter(Boolean).join(", ")} />
              </section>

              {(selected.guardian_name || selected.guardian_email || selected.guardian_phone) && (
                <section>
                  <h3 className="font-display font-bold text-primary-deep mb-2">Erziehungsberechtigte/r</h3>
                  <Row label="Name" value={selected.guardian_name} />
                  <Row label="E-Mail" value={selected.guardian_email} />
                  <Row label="Telefon" value={selected.guardian_phone} />
                </section>
              )}

              {selected.family_members && (selected.family_members.partner || (selected.family_members.children?.length > 0)) && (
                <section>
                  <h3 className="font-display font-bold text-primary-deep mb-2">Familienangaben</h3>
                  {selected.family_members.partner?.name && (
                    <Row label="Partner/in" value={`${selected.family_members.partner.name}${selected.family_members.partner.date_of_birth ? ` (geb. ${fmtDate(selected.family_members.partner.date_of_birth)})` : ""}`} />
                  )}
                  {(selected.family_members.children || []).map((c: any, i: number) => (
                    <Row key={i} label={`Kind ${i + 1}`} value={`${c.name}${c.date_of_birth ? ` (geb. ${fmtDate(c.date_of_birth)})` : ""}`} />
                  ))}
                </section>
              )}

              <section>
                <h3 className="font-display font-bold text-primary-deep mb-2">SEPA-Lastschriftmandat</h3>
                <Row label="Kontoinhaber/in" value={selected.sepa_account_holder} />
                <Row label="IBAN" value={<span className="font-mono">{selected.sepa_iban}</span>} />
                <Row label="BIC" value={selected.sepa_bic ? <span className="font-mono">{selected.sepa_bic}</span> : null} />
                <Row label="Kreditinstitut" value={selected.sepa_bank_name} />
                <Row label="Ort, Datum" value={`${selected.sepa_signature_place || "—"}, ${fmtDate(selected.sepa_signature_date)}`} />
                <Row label="Mandat erteilt" value={selected.sepa_mandate_accepted ? "Ja" : "Nein"} />
              </section>

              <section>
                <h3 className="font-display font-bold text-primary-deep mb-2">Zustimmungen</h3>
                <Row label="Satzung" value={selected.accepted_statutes ? "Akzeptiert" : "Nein"} />
                <Row label="Mitgliedsordnung" value={selected.accepted_rules ? "Akzeptiert" : "Nein"} />
                <Row label="Datenschutz" value={selected.accepted_privacy ? "Akzeptiert" : "Nein"} />
                <Row label="Einwilligung am" value={fmtDate(selected.consent_at)} />
              </section>

              <div className="flex flex-wrap gap-2 pt-2 border-t">
                {selected.status !== "active" && <Button variant="accent" onClick={() => setStatus(selected.id, "active")}>Genehmigen</Button>}
                {selected.status !== "suspended" && <Button variant="outline" onClick={() => setStatus(selected.id, "suspended")}>Pausieren</Button>}
                {selected.status !== "terminated" && <Button variant="outline" onClick={() => setStatus(selected.id, "terminated")}>Ablehnen / Beenden</Button>}
                <Button variant="ghost" onClick={() => setSelected(null)} className="ml-auto">Schließen</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
