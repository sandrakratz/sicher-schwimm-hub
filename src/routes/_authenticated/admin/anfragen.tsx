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
import { assignRequestToCourse, suggestMatchForRequest, unassignRequestFromCourse } from "@/lib/course-assignment.functions";
import { replyToCourseRequest } from "@/lib/course-requests.functions";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { formatDateBerlin, formatDateTimeBerlin } from "@/lib/format";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConversationTimeline } from "@/components/admin/ConversationTimeline";


const COURSE_GROUPS: { key: string; label: string; match: (v: string) => boolean }[] = [
  { key: "wassergewoehnung", label: "Wassergewöhnung", match: v => v.includes("wassergew") },
  { key: "schwimmen-lernen", label: "Schwimmen lernen", match: v => v.includes("schwimmen lernen") || v.includes("schwimmenlernen") },
  { key: "seepferdchen-vorbereitung", label: "Seepferdchen-Vorbereitung", match: v => v.includes("seepferdchen") && (v.includes("vorbereit") || v.includes("vorb")) },
  { key: "seepferdchen", label: "Seepferdchen", match: v => v.includes("seepferdchen") },
  { key: "bronze", label: "Bronze", match: v => v.includes("bronze") },
  { key: "silber", label: "Silber", match: v => v.includes("silber") },
  { key: "gold", label: "Gold", match: v => v.includes("gold") },
  { key: "sonstige", label: "Sonstige / Unbekannt", match: () => true },
];

function groupKeyFor(desired: string | null): string {
  const v = (desired || "").toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
  if (!v) return "sonstige";
  for (const g of COURSE_GROUPS) if (g.match(v)) return g.key;
  return "sonstige";
}


type Item = {
  id: string; created_at: string; status: string;
  parent_name: string; parent_email: string; parent_phone: string | null;
  child_name: string | null; child_dob: string | null; swimming_level: string | null;
  desired_course: string | null; health_info: string | null; message: string | null;
  gdpr_consent: boolean; contact_permission: boolean;
  assigned_course_id?: string | null;
};

type CourseOpt = { id: string; name: string; status: string; max_participants: number | null; starts_on: string | null; price_member: number | null; price_non_member: number | null };

type CourseInfo = { id: string; name: string; starts_on: string | null; ends_on: string | null };


export const Route = createFileRoute("/_authenticated/admin/anfragen")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/admin-guard.functions");
    const { redirect } = await import("@tanstack/react-router");
    try { await assertHasAnyRole({ data: { roles: ["admin", "board"] } }); }
    catch { throw redirect({ to: "/admin/benutzer" }); }
  },
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

const STATUS_CLASS: Record<string, string> = {
  new: "bg-green-600 hover:bg-green-700 text-white border-transparent",
  under_review: "bg-orange-500 hover:bg-orange-600 text-white border-transparent",
  contacted: "bg-blue-600 hover:bg-blue-700 text-white border-transparent",
  waiting_list: "bg-yellow-400 hover:bg-yellow-500 text-black border-transparent",
  accepted: "bg-teal-700 hover:bg-teal-800 text-white border-transparent",
  rejected: "bg-red-600 hover:bg-red-700 text-white border-transparent",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={STATUS_CLASS[status] || ""}>
      {STATUS_LABEL[status] || status}
    </Badge>
  );
}


function AnfragenAdmin() {
  const [rows, setRows] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [allCourses, setAllCourses] = useState<CourseInfo[]>([]);
  const [assignCourseId, setAssignCourseId] = useState<string>("");
  const [assignStatus, setAssignStatus] = useState<"confirmed" | "waiting">("confirmed");
  const [assignNotes, setAssignNotes] = useState("");
  const [sendMail, setSendMail] = useState(true);
  const [isMember, setIsMember] = useState<"yes" | "no" | "unknown">("unknown");
  const [parentUserId, setParentUserId] = useState<string>("");
  const [parentLabel, setParentLabel] = useState<string>("");
  const [priceAmount, setPriceAmount] = useState<string>("");
  const [priceTouched, setPriceTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [conversationReloadKey, setConversationReloadKey] = useState(0);

  const assignFn = useServerFn(assignRequestToCourse);
  const suggestFn = useServerFn(suggestMatchForRequest);
  const replyFn = useServerFn(replyToCourseRequest);
  const unassignFn = useServerFn(unassignRequestFromCourse);
  const [unassignStatus, setUnassignStatus] = useState<"waiting_list" | "new">("waiting_list");
  const [unassignBusy, setUnassignBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from("course_requests").select("*").order("created_at", { ascending: false });
    setRows((data as Item[]) || []);
    const { data: cs } = await supabase.from("courses").select("id,name,status,max_participants,starts_on,price_member,price_non_member").is("archived_at", null).order("starts_on", { ascending: true, nullsFirst: false });
    setCourses((cs as CourseOpt[]) || []);
    const { data: allCs } = await supabase.from("courses").select("id,name,starts_on,ends_on");
    setAllCourses((allCs as CourseInfo[]) || []);
  }
  useEffect(() => { load(); }, []);

  // Beim Öffnen einer Anfrage: Vorschläge holen
  useEffect(() => {
    if (!selected) return;
    setAssignCourseId(selected.assigned_course_id || "");
    setAssignStatus("confirmed");
    setAssignNotes("");
    setSendMail(true);
    setIsMember("unknown");
    setParentUserId("");
    setParentLabel("");
    setPriceAmount("");
    setPriceTouched(false);
    setReplySubject(`Rückfrage zu Ihrer Kursanfrage${selected.child_name ? ` – ${selected.child_name}` : ""}`);
    setReplyBody("");
    (async () => {
      try {
        const res = await suggestFn({ data: { email: selected.parent_email } });
        if (res.isMember === true) setIsMember("yes");
        else if (res.isMember === false) setIsMember("no");
        if (res.parentUserId) {
          setParentUserId(res.parentUserId);
          setParentLabel(res.parentLabel || "");
        }
      } catch {}
    })();
  }, [selected?.id]);

  // Preis automatisch aus Kurs + Mitgliedstatus ableiten (wenn nicht manuell überschrieben)
  useEffect(() => {
    if (priceTouched) return;
    const c = courses.find(x => x.id === assignCourseId);
    if (!c) { setPriceAmount(""); return; }
    if (isMember === "yes" && c.price_member != null) setPriceAmount(String(c.price_member));
    else if (isMember === "no" && c.price_non_member != null) setPriceAmount(String(c.price_non_member));
    else setPriceAmount("");
  }, [assignCourseId, isMember, courses, priceTouched]);

  async function setStatus(id: string, status: "new" | "contacted" | "accepted" | "rejected" | "under_review" | "waiting_list") {
    const { error } = await supabase.from("course_requests").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Aktualisiert"); setSelected(s => s && s.id === id ? { ...s, status } : s); load(); }
  }
  async function doAssign() {
    if (!selected || !assignCourseId) return toast.error("Bitte Kurs auswählen");
    setBusy(true);
    try {
      const priceNum = priceAmount.trim() ? Number(priceAmount.replace(",", ".")) : null;
      const res = await assignFn({ data: {
        requestId: selected.id,
        courseId: assignCourseId,
        status: assignStatus,
        sendEmail: sendMail,
        adminNotes: assignNotes || undefined,
        isMember: isMember === "yes" ? true : isMember === "no" ? false : null,
        parentUserId: parentUserId || null,
        priceAmount: priceNum != null && !Number.isNaN(priceNum) ? priceNum : null,
      }});
      toast.success(res.emailQueued ? "Eingebucht & E-Mail versendet" : "Eingebucht");
      setSelected(null);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Fehler");
    } finally { setBusy(false); }
  }

  async function doDelete(id: string) {
    if (!confirm("Diese Kursanfrage wirklich endgültig löschen?")) return;
    const { error } = await supabase.from("course_requests").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Anfrage gelöscht");
    setSelected(null);
    await load();
  }

  async function doReply() {
    if (!selected) return;
    if (replyBody.trim().length < 2) { toast.error("Bitte Nachricht eingeben"); return; }
    setReplyBusy(true);
    try {
      await replyFn({ data: { requestId: selected.id, body: replyBody, subject: replySubject } });
      toast.success("E-Mail gesendet – Status auf Kontaktiert gesetzt");
      setReplyBody("");
      setSelected(s => s ? { ...s, status: "contacted" } : s);
      setConversationReloadKey(k => k + 1);
      await load();

    } catch (e: any) {
      toast.error(e?.message || "E-Mail konnte nicht gesendet werden");
    } finally { setReplyBusy(false); }
  }


  const courseById = new Map(allCourses.map(c => [c.id, c]));
  function courseLabel(id: string | null | undefined) {
    if (!id) return null;
    const c = courseById.get(id);
    if (!c) return null;
    const period = [c.starts_on ? formatDateBerlin(c.starts_on) : null, c.ends_on ? formatDateBerlin(c.ends_on) : null]
      .filter(Boolean).join(" – ");
    return { name: c.name, period };
  }

  const grouped = COURSE_GROUPS
    .map(g => {
      const items = rows.filter(r => groupKeyFor(r.desired_course) === g.key);
      const rejected = items.filter(r => r.status === "rejected");
      const rest = items.filter(r => r.status !== "rejected");
      return {
        ...g,
        items,
        open: rest.filter(r => !r.assigned_course_id),
        assigned: rest.filter(r => !!r.assigned_course_id),
        rejected,
      };
    })
    .filter(g => g.items.length > 0);
  const openGroups = grouped.map(g => g.key);

  function RequestTable({ items, mode }: { items: Item[]; mode: "open" | "assigned" | "rejected" }) {
    if (items.length === 0) {
      return (
        <div className="px-4 py-6 text-sm text-muted-foreground text-center">
          {mode === "open"
            ? "Keine offenen Anfragen in dieser Kategorie."
            : mode === "assigned"
              ? "Noch keine Anfrage einem Kurs zugewiesen."
              : "Keine abgelehnten Anfragen."}
        </div>
      );
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Datum</TableHead>
            <TableHead>Eltern</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>{mode === "assigned" ? "Zugewiesener Kurs" : "Wunschkurs"}</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(r => {
            const cl = mode === "assigned" ? courseLabel(r.assigned_course_id) : null;
            return (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                <TableCell className="text-xs">{formatDateBerlin(r.created_at)}</TableCell>
                <TableCell>
                  <div className="font-semibold">{r.parent_name}</div>
                  <div className="text-xs text-muted-foreground">{r.parent_email}</div>
                </TableCell>
                <TableCell>{r.child_name || "—"}</TableCell>
                <TableCell>
                  {mode === "assigned" ? (
                    cl ? (
                      <div>
                        <div className="font-medium">{cl.name}</div>
                        {cl.period && <div className="text-xs text-muted-foreground">{cl.period}</div>}
                      </div>
                    ) : "—"
                  ) : (r.desired_course || "—")}
                </TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelected(r); }}>Details</Button></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-3xl font-bold text-primary-deep mb-6">Kursanfragen</h1>
      {rows.length === 0 ? (
        <Card className="border-0 shadow-soft"><CardContent className="text-center text-muted-foreground py-10">Noch keine Anfragen.</CardContent></Card>
      ) : (
        <Accordion type="multiple" defaultValue={openGroups} className="space-y-3">
          {grouped.map(g => (
            <AccordionItem key={g.key} value={g.key} className="border-0">
              <Card className="border-0 shadow-soft">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="font-display text-lg font-semibold text-primary-deep">{g.label}</span>
                    <Badge variant="secondary">{g.open.length} offen</Badge>
                    <Badge variant="outline">{g.assigned.length} zugewiesen</Badge>
                    {g.rejected.length > 0 && <Badge variant="destructive">{g.rejected.length} abgelehnt</Badge>}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="p-0">
                    <Tabs defaultValue="open">
                      <div className="px-4 pb-2">
                        <TabsList>
                          <TabsTrigger value="open">Aktuelle Anfragen ({g.open.length})</TabsTrigger>
                          <TabsTrigger value="assigned">Zugewiesene Anfragen ({g.assigned.length})</TabsTrigger>
                          <TabsTrigger value="rejected">Abgelehnt ({g.rejected.length})</TabsTrigger>
                        </TabsList>
                      </div>
                      <TabsContent value="open"><RequestTable items={g.open} mode="open" /></TabsContent>
                      <TabsContent value="assigned"><RequestTable items={g.assigned} mode="assigned" /></TabsContent>
                      <TabsContent value="rejected"><RequestTable items={g.rejected} mode="rejected" /></TabsContent>
                    </Tabs>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>
          ))}
        </Accordion>
      )}



      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Kursanfrage</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <Row label="Eingegangen" value={formatDateTimeBerlin(selected.created_at)} />
              <Row label="Status" value={<StatusBadge status={selected.status} />} />
              {selected.assigned_course_id && (() => {
                const cl = courseLabel(selected.assigned_course_id);
                return <Row label="Zugewiesener Kurs" value={cl ? `${cl.name}${cl.period ? ` (${cl.period})` : ""}` : "—"} />;
              })()}
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
              <ConversationTimeline
                kind="course-request"
                id={selected.id}
                original={{
                  title: `Kursanfrage${selected.child_name ? ` – ${selected.child_name}` : ""}`,
                  when: selected.created_at,
                  from: `${selected.parent_name} <${selected.parent_email}>`,
                  body: [
                    selected.desired_course ? `Gewünschter Kurs: ${selected.desired_course}` : null,
                    selected.swimming_level ? `Schwimmlevel: ${selected.swimming_level}` : null,
                    selected.message ? `\n${selected.message}` : null,
                  ].filter(Boolean).join("\n"),
                }}
                reloadKey={conversationReloadKey}
              />

              <hr />
              <h3 className="font-semibold">Rückfrage per E-Mail senden</h3>

              <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">
                  Sendet eine E-Mail an {selected.parent_email} und setzt den Status automatisch auf „Kontaktiert".
                </p>
                <div>
                  <Label>Betreff</Label>
                  <Input value={replySubject} onChange={e => setReplySubject(e.target.value)} maxLength={300} />
                </div>
                <div>
                  <Label>Nachricht</Label>
                  <Textarea rows={6} value={replyBody} onChange={e => setReplyBody(e.target.value)} placeholder="Ihre Rückfrage an die Eltern …" />
                </div>
                <Button variant="default" onClick={doReply} disabled={replyBusy || replyBody.trim().length < 2}>
                  {replyBusy ? "Wird gesendet …" : "E-Mail senden & als Kontaktiert markieren"}
                </Button>
              </div>

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
                          {c.name}{c.starts_on ? ` · ab ${formatDateBerlin(c.starts_on)}` : ""}
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Mitglied?</Label>
                    <Select value={isMember} onValueChange={(v: any) => { setIsMember(v); setPriceTouched(false); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Ja, Mitglied</SelectItem>
                        <SelectItem value="no">Nein</SelectItem>
                        <SelectItem value="unknown">Unklar / prüfen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Kursgebühr (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={priceAmount}
                      onChange={e => { setPriceAmount(e.target.value); setPriceTouched(true); }}
                      placeholder="z.B. 150"
                    />
                  </div>
                </div>
                <div>
                  <Label>Elternkonto verknüpfen</Label>
                  {parentUserId ? (
                    <div className="flex items-center gap-2 text-xs mt-1">
                      <Badge className="bg-green-600 hover:bg-green-700">verknüpft</Badge>
                      <span>{parentLabel || parentUserId}</span>
                      <Button variant="ghost" size="sm" onClick={() => { setParentUserId(""); setParentLabel(""); }}>Entfernen</Button>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground mt-1">
                      Kein passendes Eltern-Konto gefunden. Sobald sich das Elternteil mit „{selected.parent_email}" registriert, wird der Kurs automatisch verknüpft.
                    </div>
                  )}
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

          {selected && (
            <p className="text-xs text-muted-foreground">
              Hinweis: „Ablehnen“ setzt den Teilnehmer automatisch auf die Sperrliste – eine Direktbuchung über die
              Website ist dann nicht mehr möglich, nur noch eine Anfrage zur Einzelfallprüfung.
            </p>
          )}

          <DialogFooter className="flex-wrap gap-2">
            {selected && <>
              <Button variant="outline" onClick={() => setStatus(selected.id, "contacted")}>Kontaktiert</Button>
              <Button variant="outline" onClick={() => setStatus(selected.id, "waiting_list")}>Warteliste</Button>
              <Button variant="accent" onClick={() => setStatus(selected.id, "accepted")}>Akzeptieren</Button>
              <Button variant="destructive" onClick={() => setStatus(selected.id, "rejected")}>Ablehnen</Button>
              <Button variant="destructive" onClick={() => doDelete(selected.id)}>Löschen</Button>
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
