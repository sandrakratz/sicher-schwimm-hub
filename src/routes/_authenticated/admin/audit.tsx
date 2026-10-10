import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AUDIT_AREAS, listAuditLog, type AuditArea } from "@/lib/audit-log.functions";
import { formatDateTimeBerlin } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/role-guard");
    const { redirect } = await import("@tanstack/react-router");
    try {
      // Vorstand und Verwaltung dürfen das Protokoll einsehen
      await assertHasAnyRole({ data: { roles: ["admin", "board"] } });
    } catch {
      throw redirect({ to: "/admin/benutzer" });
    }
  },
  component: Page,
});

const selectCls = "h-9 rounded-md border border-input bg-background px-2 text-sm";

function Page() {
  const [actorId, setActorId] = useState("");
  const [area, setArea] = useState<"" | AuditArea>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [textInput, setTextInput] = useState("");
  const [text, setText] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  // Suchtext erst nach kurzer Pause anwenden
  useEffect(() => {
    const t = setTimeout(() => setText(textInput.trim()), 400);
    return () => clearTimeout(t);
  }, [textInput]);

  const query = useInfiniteQuery({
    queryKey: ["admin-audit", actorId, area, from, to, text],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listAuditLog({
        data: {
          actorId: actorId || null,
          area: area || null,
          from: from || null,
          to: to || null,
          text: text || undefined,
          offset: pageParam,
        },
      }),
    getNextPageParam: (last, all) =>
      last.hasMore ? all.reduce((n, p) => n + p.events.length, 0) : undefined,
  });

  const events = query.data?.pages.flatMap((p) => p.events) ?? [];
  const actors = query.data?.pages[0]?.actors ?? [];
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary-deep">Audit-Log</h1>
        <p className="text-sm text-muted-foreground">
          Wer hat wann was getan. Ein Klick auf „Öffnen“ springt zur betroffenen Familie bzw. zum
          Kurs. Einträge können nicht geändert werden.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">
          Person
          <select
            className={`${selectCls} mt-1 block`}
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
          >
            <option value="">Alle</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Bereich
          <select
            className={`${selectCls} mt-1 block`}
            value={area}
            onChange={(e) => setArea(e.target.value as "" | AuditArea)}
          >
            <option value="">Alle Bereiche</option>
            {Object.entries(AUDIT_AREAS).map(([k, a]) => (
              <option key={k} value={k}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Von
          <Input
            type="date"
            className="mt-1 h-9"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Bis
          <Input
            type="date"
            className="mt-1 h-9"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label className="min-w-[14rem] flex-1 text-xs text-muted-foreground">
          Suche (Name, Kurs, Aktion …)
          <Input
            className="mt-1 h-9"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="z. B. Hopp"
          />
        </label>
        {(actorId || area || from || to || textInput) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setActorId("");
              setArea("");
              setFrom("");
              setTo("");
              setTextInput("");
            }}
          >
            Filter zurücksetzen
          </Button>
        )}
      </div>

      <Card className="border-0 shadow-soft">
        <CardContent className="p-6">
          {query.error && (
            <p className="mb-3 text-sm text-destructive">
              Das Protokoll konnte nicht geladen werden: {(query.error as Error).message}
            </p>
          )}
          {query.isLoading ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade …
            </p>
          ) : events.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">Keine Einträge gefunden.</p>
          ) : (
            <ul className="divide-y">
              {events.map((e) => (
                <li key={e.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold">{e.actor}</span> {e.sentence}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDateTimeBerlin(e.at)}</span>
                        <Badge variant="outline">{e.area}</Badge>
                        {e.details.length > 0 && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 underline"
                            onClick={() => toggle(e.id)}
                          >
                            {open.has(e.id) ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                            Details
                          </button>
                        )}
                      </div>
                    </div>
                    {e.link && (
                      <Button asChild size="sm" variant="outline">
                        <Link to={e.link.to as never} search={(e.link.search ?? {}) as never}>
                          <ExternalLink className="mr-1 h-3.5 w-3.5" /> Öffnen
                        </Link>
                      </Button>
                    )}
                  </div>
                  {open.has(e.id) && (
                    <dl className="mt-2 grid grid-cols-[11rem_1fr] gap-x-3 gap-y-1 rounded-md bg-muted/40 p-3 text-xs">
                      {e.details.map(([k, v]) => (
                        <div key={k} className="contents">
                          <dt className="text-muted-foreground">{k}</dt>
                          <dd className="break-words">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              ))}
            </ul>
          )}
          {query.hasNextPage && (
            <div className="pt-4 text-center">
              <Button
                variant="outline"
                onClick={() => void query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {query.isFetchingNextPage ? "Lade …" : "Weitere laden"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
