import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTimeBerlin } from "@/lib/format";
import {
  MAX_RECIPIENTS,
  listMessageCandidates,
  listSentMessages,
  sendMemberMessage,
  type MessageCandidate,
  type SentMessage,
} from "@/lib/member-messages.functions";

export const Route = createFileRoute("/_authenticated/admin/mitgliedernachricht")({
  ssr: false,
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/role-guard");
    const { redirect } = await import("@tanstack/react-router");
    try {
      await assertHasAnyRole({ data: { roles: ["admin", "board"] } });
    } catch {
      throw redirect({ to: "/portal" });
    }
  },
  component: Page,
});

const MAIL_LABEL: Record<string, string> = {
  sent: "Mail gesendet",
  pending: "Mail offen",
  failed: "Mail fehlgeschlagen",
  skipped: "Keine Mail (Adresse fehlt/gesperrt)",
};

function Page() {
  const [candidates, setCandidates] = useState<MessageCandidate[] | null>(null);
  const [withoutAccount, setWithoutAccount] = useState(0);
  const [sent, setSent] = useState<SentMessage[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  async function reload() {
    try {
      const [c, s] = await Promise.all([listMessageCandidates(), listSentMessages()]);
      setCandidates(c.candidates);
      setWithoutAccount(c.withoutAccount);
      setSent(s);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Laden fehlgeschlagen");
      setCandidates([]);
    }
  }
  useEffect(() => {
    void reload();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates ?? [];
    return (candidates ?? []).filter(
      (c) => c.name.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q),
    );
  }, [candidates, search]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const tooMany = selected.size > MAX_RECIPIENTS;
  const canSend = selected.size > 0 && !tooMany && subject.trim() && body.trim() && !busy;

  async function send() {
    if (!canSend) return;
    if (
      !window.confirm(
        `Nachricht an ${selected.size} ${selected.size === 1 ? "Person" : "Personen"} senden? Sie landet im Postfach des Kontos, zusätzlich geht eine Hinweis-Mail raus.`,
      )
    )
      return;
    setBusy(true);
    try {
      const r = await sendMemberMessage({
        data: { userIds: [...selected], subject, body },
      });
      toast.success(
        r.failed > 0
          ? `Gesendet an ${r.recipients}. Bei ${r.failed} ging die Hinweis-Mail nicht raus – die Nachricht liegt trotzdem im Postfach.`
          : `Nachricht an ${r.recipients} ${r.recipients === 1 ? "Person" : "Personen"} gesendet.`,
      );
      setSelected(new Set());
      setSubject("");
      setBody("");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Senden fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary-deep">
          Mitglieder anschreiben
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Die Nachricht erscheint im Postfach des Mitgliedskontos. Zusätzlich bekommt die Person
          eine kurze Hinweis-Mail (ohne den Nachrichtentext).
        </p>
      </div>

      <Card className="border-0 shadow-soft">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold">1. Empfänger:innen wählen</h2>
            <span className="text-sm text-muted-foreground">
              {selected.size} gewählt (höchstens {MAX_RECIPIENTS})
            </span>
          </div>
          <Input
            placeholder="Name oder E-Mail suchen …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Mitglieder suchen"
          />
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setSelected((prev) => new Set([...prev, ...filtered.map((c) => c.userId)]))
              }
            >
              Alle angezeigten wählen
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setSelected(new Set())}
              disabled={selected.size === 0}
            >
              Auswahl leeren
            </Button>
          </div>
          {tooMany && (
            <p className="text-sm text-destructive">
              Bitte höchstens {MAX_RECIPIENTS} Personen je Nachricht wählen (Mail-Tageslimit).
            </p>
          )}
          <div className="max-h-80 overflow-y-auto rounded-md border divide-y">
            {candidates === null ? (
              <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Lade Mitglieder …
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Keine Mitglieder gefunden.</div>
            ) : (
              filtered.map((c) => (
                <label
                  key={c.userId}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selected.has(c.userId)}
                    onCheckedChange={() => toggle(c.userId)}
                  />
                  <span className="font-medium">{c.name}</span>
                  <span className="text-sm text-muted-foreground truncate">{c.email}</span>
                </label>
              ))
            )}
          </div>
          {withoutAccount > 0 && (
            <p className="text-xs text-muted-foreground">
              {withoutAccount} aktive{" "}
              {withoutAccount === 1 ? "Mitgliedschaft hat" : "Mitgliedschaften haben"} noch kein
              Konto und {withoutAccount === 1 ? "steht" : "stehen"} deshalb nicht zur Auswahl.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-soft">
        <CardContent className="p-5 space-y-4">
          <h2 className="font-semibold">2. Nachricht schreiben</h2>
          <div>
            <Label htmlFor="mm-subject">Betreff</Label>
            <Input
              id="mm-subject"
              value={subject}
              maxLength={200}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="mm-body">Nachricht</Label>
            <Textarea
              id="mm-body"
              rows={8}
              value={body}
              maxLength={10000}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <Button type="button" variant="accent" onClick={send} disabled={!canSend}>
            {busy ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Senden
          </Button>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="font-semibold">Bisher gesendet</h2>
        {sent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Nachrichten gesendet.</p>
        ) : (
          sent.map((m) => {
            const read = m.recipients.filter((r) => r.readAt).length;
            const open = openId === m.id;
            return (
              <Card key={m.id} className="border-0 shadow-soft">
                <CardContent className="p-4">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setOpenId(open ? null : m.id)}
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="font-medium">{m.subject}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTimeBerlin(m.createdAt)} · {m.recipients.length} Empfänger:innen
                        · {read} gelesen
                      </span>
                    </div>
                  </button>
                  {open && (
                    <div className="mt-3 space-y-3">
                      <p className="whitespace-pre-line text-sm">{m.body}</p>
                      <ul className="text-sm divide-y rounded-md border">
                        {m.recipients.map((r) => (
                          <li
                            key={r.userId}
                            className="flex items-center justify-between gap-2 px-3 py-1.5 flex-wrap"
                          >
                            <span>{r.name}</span>
                            <span className="flex gap-2">
                              <Badge variant={r.readAt ? "default" : "secondary"}>
                                {r.readAt ? "Gelesen" : "Ungelesen"}
                              </Badge>
                              <Badge
                                variant={r.mailStatus === "failed" ? "destructive" : "outline"}
                              >
                                {MAIL_LABEL[r.mailStatus] ?? r.mailStatus}
                              </Badge>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
