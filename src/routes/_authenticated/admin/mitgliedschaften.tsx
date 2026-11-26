import { MEMBERSHIP_TYPE_LABEL } from "@/lib/labels";
import { createFileRoute } from "@tanstack/react-router";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  setMembershipStatus,
  setMembershipDates,
  listMemberPriceMismatches,
  chargeNormalPrice,
  deleteMembership as deleteMembershipFn,
} from "@/lib/membership.functions";
import { formatDateBerlin, formatEuro } from "@/lib/format";
import { GENDERS, isGender } from "@/components/public/membership-form";
import { NativeSelect } from "@/components/ui/native-select";

export const Route = createFileRoute("/_authenticated/admin/mitgliedschaften")({
  // ?antrag=<id> öffnet einen Antrag direkt (Sprung aus dem Eingang)
  validateSearch: (search: Record<string, unknown>): { antrag?: string } =>
    typeof search["antrag"] === "string" && search["antrag"] ? { antrag: search["antrag"] } : {},
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/role-guard");
    const { redirect } = await import("@tanstack/react-router");
    try {
      await assertHasAnyRole({ data: { roles: ["admin", "board"] } });
    } catch {
      throw redirect({ to: "/admin/benutzer" });
    }
  },
  component: Page,
});

const TYPE_LABEL = MEMBERSHIP_TYPE_LABEL;

const STATUS_LABEL: Record<string, string> = {
  pending: "Wartet auf Freigabe",
  active: "Aktiv",
  suspended: "Pausiert",
  terminated: "Beendet",
};

type Member = {
  name: string;
  date_of_birth: string | null;
  gender?: string | null;
  email?: string | null;
  phone?: string | null;
};

const genderLabel = (g: unknown) => GENDERS.find((x) => x.value === g)?.label ?? null;

/** Auswahl Geschlecht für die Verwaltung (leer = noch nicht erfasst). */
function GenderSelect({
  value,
  onChange,
  label = "Geschlecht",
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  label?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <NativeSelect
        className="w-full"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">– nicht erfasst –</option>
        {GENDERS.map((g) => (
          <option key={g.value} value={g.value}>
            {g.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

function majorityBadge(dob?: string | null): string | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const b18 = new Date(d.getFullYear() + 18, d.getMonth(), d.getDate());
  const days = Math.round((b18.getTime() - Date.now()) / 86400000);
  if (days > 0 && days <= 120) return `wird 18 am ${formatDateBerlin(b18)}`;
  if (days <= 0 && days > -365) return `18 geworden am ${formatDateBerlin(b18)} – Beitrag prüfen`;
  return null;
}
type FamilyMembers = { partner?: Member | null; children?: Member[] } | null;

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-1.5 border-b border-border/50 last:border-0">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="col-span-2 text-sm break-words">
        {value || <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}

function FamilyEditor({
  value,
  onSave,
  onCancel,
}: {
  value: FamilyMembers;
  onSave: (v: FamilyMembers) => Promise<void>;
  onCancel: () => void;
}) {
  const [partner, setPartner] = useState<Member>({
    name: value?.partner?.name || "",
    date_of_birth: value?.partner?.date_of_birth || "",
    gender: value?.partner?.gender ?? null,
    email: value?.partner?.email ?? null,
    phone: value?.partner?.phone ?? null,
  });
  const [children, setChildren] = useState<Member[]>(
    value?.children?.length
      ? value.children.map((c) => ({
          name: c.name || "",
          date_of_birth: c.date_of_birth || "",
          gender: c.gender ?? null,
          email: c.email ?? null,
          phone: c.phone ?? null,
        }))
      : [],
  );
  const [saving, setSaving] = useState(false);

  const updateChild = (i: number, patch: Partial<Member>) =>
    setChildren((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const addChild = () => setChildren((prev) => [...prev, { name: "", date_of_birth: "" }]);
  const removeChild = (i: number) => setChildren((prev) => prev.filter((_, idx) => idx !== i));

  async function save() {
    setSaving(true);
    const cleaned: FamilyMembers = {
      partner: partner.name.trim()
        ? {
            name: partner.name.trim(),
            date_of_birth: partner.date_of_birth || null,
            gender: isGender(partner.gender) ? partner.gender : null,
            ...(partner.email?.trim() ? { email: partner.email.trim() } : {}),
            ...(partner.phone?.trim() ? { phone: partner.phone.trim() } : {}),
          }
        : null,
      children: children
        .filter((c) => c.name.trim())
        .map((c) => ({
          name: c.name.trim(),
          date_of_birth: c.date_of_birth || null,
          gender: isGender(c.gender) ? c.gender : null,
          ...(c.email?.trim() ? { email: c.email.trim() } : {}),
          ...(c.phone?.trim() ? { phone: c.phone.trim() } : {}),
        })),
    };
    await onSave(cleaned);
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium mb-2">Partner/in</h4>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input
              value={partner.name}
              onChange={(e) => setPartner((p) => ({ ...p, name: e.target.value }))}
              maxLength={200}
            />
          </div>
          <div>
            <Label className="text-xs">Geburtsdatum</Label>
            <Input
              type="date"
              value={partner.date_of_birth || ""}
              onChange={(e) => setPartner((p) => ({ ...p, date_of_birth: e.target.value }))}
            />
          </div>
          <GenderSelect
            value={partner.gender}
            onChange={(g) => setPartner((p) => ({ ...p, gender: g }))}
          />
          <div>
            <Label className="text-xs">E-Mail</Label>
            <Input
              type="email"
              value={partner.email || ""}
              onChange={(e) => setPartner((p) => ({ ...p, email: e.target.value }))}
              maxLength={255}
            />
          </div>
          <div>
            <Label className="text-xs">Telefon</Label>
            <Input
              type="tel"
              value={partner.phone || ""}
              onChange={(e) => setPartner((p) => ({ ...p, phone: e.target.value }))}
              maxLength={40}
            />
          </div>
        </div>
      </div>
      {children.map((c, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">Kind {i + 1}</h4>
            <Button type="button" size="sm" variant="ghost" onClick={() => removeChild(i)}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Entfernen
            </Button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                value={c.name}
                onChange={(e) => updateChild(i, { name: e.target.value })}
                maxLength={200}
              />
            </div>
            <div>
              <Label className="text-xs">Geburtsdatum</Label>
              <Input
                type="date"
                value={c.date_of_birth || ""}
                onChange={(e) => updateChild(i, { date_of_birth: e.target.value })}
              />
            </div>
            <GenderSelect value={c.gender} onChange={(g) => updateChild(i, { gender: g })} />
            <div>
              <Label className="text-xs">E-Mail</Label>
              <Input
                type="email"
                value={c.email || ""}
                onChange={(e) => updateChild(i, { email: e.target.value })}
                maxLength={255}
              />
            </div>
            <div>
              <Label className="text-xs">Telefon</Label>
              <Input
                type="tel"
                value={c.phone || ""}
                onChange={(e) => updateChild(i, { phone: e.target.value })}
                maxLength={40}
              />
            </div>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={addChild}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Kind hinzufügen
        </Button>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            <X className="h-3.5 w-3.5 mr-1" />
            Abbrechen
          </Button>
          <Button type="button" variant="accent" size="sm" onClick={save} disabled={saving}>
            {saving ? "Speichern…" : "Speichern"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Beginn und Ende der Gültigkeit; „gültig bis“ nach wirksamer Kündigung auf den 31.12. setzen. */
function DatesEditor({ row, onSaved }: { row: any; onSaved: () => void }) {
  const save = useServerFn(setMembershipDates);
  const [start, setStart] = useState<string>(row.start_date ?? "");
  const [until, setUntil] = useState<string>(row.valid_until ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setStart(row.start_date ?? "");
    setUntil(row.valid_until ?? "");
  }, [row.id, row.start_date, row.valid_until]);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Mitglied ab</Label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Gültig bis (nach Kündigung zum Jahresende)</Label>
          <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Der Mitgliedspreis gilt für Kurse, die zwischen diesen Daten beginnen. Leer = keine
        Einschränkung.
      </p>
      <Button
        size="sm"
        variant="accent"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await save({
              data: { id: row.id, start_date: start || null, valid_until: until || null },
            });
            toast.success("Gültigkeit gespeichert");
            onSaved();
          } catch (e: any) {
            toast.error(e?.message || "Fehler");
          } finally {
            setBusy(false);
          }
        }}
      >
        Speichern
      </Button>
    </div>
  );
}

/** Buchungen mit Mitgliedspreis, obwohl die Mitgliedschaft zum Kursstart nicht gilt. Der Vorstand entscheidet je Fall. */
function PriceMismatches() {
  const listFn = useServerFn(listMemberPriceMismatches);
  const chargeFn = useServerFn(chargeNormalPrice);
  const [items, setItems] = useState<Awaited<ReturnType<typeof listMemberPriceMismatches>>>([]);
  async function load() {
    try {
      setItems(await listFn());
    } catch (e: any) {
      toast.error(e?.message || "Liste konnte nicht geladen werden");
    }
  }
  useEffect(() => {
    load();
  }, []);
  if (items.length === 0) return null;
  return (
    <CollapsibleCard
      title={`Mitgliedspreis ohne gültige Mitgliedschaft (${items.length})`}
      storageKey="admin-mitgliedschaften-preisabweichung"
      contentClassName="px-0"
    >
      <p className="px-6 pb-3 text-sm text-muted-foreground">
        Diese Buchungen haben den Mitgliedspreis, aber zum Kursstart gibt es keine gültige
        Mitgliedschaft (Antrag zurückgezogen, nicht zustande gekommen oder gekündigt). Nichts
        geschieht automatisch.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Teilnehmer</TableHead>
            <TableHead>Kurs</TableHead>
            <TableHead>Kursstart</TableHead>
            <TableHead>Preis jetzt</TableHead>
            <TableHead>Normalpreis</TableHead>
            <TableHead>Differenz</TableHead>
            <TableHead className="text-right">Aktion</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((i) => (
            <TableRow key={i.id}>
              <TableCell>
                {i.participant}
                <div className="text-xs text-muted-foreground">{i.email}</div>
              </TableCell>
              <TableCell>{i.course}</TableCell>
              <TableCell className="text-xs">{formatDateBerlin(i.startsOn)}</TableCell>
              <TableCell>{formatEuro(i.current)}</TableCell>
              <TableCell>{formatEuro(i.normal)}</TableCell>
              <TableCell>
                {formatEuro(i.difference)} {i.paid && <Badge variant="outline">bezahlt</Badge>}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={i.normal == null}
                  onClick={async () => {
                    const ok = confirm(
                      i.paid
                        ? "Auf Normalpreis setzen? Die Buchung ist schon bezahlt: Die Differenz muss die Kasse separat anfordern."
                        : "Auf Normalpreis setzen? Die Zahlungserinnerung nutzt dann den neuen Preis.",
                    );
                    if (!ok) return;
                    try {
                      await chargeFn({ data: { participantId: i.id } });
                      toast.success("Auf Normalpreis gesetzt");
                      load();
                    } catch (e: any) {
                      toast.error(e?.message || "Fehler");
                    }
                  }}
                >
                  Auf Normalpreis setzen
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CollapsibleCard>
  );
}

function Page() {
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [editingFamily, setEditingFamily] = useState(false);
  const setStatusFn = useServerFn(setMembershipStatus);
  const deleteFn = useServerFn(deleteMembershipFn);
  const { antrag } = Route.useSearch();
  const [q, setQ] = useState("");
  // Standard: alle (offene Anträge stehen ohnehin oben); Knöpfe filtern nach Status
  const [statusFilter, setStatusFilter] = useState<
    "pending" | "active" | "suspended" | "terminated" | "all"
  >("all");

  async function load() {
    const { data } = await supabase
      .from("memberships")
      .select("*")
      .order("created_at", { ascending: false });
    setRows(data || []);
    const openId = selected?.id ?? antrag;
    if (openId) {
      const fresh = (data || []).find((r) => r.id === openId);
      if (fresh) setSelected(fresh);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: "pending" | "active" | "suspended" | "terminated") {
    try {
      const res: any = await setStatusFn({ data: { id, status } });
      toast.success(
        res?.repriced > 0
          ? `Aktualisiert – ${res.repriced} offene Kursbuchung(en) auf den Mitgliedspreis umgestellt`
          : "Aktualisiert",
      );
      load();
      setSelected(null);
    } catch (e: any) {
      toast.error(e?.message || "Fehler");
    }
  }

  // Löschen nur für nie genehmigte Anträge (Fehleinträge, Dubletten), mit Rückfrage
  const [deleteFor, setDeleteFor] = useState<{
    id: string;
    first_name?: string | null;
    last_name?: string | null;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  async function deleteMembership(id: string) {
    setDeleting(true);
    try {
      await deleteFn({ data: { id } });
      toast.success("Antrag gelöscht");
      setDeleteFor(null);
      setSelected(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Fehler");
    } finally {
      setDeleting(false);
    }
  }

  /** Geschlecht des Hauptmitglieds (für die Bestandsmeldung) sofort speichern. */
  async function saveGender(gender: string | null) {
    if (!selected) return;
    const { error } = await supabase
      .from("memberships")
      .update({ gender } as never)
      .eq("id", selected.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Geschlecht gespeichert");
    await load();
  }

  async function saveFamily(family_members: FamilyMembers) {
    if (!selected) return;
    const { error } = await supabase
      .from("memberships")
      .update({ family_members: family_members as any })
      .eq("id", selected.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Familienangaben gespeichert");
    setEditingFamily(false);
    await load();
  }

  const fm: FamilyMembers = selected?.family_members ?? null;
  const hasFamily = !!(fm && (fm.partner?.name || (fm.children?.length || 0) > 0));

  // Offene Anträge zuerst; Suche nach Name/E-Mail und Filter nach Status
  const needle = q.trim().toLowerCase();
  const shown = rows
    .filter((r) => statusFilter === "all" || r.status === statusFilter)
    .filter(
      (r) =>
        !needle ||
        `${r.first_name ?? ""} ${r.last_name ?? ""} ${r.email ?? ""}`
          .toLowerCase()
          .includes(needle),
    )
    .sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"));
  const countOf = (s: string) => rows.filter((r) => s === "all" || r.status === s).length;

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-3xl font-bold text-primary-deep mb-6">Mitgliedschaften</h1>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          aria-label="Mitgliedschaften durchsuchen"
          placeholder="Name oder E-Mail suchen …"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-64"
        />
        {(["pending", "active", "suspended", "terminated", "all"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            aria-pressed={statusFilter === s}
            onClick={() => setStatusFilter(s)}
          >
            {s === "all" ? "Alle" : STATUS_LABEL[s]} ({countOf(s)})
          </Button>
        ))}
      </div>
      <CollapsibleCard
        title="Mitgliedschaften"
        storageKey="admin-mitgliedschaften"
        contentClassName="px-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead>Art</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  {rows.length === 0 ? "Keine Anträge." : "Nichts gefunden für diese Auswahl."}
                </TableCell>
              </TableRow>
            )}
            {shown.map((r) => (
              <TableRow
                key={r.id}
                className="cursor-pointer"
                onClick={() => {
                  setSelected(r);
                  setEditingFamily(false);
                }}
              >
                <TableCell className="text-xs">{formatDateBerlin(r.created_at)}</TableCell>
                <TableCell>
                  {r.first_name} {r.last_name}
                </TableCell>
                <TableCell className="text-xs">{r.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {TYPE_LABEL[r.membership_type] || r.membership_type}
                  </Badge>
                  {[
                    r.date_of_birth,
                    ...(((r.family_members as any)?.children ?? []) as Member[]).map(
                      (c) => c.date_of_birth,
                    ),
                  ]
                    .map(majorityBadge)
                    .filter(Boolean)
                    .map((t, i) => (
                      <div key={i} className="mt-1 text-[11px] font-medium text-primary">
                        🎂 {t}
                      </div>
                    ))}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{STATUS_LABEL[r.status] || r.status}</Badge>
                </TableCell>
                <TableCell className="text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelected(r);
                      setEditingFamily(false);
                    }}
                  >
                    Details
                  </Button>
                  {r.status !== "active" && (
                    <Button size="sm" variant="accent" onClick={() => setStatus(r.id, "active")}>
                      Genehmigen
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CollapsibleCard>

      <PriceMismatches />

      {deleteFor && (
        <ConfirmActionDialog
          title={`Antrag von ${[deleteFor.first_name, deleteFor.last_name].filter(Boolean).join(" ") || "unbekannt"} löschen`}
          consequence={
            <>
              Der nie genehmigte Antrag wird endgültig gelöscht, samt aller Angaben. Das ist nur für
              Fehleinträge und Dubletten gedacht. Soll jemand nicht Mitglied werden, nutzen Sie
              „Ablehnen / Beenden“: dann bleibt der Vorgang nachvollziehbar und wird nach Frist
              automatisch gelöscht.
            </>
          }
          confirmLabel="Antrag löschen"
          destructive
          busy={deleting}
          onClose={() => setDeleteFor(null)}
          onConfirm={() => void deleteMembership(deleteFor.id)}
        />
      )}

      <Dialog
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) {
            setSelected(null);
            setEditingFamily(false);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Mitgliedsantrag · {selected?.first_name} {selected?.last_name}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-6">
              <section>
                <h3 className="font-display font-bold text-primary-deep mb-2">Antragsdaten</h3>
                <Row label="Eingegangen" value={formatDateBerlin(selected.created_at)} />
                <Row
                  label="Status"
                  value={
                    <Badge variant="outline">
                      {STATUS_LABEL[selected.status] || selected.status}
                    </Badge>
                  }
                />
                <Row label="Genehmigt am" value={formatDateBerlin(selected.approved_at)} />
                <Row label="Mitglied ab" value={formatDateBerlin(selected.start_date)} />
                <Row label="Gültig bis" value={formatDateBerlin(selected.valid_until)} />
                <Row
                  label="Mitgliedschaftsart"
                  value={TYPE_LABEL[selected.membership_type] || selected.membership_type}
                />
              </section>

              <section>
                <h3 className="font-display font-bold text-primary-deep mb-2">Gültigkeit</h3>
                <DatesEditor row={selected} onSaved={load} />
              </section>

              <section>
                <h3 className="font-display font-bold text-primary-deep mb-2">Person</h3>
                <Row label="Name" value={`${selected.first_name} ${selected.last_name}`} />
                <Row label="Geburtsdatum" value={formatDateBerlin(selected.date_of_birth)} />
                <div className="grid grid-cols-3 gap-3 py-1.5 border-b border-border/50">
                  <div className="text-xs font-semibold text-muted-foreground">Geschlecht</div>
                  <div className="col-span-2 max-w-56">
                    <GenderSelect
                      label=""
                      value={(selected as { gender?: string | null }).gender}
                      onChange={(g) => void saveGender(g)}
                    />
                  </div>
                </div>
                {(selected as any).member_email && (
                  <Row label="E-Mail des Mitglieds" value={(selected as any).member_email} />
                )}
                {(selected as any).member_phone && (
                  <Row label="Telefon des Mitglieds" value={(selected as any).member_phone} />
                )}
                {(selected as any).payer_role && (
                  <Row
                    label="Kontoinhaber ist"
                    value={
                      (
                        {
                          member: "Mitglied selbst",
                          guardian: "Erziehungsberechtigte/r",
                          other: "Andere Person",
                        } as Record<string, string>
                      )[(selected as any).payer_role] ?? (selected as any).payer_role
                    }
                  />
                )}
                {(selected as any).minor_consents && (
                  <Row
                    label="Zustimmungen Minderjährige"
                    value={`alle 5 bestätigt${(selected as any).minor_consents.accepted_at ? ` am ${formatDateBerlin((selected as any).minor_consents.accepted_at)}` : ""}`}
                  />
                )}
                <Row label="E-Mail" value={selected.email} />
                <Row label="Telefon" value={selected.phone} />
                <Row
                  label="Adresse"
                  value={[
                    selected.address_street,
                    [selected.address_zip, selected.address_city].filter(Boolean).join(" "),
                  ]
                    .filter(Boolean)
                    .join(", ")}
                />
              </section>

              {(selected.guardian_name || selected.guardian_email || selected.guardian_phone) && (
                <section>
                  <h3 className="font-display font-bold text-primary-deep mb-2">
                    Erziehungsberechtigte/r
                  </h3>
                  <Row label="Name" value={selected.guardian_name} />
                  <Row label="E-Mail" value={selected.guardian_email} />
                  <Row label="Telefon" value={selected.guardian_phone} />
                </section>
              )}

              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-display font-bold text-primary-deep">Familienangaben</h3>
                  {!editingFamily && (
                    <Button size="sm" variant="outline" onClick={() => setEditingFamily(true)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      {hasFamily ? "Bearbeiten" : "Hinzufügen"}
                    </Button>
                  )}
                </div>
                {editingFamily ? (
                  <FamilyEditor
                    value={fm}
                    onSave={saveFamily}
                    onCancel={() => setEditingFamily(false)}
                  />
                ) : hasFamily ? (
                  <>
                    {fm?.partner?.name && (
                      <Row
                        label="Partner/in"
                        value={`${fm.partner.name}${fm.partner.date_of_birth ? ` (geb. ${formatDateBerlin(fm.partner.date_of_birth)})` : ""} · ${genderLabel(fm.partner.gender) ?? "Geschlecht fehlt"}${fm.partner.email ? ` · ${fm.partner.email}` : ""}${fm.partner.phone ? ` · ${fm.partner.phone}` : ""}`}
                      />
                    )}
                    {(fm?.children || []).map((c, i) => (
                      <Row
                        key={i}
                        label={`Kind ${i + 1}`}
                        value={`${c.name}${c.date_of_birth ? ` (geb. ${formatDateBerlin(c.date_of_birth)})` : ""} · ${genderLabel(c.gender) ?? "Geschlecht fehlt"}${c.email ? ` · ${c.email}` : ""}${c.phone ? ` · ${c.phone}` : ""}`}
                      />
                    ))}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Keine Familienangaben hinterlegt.</p>
                )}
              </section>

              <section>
                <h3 className="font-display font-bold text-primary-deep mb-2">
                  SEPA-Lastschriftmandat
                </h3>
                <Row label="Kontoinhaber/in" value={selected.sepa_account_holder} />
                <Row label="IBAN" value={<span className="font-mono">{selected.sepa_iban}</span>} />
                <Row
                  label="BIC"
                  value={
                    selected.sepa_bic ? (
                      <span className="font-mono">{selected.sepa_bic}</span>
                    ) : null
                  }
                />
                <Row label="Kreditinstitut" value={selected.sepa_bank_name} />
                <Row
                  label="Ort, Datum"
                  value={`${selected.sepa_signature_place || "—"}, ${formatDateBerlin(selected.sepa_signature_date)}`}
                />
                <Row
                  label="Mandat erteilt"
                  value={selected.sepa_mandate_accepted ? "Ja" : "Nein"}
                />
              </section>

              <section>
                <h3 className="font-display font-bold text-primary-deep mb-2">Zustimmungen</h3>
                <Row label="Satzung" value={selected.accepted_statutes ? "Akzeptiert" : "Nein"} />
                <Row
                  label="Mitgliedsordnung"
                  value={selected.accepted_rules ? "Akzeptiert" : "Nein"}
                />
                <Row
                  label="Datenschutz"
                  value={selected.accepted_privacy ? "Akzeptiert" : "Nein"}
                />
                <Row label="Einwilligung am" value={formatDateBerlin(selected.consent_at)} />
              </section>

              <div className="flex flex-wrap gap-2 pt-2 border-t">
                {selected.status !== "active" && (
                  <Button variant="accent" onClick={() => setStatus(selected.id, "active")}>
                    Genehmigen
                  </Button>
                )}
                {selected.status !== "suspended" && (
                  <Button variant="outline" onClick={() => setStatus(selected.id, "suspended")}>
                    Pausieren
                  </Button>
                )}
                {selected.status !== "terminated" && (
                  <Button variant="outline" onClick={() => setStatus(selected.id, "terminated")}>
                    Ablehnen / Beenden
                  </Button>
                )}
                {selected.status === "pending" ? (
                  <Button
                    variant="ghost"
                    className="text-destructive"
                    title="Nur für Fehleinträge und Dubletten"
                    onClick={() => setDeleteFor(selected)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Antrag löschen …
                  </Button>
                ) : (
                  <span className="self-center text-xs text-muted-foreground">
                    Beendete Mitgliedschaften werden 3 Jahre nach „gültig bis“ automatisch gelöscht.
                  </span>
                )}
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelected(null);
                    setEditingFamily(false);
                  }}
                  className="ml-auto"
                >
                  Schließen
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
