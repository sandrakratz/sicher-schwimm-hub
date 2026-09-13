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
import { ExternalLink, Reply } from "lucide-react";
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

/** Kursanfragen und Wartelisten-Einträge im gemeinsamen Posteingang beantworten. */
export function InboxItemCard({ item }: { item: InboxItem }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(`Re: ${item.subject}`);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

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
      setOpen(false);
      setBody("");
      setReloadKey((k) => k + 1);
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Antwort konnte nicht gesendet werden");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="border-0 shadow-soft">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{SOURCE_LABEL[item.source]}</Badge>
              <Badge variant="outline">{item.statusLabel}</Badge>
              <span className="text-xs text-muted-foreground">{formatDateTimeBerlin(item.created_at)}</span>
            </div>
            <h2 className="font-display mt-2 text-xl font-bold text-primary-deep">{item.subject}</h2>
            <div className="mt-1 text-sm">
              <span className="font-semibold">{item.name}</span>{" "}
              {item.email && (
                <a href={`mailto:${item.email}`} className="text-accent hover:underline">
                  &lt;{item.email}&gt;
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setOpen(true)} disabled={!item.email}>
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

        <Dialog open={open} onOpenChange={setOpen}>
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
              <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
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
