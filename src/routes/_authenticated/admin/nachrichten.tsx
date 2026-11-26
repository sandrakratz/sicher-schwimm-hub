import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { InboxItemCard } from "@/components/admin/InboxItemCard";
import { listInbox, type InboxItem, type InboxSummary } from "@/lib/inbox.functions";
import { effectiveAssignee, useAssignmentContext } from "@/components/admin/AssignControl";
import { NativeSelect } from "@/components/ui/native-select";
import { MessageCard, isOpenMessage, useMessages } from "@/components/admin/messages/MessageCard";

export const Route = createFileRoute("/_authenticated/admin/nachrichten")({
  // ?zustaendig=ich öffnet die Liste gefiltert auf die angemeldete Person (Link aus „Mir zugewiesen“)
  validateSearch: (search: Record<string, unknown>): { zustaendig?: "ich" } =>
    search["zustaendig"] === "ich" ? { zustaendig: "ich" } : {},
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

function Page() {
  const msgs = useMessages();
  const { rows, loading } = msgs;
  const ctx = useAssignmentContext();
  const [who, setWho] = useState("");
  const { zustaendig } = Route.useSearch();
  useEffect(() => {
    if (zustaendig === "ich" && ctx.data?.me) setWho(ctx.data.me);
  }, [zustaendig, ctx.data?.me]);
  const [tab, setTab] = useState<"open" | "done">("open");

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

  const doneMsgs = rows.filter((m) => !isOpenMessage(m));
  const requests = (inbox ?? []).filter((i) => i.source === "course-request");
  const withNote = (inbox ?? []).filter((i) => i.source === "waitlist");

  // „Antworten nötig“: unbeantwortete Nachrichten und neue Kursanfragen. Beschwerden zuerst, danach
  // die am längsten wartenden zuerst.
  const needReply = [
    ...rows
      .filter(
        (m) =>
          isOpenMessage(m) &&
          (who === "" ||
            (who === "__none"
              ? !effectiveAssignee(m.assigned_to, "messages", ctx.data?.rules)
              : effectiveAssignee(m.assigned_to, "messages", ctx.data?.rules) === who)),
      )
      .map((m) => ({
        key: `msg-${m.id}`,
        when: m.created_at,
        prio: m.category === "complaint" ? 0 : 1,
        node: <MessageCard key={`msg-${m.id}`} m={m} msgs={msgs} showAge />,
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
        <h1 className="font-display text-3xl font-bold text-primary-deep">Postfach</h1>
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
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label className="text-muted-foreground" htmlFor="inbox-who">
                Zuständig:
              </label>
              <NativeSelect
                id="inbox-who"
                size="sm"
                value={who}
                onChange={(e) => setWho(e.target.value)}
              >
                <option value="">Alle</option>
                <option value="__none">Nicht zugewiesen</option>
                {(ctx.data?.staff ?? []).map((s) => (
                  <option key={s} value={s}>
                    {s}
                    {s === ctx.data?.me ? " (ich)" : ""}
                  </option>
                ))}
              </NativeSelect>
            </div>
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
                    <Link to="/admin/warteliste">Zur Anfrageliste</Link>
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
            doneMsgs.map((m) => <MessageCard key={`msg-${m.id}`} m={m} msgs={msgs} />)
          )}
        </section>
      )}
    </div>
  );
}
