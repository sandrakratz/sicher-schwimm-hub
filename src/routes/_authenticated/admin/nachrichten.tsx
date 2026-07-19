import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Mail, Reply, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTimeBerlin } from "@/lib/format";
import { replyToMessage } from "@/lib/messages.functions";
import { ConversationTimeline } from "@/components/admin/ConversationTimeline";


export const Route = createFileRoute("/_authenticated/admin/nachrichten")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/admin-guard.functions");
    const { redirect } = await import("@tanstack/react-router");
    try { await assertHasAnyRole({ data: { roles: ["admin", "board"] } }); }
    catch { throw redirect({ to: "/admin/benutzer" }); }
  },
  component: Page,
});

const STATUS_LABEL: Record<string, string> = {
  new: "Neu",
  read: "Gelesen",
  replied: "Beantwortet",
  archived: "Archiviert",
};

const CATEGORY_LABEL: Record<string, string> = {
  general: "Allgemein",
  membership: "Mitgliedschaft",
  course: "Kurs",
  feedback: "Feedback",
  complaint: "Beschwerde",
  other: "Sonstiges",
};

type Msg = {
  id: string;
  from_name: string;
  from_email: string;
  category: string;
  subject: string | null;
  body: string;
  status: string;
  internal_notes: string | null;
  created_at: string;
};

function Page() {
  const [rows, setRows] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("messages").select("*").order("created_at", { ascending: false });
    setRows((data as Msg[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("messages").update({ status }).eq("id", id);
    if (error) return toast.error("Fehler beim Speichern");
    setRows(r => r.map(m => m.id === id ? { ...m, status } : m));
    toast.success("Status aktualisiert");
  }

  async function saveNotes(id: string, internal_notes: string) {
    const { error } = await supabase.from("messages").update({ internal_notes }).eq("id", id);
    if (error) return toast.error("Fehler beim Speichern");
    setRows(r => r.map(m => m.id === id ? { ...m, internal_notes } : m));
    toast.success("Notiz gespeichert");
  }

  async function deleteMsg(id: string) {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) return toast.error("Fehler beim Löschen");
    setRows(r => r.filter(m => m.id !== id));
    toast.success("Nachricht gelöscht");
  }


  const filtered = filter === "all" ? rows : rows.filter(m => m.status === filter);

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-3xl font-bold text-primary-deep">Nachrichten</h1>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="new">Neu</SelectItem>
            <SelectItem value="read">Gelesen</SelectItem>
            <SelectItem value="replied">Beantwortet</SelectItem>
            <SelectItem value="archived">Archiviert</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && <p className="text-muted-foreground text-sm">Lade …</p>}
      {!loading && filtered.length === 0 && (
        <Card className="border-0 shadow-soft"><CardContent className="p-10 text-center text-muted-foreground">Keine Nachrichten.</CardContent></Card>
      )}

      <div className="space-y-4">
        {filtered.map(m => (
          <MessageCard key={m.id} m={m} onStatus={updateStatus} onNotes={saveNotes} onDelete={deleteMsg} />
        ))}
      </div>
    </div>
  );
}

function MessageCard({ m, onStatus, onNotes, onDelete }: { m: Msg; onStatus: (id: string, s: string) => void; onNotes: (id: string, n: string) => void; onDelete: (id: string) => void }) {
  const [notes, setNotes] = useState(m.internal_notes || "");
  const [replyOpen, setReplyOpen] = useState(false);
  const [replySubject, setReplySubject] = useState(`Re: ${m.subject || "Ihre Nachricht"}`);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  async function sendReply() {
    if (replyBody.trim().length < 2) { toast.error("Bitte Antworttext eingeben"); return; }
    setSending(true);
    try {
      await replyToMessage({ data: { messageId: m.id, body: replyBody, subject: replySubject } });
      toast.success("Antwort gesendet");
      setReplyOpen(false);
      setReplyBody("");
      onStatus(m.id, "replied");
      setReloadKey(k => k + 1);
    } catch (e: any) {
      toast.error(e?.message || "Antwort konnte nicht gesendet werden");
    } finally {
      setSending(false);
    }
  }


  return (
    <Card className="border-0 shadow-soft">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{CATEGORY_LABEL[m.category] || m.category}</Badge>
              <Badge variant={m.status === "new" ? "default" : "outline"}>{STATUS_LABEL[m.status] || m.status}</Badge>
              <span className="text-xs text-muted-foreground">{formatDateTimeBerlin(m.created_at)}</span>
            </div>
            <h2 className="font-display text-xl font-bold text-primary-deep mt-2">{m.subject || "(Kein Betreff)"}</h2>
            <div className="text-sm mt-1">
              <span className="font-semibold">{m.from_name}</span>{" "}
              <a href={`mailto:${m.from_email}`} className="text-accent hover:underline">&lt;{m.from_email}&gt;</a>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={m.status} onValueChange={(v) => onStatus(m.id, v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Neu</SelectItem>
                <SelectItem value="read">Gelesen</SelectItem>
                <SelectItem value="replied">Beantwortet</SelectItem>
                <SelectItem value="archived">Archiviert</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="default" onClick={() => setReplyOpen(true)}>
              <Reply className="h-4 w-4 mr-1" />Antworten
            </Button>
            <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Antwort an {m.from_name}</DialogTitle>
                  <DialogDescription>
                    Die Antwort wird direkt per E-Mail an {m.from_email} gesendet.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor={`subj-${m.id}`}>Betreff</Label>
                    <Input id={`subj-${m.id}`} value={replySubject} onChange={(e) => setReplySubject(e.target.value)} maxLength={300} />
                  </div>
                  <div>
                    <Label htmlFor={`body-${m.id}`}>Nachricht</Label>
                    <Textarea id={`body-${m.id}`} value={replyBody} onChange={(e) => setReplyBody(e.target.value)} rows={8} placeholder="Ihre Antwort …" />
                  </div>
                  <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                    <div className="font-semibold mb-1">Ursprüngliche Nachricht:</div>
                    <div className="whitespace-pre-wrap">{m.body}</div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setReplyOpen(false)} disabled={sending}>Abbrechen</Button>
                  <Button onClick={sendReply} disabled={sending}>{sending ? "Wird gesendet …" : "Senden"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" aria-label="Nachricht löschen"><Trash2 className="h-4 w-4" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Nachricht löschen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Diese Nachricht von {m.from_name} wird endgültig entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(m.id)}>Löschen</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>


        <ConversationTimeline
          kind="message"
          id={m.id}
          original={{
            title: m.subject || "(Kein Betreff)",
            when: m.created_at,
            from: `${m.from_name} <${m.from_email}>`,
            body: m.body,
          }}
          reloadKey={reloadKey}
        />


        <div>
          <label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Interne Notizen</label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-1" placeholder="Nur für Admins sichtbar …" />
          <div className="flex justify-end mt-2">
            <Button size="sm" variant="outline" onClick={() => onNotes(m.id, notes)} disabled={notes === (m.internal_notes || "")}>Notiz speichern</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
