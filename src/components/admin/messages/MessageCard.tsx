import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Reply, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTimeBerlin } from "@/lib/format";
import { replyToMessage } from "@/lib/messages.functions";
import { ConversationTimeline } from "@/components/admin/ConversationTimeline";
import { AgeBadge } from "@/components/admin/AgeBadge";
import { AssignControl } from "@/components/admin/AssignControl";

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
  courses: "Kurs",
  feedback: "Feedback",
  complaint: "Beschwerde",
  other: "Sonstiges",
};

/** Nachricht aus dem Kontaktformular (öffentlich oder Portal). */
export type Msg = {
  id: string;
  from_name: string;
  from_email: string;
  category: string;
  subject: string | null;
  body: string;
  status: string;
  internal_notes: string | null;
  assigned_to: string | null;
  created_at: string;
};

/** Noch nicht beantwortet = Status „neu“ oder „gelesen“. */
export const isOpenMessage = (m: Msg) => ["new", "read"].includes(m.status);

/** Nachrichten laden und bearbeiten. Gemeinsam für Posteingang und Eingang. */
export function useMessages() {
  const [rows, setRows] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data as Msg[]) || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("messages").update({ status }).eq("id", id);
    if (error) return void toast.error("Fehler beim Speichern");
    setRows((r) => r.map((m) => (m.id === id ? { ...m, status } : m)));
    toast.success("Status aktualisiert");
  }

  async function saveNotes(id: string, internal_notes: string) {
    const { error } = await supabase.from("messages").update({ internal_notes }).eq("id", id);
    if (error) return void toast.error("Fehler beim Speichern");
    setRows((r) => r.map((m) => (m.id === id ? { ...m, internal_notes } : m)));
    toast.success("Notiz gespeichert");
  }

  async function deleteMsg(id: string) {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) return void toast.error("Fehler beim Löschen");
    setRows((r) => r.filter((m) => m.id !== id));
    toast.success("Nachricht gelöscht");
  }

  const assigned = (id: string, assignee: string | null) =>
    setRows((r) => r.map((m) => (m.id === id ? { ...m, assigned_to: assignee } : m)));

  return { rows, loading, load, updateStatus, saveNotes, deleteMsg, assigned };
}

export type Messages = ReturnType<typeof useMessages>;

/** Eine Nachricht, eingeklappt wie im E-Mail-Programm; aufgeklappt mit Verlauf, Antwort, Notiz. */
export function MessageCard({
  m,
  msgs,
  showAge,
  defaultOpen = false,
}: {
  m: Msg;
  msgs: Messages;
  showAge?: boolean;
  defaultOpen?: boolean;
}) {
  const [notes, setNotes] = useState(m.internal_notes || "");
  const [replyOpen, setReplyOpen] = useState(false);
  const [replySubject, setReplySubject] = useState(`Re: ${m.subject || "Ihre Nachricht"}`);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [open, setOpen] = useState(defaultOpen);
  const unread = m.status === "new";

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread) void msgs.updateStatus(m.id, "read");
  }

  async function sendReply() {
    if (replyBody.trim().length < 2) {
      toast.error("Bitte Antworttext eingeben");
      return;
    }
    setSending(true);
    try {
      await replyToMessage({ data: { messageId: m.id, body: replyBody, subject: replySubject } });
      toast.success("Antwort gesendet");
      setReplyOpen(false);
      setReplyBody("");
      void msgs.updateStatus(m.id, "replied");
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Antwort konnte nicht gesendet werden");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className={`border-0 shadow-soft ${unread ? "border-l-4 border-l-accent" : ""}`}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="flex min-w-0 flex-1 items-start gap-2 text-left"
          >
            {open ? (
              <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={m.category === "complaint" ? "destructive" : "outline"}>
                  {CATEGORY_LABEL[m.category] || m.category}
                </Badge>
                <Badge variant={unread ? "default" : "outline"}>
                  {STATUS_LABEL[m.status] || m.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDateTimeBerlin(m.created_at)}
                </span>
                {showAge && isOpenMessage(m) && <AgeBadge since={m.created_at} />}
              </div>
              <div
                className={`mt-1 truncate ${unread ? "font-bold text-primary-deep" : "font-medium"}`}
              >
                {m.subject || "(Kein Betreff)"}
              </div>
              <div className="truncate text-sm text-muted-foreground">
                {m.from_name} · {m.from_email}
                {!open && m.body ? ` — ${m.body.replace(/\s+/g, " ").slice(0, 90)}` : ""}
              </div>
            </div>
          </button>
          <AssignControl
            kind="message"
            id={m.id}
            area="messages"
            current={m.assigned_to}
            label={`Nachricht von ${m.from_name}${m.subject ? `: ${m.subject}` : ""}`}
            onDone={(a) => msgs.assigned(m.id, a)}
          />
          <div className={`items-center gap-2 ${open ? "flex" : "hidden"}`}>
            <Select value={m.status} onValueChange={(v) => void msgs.updateStatus(m.id, v)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Neu</SelectItem>
                <SelectItem value="read">Gelesen</SelectItem>
                <SelectItem value="replied">Beantwortet</SelectItem>
                <SelectItem value="archived">Archiviert</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="default" onClick={() => setReplyOpen(true)}>
              <Reply className="h-4 w-4 mr-1" />
              Antworten
            </Button>
            {m.from_email && (
              <Button asChild size="sm" variant="outline">
                <Link to="/admin/familie" search={{ email: m.from_email }}>
                  Familie öffnen
                </Link>
              </Button>
            )}
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
                    <Input
                      id={`subj-${m.id}`}
                      value={replySubject}
                      onChange={(e) => setReplySubject(e.target.value)}
                      maxLength={300}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`body-${m.id}`}>Nachricht</Label>
                    <Textarea
                      id={`body-${m.id}`}
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      rows={8}
                      placeholder="Ihre Antwort …"
                    />
                  </div>
                  <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                    <div className="font-semibold mb-1">Ursprüngliche Nachricht:</div>
                    <div className="whitespace-pre-wrap">{m.body}</div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setReplyOpen(false)} disabled={sending}>
                    Abbrechen
                  </Button>
                  <Button onClick={sendReply} disabled={sending}>
                    {sending ? "Wird gesendet …" : "Senden"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-destructive">
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Löschen …
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Nachricht löschen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Diese Nachricht von {m.from_name} wird endgültig entfernt. Diese Aktion kann
                    nicht rückgängig gemacht werden.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void msgs.deleteMsg(m.id)}>
                    Löschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {open && (
          <>
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
              <label
                htmlFor={`notes-${m.id}`}
                className="text-xs uppercase tracking-wider font-semibold text-muted-foreground"
              >
                Interne Notizen
              </label>
              <Textarea
                id={`notes-${m.id}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1"
                placeholder="Nur für Admins sichtbar …"
              />
              <div className="flex justify-end mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void msgs.saveNotes(m.id, notes)}
                  disabled={notes === (m.internal_notes || "")}
                >
                  Notiz speichern
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
