import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useServerFn } from "@tanstack/react-start";
import { assignRequestToCourse, suggestMatchForRequest } from "@/lib/course-assignment.functions";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";


type Item = {
  id: string; created_at: string; status: string;
  parent_name: string; parent_email: string; parent_phone: string | null;
  child_name: string | null; child_dob: string | null; swimming_level: string | null;
  desired_course: string | null; health_info: string | null; message: string | null;
  gdpr_consent: boolean; contact_permission: boolean;
  assigned_course_id?: string | null;
};

type CourseOpt = { id: string; name: string; status: string; max_participants: number | null; starts_on: string | null };


export const Route = createFileRoute("/_authenticated/admin/anfragen")({
  component: AnfragenAdmin,
});

const STATUS_LABEL: Record<string, string> = {
  new: "Neu",
  under_review: "In Prüfung",
  contacted: "Kontaktiert",
  waiting_list: "Warteliste",
  accepted: "Akzeptiert",
  rejected: "Abgelehnt",
};

function AnfragenAdmin() {
  const [rows, setRows] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [assignCourseId, setAssignCourseId] = useState<string>("");
  const [assignStatus, setAssignStatus] = useState<"confirmed" | "waiting">("confirmed");
  const [assignNotes, setAssignNotes] = useState("");
  const [sendMail, setSendMail] = useState(true);
  const [busy, setBusy] = useState(false);
  const assignFn = useServerFn(assignRequestToCourse);

  async function load() {
    const { data } = await supabase.from("course_requests").select("*").order("created_at", { ascending: false });
    setRows((data as Item[]) || []);
    const { data: cs } = await supabase.from("courses").select("id,name,status,max_participants,starts_on").order("starts_on", { ascending: true, nullsFirst: false });
    setCourses((cs as CourseOpt[]) || []);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (selected) {
      setAssignCourseId(selected.assigned_course_id || "");
      setAssignStatus("confirmed");
      setAssignNotes("");
      setSendMail(true);
    }
  }, [selected?.id]);
  async function setStatus(id: string, status: "new" | "contacted" | "accepted" | "rejected" | "under_review" | "waiting_list") {
    const { error } = await supabase.from("course_requests").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Aktualisiert"); setSelected(s => s && s.id === id ? { ...s, status } : s); load(); }
  }
  async function doAssign() {
    if (!selected || !assignCourseId) return toast.error("Bitte Kurs auswählen");
    setBusy(true);
    try {
      const res = await assignFn({ data: {
        requestId: selected.id,
        courseId: assignCourseId,
        status: assignStatus,
        sendEmail: sendMail,
        adminNotes: assignNotes || undefined,
      }});
      toast.success(res.emailQueued ? "Eingebucht & E-Mail versendet" : "Eingebucht");
      setSelected(null);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Fehler");
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-3xl font-bold text-primary-deep mb-6">Kursanfragen</h1>
      <Card className="border-0 shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Eltern</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Kurs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">Noch keine Anfragen.</TableCell></TableRow>}
              {rows.map(r => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                  <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString("de-DE")}</TableCell>
                  <TableCell>
                    <div className="font-semibold">{r.parent_name}</div>
                    <div className="text-xs text-muted-foreground">{r.parent_email}</div>
                  </TableCell>
                  <TableCell>{r.child_name || "—"}</TableCell>
                  <TableCell>{r.desired_course || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{STATUS_LABEL[r.status] || r.status}</Badge></TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelected(r); }}>Details</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Kursanfrage</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <Row label="Eingegangen" value={new Date(selected.created_at).toLocaleString("de-DE")} />
              <Row label="Status" value={<Badge variant="outline">{STATUS_LABEL[selected.status] || selected.status}</Badge>} />
              <hr />
              <h3 className="font-semibold">Eltern / Erziehungsberechtigte</h3>
              <Row label="Name" value={selected.parent_name} />
              <Row label="E-Mail" value={<a className="text-primary underline" href={`mailto:${selected.parent_email}`}>{selected.parent_email}</a>} />
              <Row label="Telefon" value={selected.parent_phone || "—"} />
              <hr />
              <h3 className="font-semibold">Kind</h3>
              <Row label="Name" value={selected.child_name || "—"} />
              <Row label="Geburtsdatum" value={selected.child_dob || "—"} />
              <Row label="Schwimmlevel" value={selected.swimming_level || "—"} />
              <hr />
              <h3 className="font-semibold">Wunsch</h3>
              <Row label="Gewünschter Kurs" value={selected.desired_course || "—"} />
              <Row label="Gesundheit" value={selected.health_info || "—"} />
              <Row label="Nachricht" value={<span className="whitespace-pre-wrap">{selected.message || "—"}</span>} />
              <hr />
              <Row label="Datenschutz akzeptiert" value={selected.gdpr_consent ? "Ja" : "Nein"} />
              <Row label="Kontakt erlaubt" value={selected.contact_permission ? "Ja" : "Nein"} />

              <hr />
              <h3 className="font-semibold">In Kurs einbuchen</h3>
              <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                <div>
                  <Label>Kurs auswählen</Label>
                  <Select value={assignCourseId} onValueChange={setAssignCourseId}>
                    <SelectTrigger><SelectValue placeholder="Kurs wählen…" /></SelectTrigger>
                    <SelectContent>
                      {courses.length === 0 && <div className="p-2 text-xs text-muted-foreground">Keine Kurse vorhanden.</div>}
                      {courses.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{c.starts_on ? ` · ab ${new Date(c.starts_on).toLocaleDateString("de-DE")}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Status</Label>
                    <Select value={assignStatus} onValueChange={(v: any) => setAssignStatus(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="confirmed">Bestätigt</SelectItem>
                        <SelectItem value="waiting">Warteliste</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-end gap-2 text-sm pb-2">
                    <Checkbox checked={sendMail} onCheckedChange={v => setSendMail(!!v)} />
                    Bestätigungs-E-Mail an Eltern senden
                  </label>
                </div>
                <div>
                  <Label>Persönliche Nachricht (optional, wird in die E-Mail aufgenommen)</Label>
                  <Textarea rows={3} value={assignNotes} onChange={e => setAssignNotes(e.target.value)} placeholder="z.B. Hinweise zur ersten Stunde, Treffpunkt, Mitzubringendes…" />
                </div>
                <Button variant="accent" onClick={doAssign} disabled={busy || !assignCourseId}>
                  {busy ? "Wird gespeichert…" : (sendMail ? "Einbuchen & E-Mail senden" : "Einbuchen")}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2">
            {selected && <>
              <Button variant="outline" onClick={() => setStatus(selected.id, "contacted")}>Kontaktiert</Button>
              <Button variant="outline" onClick={() => setStatus(selected.id, "waiting_list")}>Warteliste</Button>
              <Button variant="accent" onClick={() => setStatus(selected.id, "accepted")}>Akzeptieren</Button>
              <Button variant="destructive" onClick={() => setStatus(selected.id, "rejected")}>Ablehnen</Button>
              <Button variant="ghost" onClick={() => setSelected(null)}>Schließen</Button>
            </>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-2"><div className="text-muted-foreground">{label}</div><div className="col-span-2">{value}</div></div>;
}
