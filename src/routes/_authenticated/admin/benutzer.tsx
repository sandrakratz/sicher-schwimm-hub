import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { deleteUser } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/admin/benutzer")({
  component: Page,
});

const ROLES = ["admin", "board", "trainer", "member", "parent"] as const;
type Role = typeof ROLES[number];
const STATUSES = ["pending", "active", "disabled", "archived"] as const;
type Status = typeof STATUSES[number];

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  board: "Vorstand",
  trainer: "Trainer/in",
  member: "Mitglied",
  parent: "Elternteil",
};

const STATUS_LABEL: Record<Status, string> = {
  pending: "Wartet auf Freigabe",
  active: "Aktiv",
  disabled: "Deaktiviert",
  archived: "Archiviert",
};

const STATUS_COLOR: Record<Status, string> = {
  pending: "bg-amber-100 text-amber-900",
  active: "bg-emerald-100 text-emerald-900",
  disabled: "bg-zinc-200 text-zinc-700",
  archived: "bg-zinc-200 text-zinc-700",
};

type Profile = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  status: Status;
  created_at: string;
};

function Page() {
  const [rows, setRows] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Record<string, Role[]>>({});
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: profiles }, { data: ur }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    setRows((profiles as Profile[]) || []);
    const map: Record<string, Role[]> = {};
    (ur || []).forEach((r: any) => {
      map[r.user_id] = [...(map[r.user_id] || []), r.role];
    });
    setRoles(map);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: Status) {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status aktualisiert");
    await load();
    setSelected(s => s && s.id === id ? { ...s, status } : s);
  }

  async function toggleRole(userId: string, role: Role, has: boolean) {
    if (has) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) return toast.error(error.message);
    }
    toast.success("Rolle aktualisiert");
    await load();
  }

  const filtered = rows.filter(r => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [r.email, r.first_name, r.last_name].filter(Boolean).join(" ").toLowerCase().includes(q);
  });

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary-deep">Benutzerverwaltung</h1>
          <p className="text-muted-foreground mt-1 text-sm">Konten, Status und Rollen verwalten.</p>
        </div>
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Suche nach Name oder E-Mail…" className="max-w-xs" />
      </div>

      <Card className="border-0 shadow-soft">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rollen</TableHead>
                <TableHead>Registriert</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Lade…</TableCell></TableRow>}
              {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Keine Benutzer gefunden.</TableCell></TableRow>}
              {filtered.map(p => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => setSelected(p)}>
                  <TableCell className="font-medium">{[p.first_name, p.last_name].filter(Boolean).join(" ") || "—"}</TableCell>
                  <TableCell className="text-sm">{p.email}</TableCell>
                  <TableCell><Badge className={STATUS_COLOR[p.status]} variant="secondary">{p.status}</Badge></TableCell>
                  <TableCell className="text-xs">{(roles[p.id] || []).join(", ") || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("de-DE")}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm">Details</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{[selected.first_name, selected.last_name].filter(Boolean).join(" ") || selected.email}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-sm grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">E-Mail:</span> {selected.email}</div>
                  <div><span className="text-muted-foreground">Telefon:</span> {selected.phone || "—"}</div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Status</div>
                  <div className="flex flex-wrap gap-2">
                    {STATUSES.map(s => (
                      <Button key={s} size="sm" variant={selected.status === s ? "default" : "outline"} onClick={() => setStatus(selected.id, s)}>{s}</Button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Rollen</div>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map(r => {
                      const has = (roles[selected.id] || []).includes(r);
                      return (
                        <label key={r} className="flex items-center gap-2 text-sm border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/50">
                          <Checkbox checked={has} onCheckedChange={() => toggleRole(selected.id, r, has)} />
                          <span className="capitalize">{r}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>Schließen</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
