import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Reply, Trash2 } from "lucide-react";
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
import { InboxItemCard } from "@/components/admin/InboxItemCard";
import { listInbox, type InboxItem, type InboxSummary } from "@/lib/inbox.functions";
import { AgeBadge } from "@/components/admin/AgeBadge";

export const Route = createFileRoute("/_authenticated/admin/nachrichten")({
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
  const [tab, setTab] = useState<"open" | "done">("open");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data as Msg[]) || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("messages").update({ status }).eq("id", id);
    if (error) return toast.error("Fehler beim Speichern");
    setRows((r) => r.map((m) => (m.id === id ? { ...m, status } : m)));
    toast.success("Status aktualisiert");
  }

  async function saveNotes(id: string, internal_notes: string) {
    const { error } = await supabase.from("messages").update({ internal_notes }).eq("id", id);
    if (error) return toast.error("Fehler beim Speichern");
    setRows((r) => r.map((m) => (m.id === id ? { ...m, internal_notes } : m)));
    toast.success("Notiz gespeichert");
  }

  async function deleteMsg(id: string) {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) return toast.error("Fehler beim Löschen");
    setRows((r) => r.filter((m) => m.id !== id));
    toast.success("Nachricht gelöscht");
  }

  // Kursanfragen und Anmeldungen mit Anmerkung der Eltern aus dem gemeinsamen Posteingang
  const [inbox, setInbox] = useState<InboxItem[] | null>(null);
  const [summary, setSummary] = useState<InboxSummary | null>(null);
  useEffect(() => {
    listInbox()
      .then((r) => {
        setInbox(r.items);
        setSummary(r.summary);
      })
      .catch(() => setInbox([]));
  }, []);

  const doneMsgs = rows.filter((m) => !["new", "read"].includes(m.status));
  const requests = (inbox ?? []).filter((i) => i.source === "course-request");
  const withNote = (inbox ?? []).filter((i) => i.source === "waitlist");

  // „Antworten nötig“: unbeantwortete Nachrichten und neue Kursanfragen. Beschwerden zuerst, danach
  // die am längsten wartenden zuerst.
  const needReply = [
    ...rows
      .filter((m) => ["new", "read"].includes(m.status))
      .map((m) => ({
        key: `msg-${m.id}`,
        when: m.created_at,
        prio: m.category === "complaint" ? 0 : 1,
        node: (
          <MessageCard
            key={`msg-${m.id}`}
            m={m}
            showAge
            onStatus={updateStatus}
            onNotes={saveNotes}
            onDelete={deleteMsg}
          />
        ),
      })),
    ...requests.map((i) => ({
      key: `${i.source}-${i.id}`,
      when: i.created_at,
      prio: 1,
      node: <InboxItemCard key={`${i.source}-${i.id}`} item={i} showAge />,
    })),
  ].sort((a, b) => a.prio - b.prio || a.when.localeCompare(b.when));

  const loaded = !loading && inbox !== null;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary-deep">Posteingang</h1>
        <p className="text-sm text-muted-foreground">
          Hier steht, was Ihre Antwort braucht. Anmeldungen laufen automatisch und stehen nur dann
          einzeln da, wenn die Eltern etwas dazugeschrieben haben.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        <Button
          size="sm"
          variant={tab === "open" ? "default" : "outline"}
          onClick={() => setTab("open")}
        >
          Offen ({loaded ? needReply.length + withNote.length : "…"})
        </Button>
        <Button
          size="sm"
          variant={tab === "done" ? "default" : "outline"}
          onClick={() => setTab("done")}
        >
          Erledigt ({loading ? "…" : doneMsgs.length})
        </Button>
      </div>

      {!loaded && <p className="text-sm text-muted-foreground">Lade …</p>}

      {loaded && tab === "open" && (
        <>
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-primary-deep">
              Antworten nötig ({needReply.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Kontaktformular und neue Kursanfragen. Beschwerden stehen oben, danach die am längsten
              wartenden.
            </p>
            {needReply.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
                Alles beantwortet.
              </div>
            ) : (
              <div className="space-y-4">{needReply.map((c) => c.node)}</div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-primary-deep">Anmeldungen</h2>
            <div className="rounded-xl border bg-card p-4 text-sm">
              {summary ? (
                <>
                  <p>
                    <strong>{summary.automatic}</strong> Anmeldungen der letzten 30 Tage laufen
                    automatisch weiter ({summary.offered} mit Platzangebot,{" "}
                    {summary.waiting - summary.withNote} wartend ohne Anmerkung). Dazu müssen Sie
                    nichts tun.
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-3">
                    <Link to="/admin/warteliste">
                      Zur Anfrageliste („Heute“ zeigt, was zu prüfen ist)
                    </Link>
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground">Zusammenfassung nicht verfügbar.</p>
              )}
            </div>
            {withNote.length > 0 && (
              <>
                <h3 className="pt-2 text-sm font-semibold">
                  Mit Anmerkung der Eltern ({withNote.length})
                </h3>
                <p className="text-xs text-muted-foreground">
                  Die Eltern haben etwas dazugeschrieben, das das System nicht auswertet (zum
                  Beispiel Zeiten). Bitte kurz lesen.
                </p>
                <div className="space-y-4">
                  {withNote.map((i) => (
                    <InboxItemCard key={`${i.source}-${i.id}`} item={i} />
                  ))}
                </div>
              </>
            )}
          </section>
        </>
      )}

      {loaded && tab === "done" && (
        <section className="space-y-4">
          {doneMsgs.length === 0 ? (
            <Card className="border-0 shadow-soft">
              <CardContent className="p-10 text-center text-muted-foreground">
                Noch keine erledigten Nachrichten.
              </CardContent>
            </Card>
          ) : (
            doneMsgs.map((m) => (
              <MessageCard
                key={`msg-${m.id}`}
                m={m}
                onStatus={updateStatus}
                onNotes={saveNotes}
                onDelete={deleteMsg}
              />
            ))
          )}
        </section>
      )}
    </div>
  );
}

function MessageCard({
  m,
  showAge,
  onStatus,
  onNotes,
  onDelete,
}: {
  m: Msg;
  showAge?: boolean;
  onStatus: (id: string, s: string) => void;
  onNotes: (id: string, n: string) => void;
  onDelete: (id: string) => void;
}) {
  const [notes, setNotes] = useState(m.internal_notes || "");
  const [replyOpen, setReplyOpen] = useState(false);
  const [replySubject, setReplySubject] = useState(`Re: ${m.subject || "Ihre Nachricht"}`);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Eingeklappte Listenansicht wie in einem E-Mail-Programm
  const [open, setOpen] = useState(false);
  const unread = m.status === "new";

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread) onStatus(m.id, "read");
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
      onStatus(m.id, "replied");
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      toast.error(e?.message || "Antwort konnte nicht gesendet werden");
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
                {showAge && ["new", "read"].includes(m.status) && <AgeBadge since={m.created_at} />}
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
          <div className={`items-center gap-2 ${open ? "flex" : "hidden"}`}>
            <Select value={m.status} onValueChange={(v) => onStatus(m.id, v)}>
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
                <Button size="sm" variant="destructive" aria-label="Nachricht löschen">
                  <Trash2 className="h-4 w-4" />
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
                  <AlertDialogAction onClick={() => onDelete(m.id)}>Löschen</AlertDialogAction>
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
              <label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                Interne Notizen
              </label>
              <Textarea
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
                  onClick={() => onNotes(m.id, notes)}
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
