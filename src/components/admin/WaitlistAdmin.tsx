import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, RefreshCw, Send, Trash2, Undo2 } from "lucide-react";
import { formatDateBerlin } from "@/lib/format";
import {
  listWaitlist,
  runWaitlistAllocation,
  offerWaitlistPlace,
  updateWaitlistEntry,
  deleteWaitlistEntry,
} from "@/lib/waitlist.functions";

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  waiting: { label: "Wartend", className: "bg-amber-100 text-amber-900" },
  offered: { label: "Platz angeboten", className: "bg-blue-100 text-blue-900" },
  accepted: { label: "Zugesagt", className: "bg-emerald-100 text-emerald-900" },
  declined: { label: "Abgesagt", className: "bg-slate-200 text-slate-800" },
  expired: { label: "Frist abgelaufen", className: "bg-slate-200 text-slate-800" },
  removed: { label: "Entfernt", className: "bg-slate-200 text-slate-800" },
};

export function WaitlistAdmin() {
  const qc = useQueryClient();
  const [showClosed, setShowClosed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-waitlist"],
    queryFn: () => listWaitlist(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-waitlist"] });

  const allocate = useMutation({
    mutationFn: (courseId?: string | null) => runWaitlistAllocation({ data: { courseId: courseId ?? null } }),
    onSuccess: (res) => {
      toast.success(`${res.offers} Platzangebot(e) verschickt, ${res.expired} abgelaufene Angebote geschlossen.`);
      invalidate();
    },
    onError: () => toast.error("Platzvergabe fehlgeschlagen"),
  });

  const offer = useMutation({
    mutationFn: (v: { entryId: string; courseId: string }) => offerWaitlistPlace({ data: v }),
    onSuccess: () => {
      toast.success("Platzangebot verschickt");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Angebot fehlgeschlagen"),
  });

  const update = useMutation({
    mutationFn: (v: { entryId: string; status: "waiting" | "removed" }) => updateWaitlistEntry({ data: v }),
    onSuccess: invalidate,
    onError: () => toast.error("Aktualisierung fehlgeschlagen"),
  });

  const remove = useMutation({
    mutationFn: (entryId: string) => deleteWaitlistEntry({ data: { entryId } }),
    onSuccess: () => {
      toast.success("Eintrag gelöscht");
      invalidate();
    },
    onError: () => toast.error("Löschen fehlgeschlagen"),
  });

  const programName = (id: string | null) => data?.programs.find((p) => p.id === id)?.name ?? "Ohne Zuordnung";

  const grouped = useMemo(() => {
    const entries = (data?.entries ?? []).filter((e) =>
      showClosed ? true : ["waiting", "offered"].includes(e.status),
    );
    const map = new Map<string, typeof entries>();
    for (const e of entries) {
      const key = e.program_id ?? "none";
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()];
  }, [data, showClosed]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Warteliste wird geladen…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-primary-deep">Warteliste</h2>
          <p className="text-sm text-muted-foreground">
            Automatische Platzvergabe: Mitglieder zuerst, danach nach Eingangsdatum. Angebote laufen nach der im
            Programm hinterlegten Frist ab.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowClosed((v) => !v)}>
            {showClosed ? "Nur offene zeigen" : "Alle Einträge zeigen"}
          </Button>
          <Button size="sm" onClick={() => allocate.mutate(null)} disabled={allocate.isPending}>
            {allocate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Plätze jetzt vergeben
          </Button>
        </div>
      </div>

      {grouped.length === 0 && <p className="text-muted-foreground">Keine Einträge auf der Warteliste.</p>}

      {grouped.map(([programId, entries]) => (
        <Card key={programId}>
          <CardHeader>
            <CardTitle className="text-lg">
              {programName(programId === "none" ? null : programId)}{" "}
              <span className="text-sm font-normal text-muted-foreground">({entries.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Kind</th>
                  <th className="py-2 pr-3">Eltern</th>
                  <th className="py-2 pr-3">Eingang</th>
                  <th className="py-2 pr-3">Mitglied</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const st = STATUS_LABEL[e.status] ?? { label: e.status, className: "" };
                  const courses = (data?.courses ?? []).filter(
                    (c) => (!e.program_id || c.program_id === e.program_id) && c.free !== 0,
                  );
                  return (
                    <tr key={e.id} className="border-b align-top">
                      <td className="py-2 pr-3 font-medium">
                        {e.child_name}
                        {e.child_dob && (
                          <div className="text-xs text-muted-foreground">{formatDateBerlin(e.child_dob)}</div>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {e.parent_name}
                        <div className="text-xs text-muted-foreground">{e.parent_email}</div>
                        {e.parent_phone && <div className="text-xs text-muted-foreground">{e.parent_phone}</div>}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDateBerlin(e.created_at)}</td>
                      <td className="py-2 pr-3">{e.is_member ? "Ja" : e.is_member === false ? "Nein" : "–"}</td>
                      <td className="py-2 pr-3">
                        <Badge className={st.className} variant="secondary">
                          {st.label}
                        </Badge>
                        {e.status === "offered" && e.offer_expires_at && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Frist: {formatDateBerlin(e.offer_expires_at)}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {e.status === "waiting" && courses.length > 0 && (
                            <select
                              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                              defaultValue=""
                              onChange={(ev) => {
                                const courseId = ev.target.value;
                                ev.target.value = "";
                                if (courseId) offer.mutate({ entryId: e.id, courseId });
                              }}
                            >
                              <option value="">Platz anbieten…</option>
                              {courses.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                  {c.free != null ? ` (${c.free} frei)` : ""}
                                </option>
                              ))}
                            </select>
                          )}
                          {e.status === "waiting" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Als abgemeldet markieren"
                              onClick={() => update.mutate({ entryId: e.id, status: "removed" })}
                            >
                              <Send className="h-4 w-4 rotate-180" />
                            </Button>
                          )}
                          {e.status !== "waiting" && e.status !== "accepted" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Zurück auf wartend"
                              onClick={() => update.mutate({ entryId: e.id, status: "waiting" })}
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Eintrag löschen"
                            onClick={() => {
                              if (confirm(`Eintrag für ${e.child_name} wirklich löschen?`)) remove.mutate(e.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
