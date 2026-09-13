import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, ExternalLink, Reply } from "lucide-react";
import { formatDateTimeBerlin } from "@/lib/format";
import { ConversationTimeline } from "@/components/admin/ConversationTimeline";
import { replyToCourseRequest } from "@/lib/course-requests.functions";
import { replyToWaitlistEntry } from "@/lib/waitlist-reply.functions";
import type { InboxItem } from "@/lib/inbox.functions";

const SOURCE_LABEL: Record<InboxItem["source"], string> = {
  message: "Kontaktformular",
  "course-request": "Kursanfrage",
  waitlist: "Warteliste",
};

const READ_KEY = "admin-inbox-read";

function readSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(READ_KEY) || "[]") as string[]);
  } catch {
    return new Set();
  }
}

function markRead(key: string) {
  if (typeof window === "undefined") return;
  const s = readSet();
  s.add(key);
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify([...s].slice(-500)));
  } catch {
    /* Speicher nicht verfügbar – dann bleibt der Eintrag ungelesen */
  }
}

/** Kursanfragen und Wartelisten-Einträge im gemeinsamen Posteingang – eingeklappt wie eine Mailliste. */
export function InboxItemCard({ item }: { item: InboxItem }) {
  const key = `${item.source}:${item.id}`;
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(() => !readSet().has(key));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [subject, setSubject] = useState(`Re: ${item.subject}`);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread) {
      markRead(key);
      setUnread(false);
    }
  }

  async function send() {
    if (body.trim().length < 2) {
      toast.error("Bitte Antworttext eingeben");
      return;
    }
    setSending(true);
    try {
      if (item.source === "waitlist") {
        await replyToWaitlistEntry({ data: { entryId: item.id, body, subject } });
      } else {
        await replyToCourseRequest({ data: { requestId: item.id, body, subject } });
      }
      toast.success("Antwort gesendet");
      setDialogOpen(false);
      setBody("");
      setReloadKey((k) => k + 1);
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Antwort konnte nicht gesendet werden");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className={`border-0 shadow-soft ${unread ? "border-l-4 border-l-accent" : ""}`}>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button type="button" onClick={toggle} className="flex min-w-0 flex-1 items-start gap-2 text-left">
            {open ? (
              <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{SOURCE_LABEL[item.source]}</Badge>
                <Badge variant="outline">{item.statusLabel}</Badge>
                {unread && <Badge>Ungelesen</Badge>}
                <span className="text-xs text-muted-foreground">{formatDateTimeBerlin(item.created_at)}</span>
              </div>
              <div className={`mt-1 truncate ${unread ? "font-bold text-primary-deep" : "font-medium"}`}>
                {item.subject}
              </div>
              <div className="truncate text-sm text-muted-foreground">
                {item.name}
                {item.email ? ` · ${item.email}` : ""}
                {!open && item.body ? ` — ${item.body.replace(/\s+/g, " ").slice(0, 90)}` : ""}
              </div>
            </div>
          </button>
          <div className={`items-center gap-2 ${open ? "flex" : "hidden"}`}>
            <Button size="sm" onClick={() => setDialogOpen(true)} disabled={!item.email}>
              <Reply className="mr-1 h-4 w-4" />
              Antworten
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to={item.contextTo}>
                <ExternalLink className="mr-1 h-4 w-4" />
                Vorgang öffnen
              </Link>
            </Button>
          </div>
        </div>

        {open && (
          <ConversationTimeline
            kind={item.source}
            id={item.id}
            original={{
              title: item.subject,
              when: item.created_at,
              from: `${item.name}${item.email ? ` <${item.email}>` : ""}`,
              body: item.body,
            }}
            reloadKey={reloadKey}
          />
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Antwort an {item.name}</DialogTitle>
              <DialogDescription>Die Antwort wird direkt per E-Mail an {item.email} gesendet.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor={`inbox-subj-${item.id}`}>Betreff</Label>
                <Input
                  id={`inbox-subj-${item.id}`}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={300}
                />
              </div>
              <div>
                <Label htmlFor={`inbox-body-${item.id}`}>Nachricht</Label>
                <Textarea
                  id={`inbox-body-${item.id}`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  placeholder="Ihre Antwort …"
                />
              </div>
              <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                <div className="mb-1 font-semibold">Ursprüngliche Angaben:</div>
                <div className="whitespace-pre-wrap">{item.body}</div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={sending}>
                Abbrechen
              </Button>
              <Button onClick={send} disabled={sending}>
                {sending ? "Wird gesendet …" : "Senden"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default InboxItemCard;
