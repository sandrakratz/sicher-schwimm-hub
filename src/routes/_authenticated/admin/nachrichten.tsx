import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Mail, Reply, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/nachrichten")({
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
          <MessageCard key={m.id} m={m} onStatus={updateStatus} onNotes={saveNotes} />
        ))}
      </div>
    </div>
  );
}

function MessageCard({ m, onStatus, onNotes }: { m: Msg; onStatus: (id: string, s: string) => void; onNotes: (id: string, n: string) => void }) {
  const [notes, setNotes] = useState(m.internal_notes || "");
  const replySubject = encodeURIComponent(`Re: ${m.subject || "Ihre Nachricht"}`);
  const replyBody = encodeURIComponent(`\n\n--- Ursprüngliche Nachricht ---\nVon: ${m.from_name} <${m.from_email}>\nGesendet: ${new Date(m.created_at).toLocaleString("de-DE")}\nBetreff: ${m.subject || "—"}\n\n${m.body}`);
  const mailto = `mailto:${m.from_email}?subject=${replySubject}&body=${replyBody}`;

  return (
    <Card className="border-0 shadow-soft">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{CATEGORY_LABEL[m.category] || m.category}</Badge>
              <Badge variant={m.status === "new" ? "default" : "outline"}>{STATUS_LABEL[m.status] || m.status}</Badge>
              <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("de-DE")}</span>
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
            <Button asChild size="sm" variant="default">
              <a href={mailto}><Reply className="h-4 w-4 mr-1" />Antworten</a>
            </Button>
          </div>
        </div>

        <div className="rounded-lg bg-muted/40 p-4">
          <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Mail className="h-3 w-3" />Nachricht</div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
        </div>

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
