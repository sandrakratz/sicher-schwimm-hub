import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, FileText, Loader2, RefreshCw, Send, Trash2, Undo2 } from "lucide-react";
import { formatDateBerlin, formatDateTimeBerlin } from "@/lib/format";
import { matchProgram, meetsMinAge, minAgeReachedOn } from "@/lib/waitlist-age";
import {
  listWaitlist,
  runWaitlistAllocation,
  offerWaitlistPlace,
  updateWaitlistEntry,
  deleteWaitlistEntry,
  migrateWaitingRequests,
} from "@/lib/waitlist.functions";

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  waiting: { label: "Wartend", className: "bg-amber-100 text-amber-900" },
  offered: { label: "Platz angeboten", className: "bg-blue-100 text-blue-900" },
  accepted: { label: "Zugesagt", className: "bg-emerald-100 text-emerald-900" },
  declined: { label: "Abgesagt", className: "bg-slate-200 text-slate-800" },
  expired: { label: "Frist abgelaufen", className: "bg-slate-200 text-slate-800" },
  removed: { label: "Entfernt", className: "bg-slate-200 text-slate-800" },
};

type WaitlistEntry = Record<string, unknown> & {
  id: string;
  child_name: string | null;
  request?: Record<string, string | number | boolean | null> | null;
};

function Row({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined || value === "") return null;
  const text =
    typeof value === "boolean" ? (value ? "Ja" : "Nein") : String(value);
  return (
    <div className="grid grid-cols-[11rem_1fr] gap-2 border-b py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="whitespace-pre-wrap">{text}</span>
    </div>
  );
}

function OriginalRequestDialog({
  entry,
  open,
  onOpenChange,
}: {
  entry: WaitlistEntry | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const r = entry?.request ?? null;
  const g = (k: string) => (r ? r[k] : (entry as Record<string, unknown> | null)?.[k]) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Originalanfrage – {String(entry?.child_name ?? "")}</DialogTitle>
          <DialogDescription>
            {r
              ? "Ursprüngliche Kursanfrage über das Anfrageformular."
              : "Direkte Anmeldung über das Wartelisten-Formular."}
          </DialogDescription>
        </DialogHeader>
        {entry && (
          <div className="space-y-1">
            <Row label="Eingang" value={formatDateTimeBerlin(String(g("created_at") ?? entry["created_at"]))} />
            <Row label="Kind" value={g("child_name")} />
            <Row
              label="Geburtsdatum"
              value={g("child_dob") ? formatDateBerlin(String(g("child_dob"))) : null}
            />
            <Row label="Eltern" value={g("parent_name")} />
            <Row label="E-Mail" value={g("parent_email")} />
            <Row label="Telefon" value={g("parent_phone")} />
            <Row label="Kurswunsch" value={g("desired_course")} />
            <Row label="Schwimmniveau" value={g("swimming_level")} />
            <Row label="Gesundheitliche Hinweise" value={g("health_info")} />
            <Row label="Nachricht" value={g("message") ?? entry["notes"]} />
            <Row label="Mitglied" value={entry["is_member"]} />
            <Row label="Datenschutz zugestimmt" value={g("gdpr_consent") ?? entry["gdpr_consent"]} />
            <Row label="Kontaktaufnahme erlaubt" value={g("contact_permission")} />
            <Row label="Status Anfrage" value={g("status")} />
            <Row label="Interne Notizen (Anfrage)" value={r?.["admin_notes"]} />
            {r && <Row label="Anfrage-ID" value={r["id"]} />}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


function NotesCell({
  entryId,
  parentNote,
  adminNote,
  onSave,
}: {
  entryId: string;
  parentNote: string | null;
  adminNote: string | null;
  onSave: (v: { entryId: string; adminNotes: string }) => void;
}) {
  const [value, setValue] = useState(adminNote ?? "");
  useEffect(() => setValue(adminNote ?? ""), [adminNote]);
  const dirty = (adminNote ?? "") !== value;

  return (
    <div className="space-y-1">
      {parentNote && (
        <p className="whitespace-pre-wrap text-xs text-muted-foreground">{parentNote}</p>
      )}
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Interne Notiz…"
        rows={2}
        className="min-h-[3rem] text-xs"
      />
      {dirty && (
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onSave({ entryId, adminNotes: value })}>
          Notiz speichern
        </Button>
      )}
    </div>
  );
}

export function WaitlistAdmin() {
  const qc = useQueryClient();
  const [showClosed, setShowClosed] = useState(false);
  const [detail, setDetail] = useState<WaitlistEntry | null>(null);
  const migratedOnce = useRef(false);


  const { data, isLoading } = useQuery({
    queryKey: ["admin-waitlist"],
    queryFn: () => listWaitlist(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-waitlist"] });

  const migrate = useMutation({
    mutationFn: () => migrateWaitingRequests(),
    onSuccess: (res) => {
      if (res.migrated > 0) {
        toast.success(`${res.migrated} Anfrage(n) in die Warteliste übernommen.`);
        invalidate();
      }
    },
  });

  // Alte Kursanfragen mit Status „Warteliste“ einmalig übernehmen (idempotent)
  useEffect(() => {
    if (migratedOnce.current) return;
    migratedOnce.current = true;
    migrate.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    mutationFn: (v: { entryId: string; status?: "waiting" | "removed"; adminNotes?: string; programId?: string | null }) =>
      updateWaitlistEntry({ data: v }),
    onSuccess: () => {
      invalidate();
    },
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

  const programs = data?.programs ?? [];
  const programName = (id: string | null) => programs.find((p) => p.id === id)?.name ?? "Ohne Zuordnung";
  const programById = (id: string | null) => programs.find((p) => p.id === id) ?? null;

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
            Automatische Platzvergabe: Mitglieder zuerst, danach nach Eingangsdatum. Angeboten wird nur, wenn das Kind
            zum Kursbeginn das Mindestalter erreicht. Angebote laufen nach der im Programm hinterlegten Frist ab.
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
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Kind</th>
                  <th className="py-2 pr-3">Eltern</th>
                  <th className="py-2 pr-3 w-56">Wunschkurs</th>
                  <th className="py-2 pr-3 w-64">Notiz</th>
                  <th className="py-2 pr-3">Eingang</th>
                  <th className="py-2 pr-3">Mitglied</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const st = STATUS_LABEL[e.status] ?? { label: e.status, className: "" };
                  const program = programById(e.program_id);
                  const wish = (e as { desired_course?: string | null }).desired_course ?? null;
                  const suggestion = !e.program_id ? matchProgram(wish ?? e.notes, programs) : null;
                  const minAge = program?.min_age_years ?? null;
                  const readyOn = minAgeReachedOn(e.child_dob, minAge);
                  const courses = (data?.courses ?? []).filter(
                    (c) => (!e.program_id || c.program_id === e.program_id) && c.free !== 0,
                  );
                  const tooYoungEverywhere =
                    !!e.child_dob &&
                    minAge != null &&
                    courses.length > 0 &&
                    courses.every((c) => !meetsMinAge(e.child_dob, c.starts_on, minAge));

                  return (
                    <tr key={e.id} className="border-b align-top">
                      <td className="py-2 pr-3 font-medium">
                        <button
                          type="button"
                          className="text-left text-primary underline underline-offset-2"
                          title="Originalanfrage anzeigen"
                          onClick={() => setDetail(e as unknown as WaitlistEntry)}
                        >
                          {e.child_name}
                        </button>
                        {e.child_dob && (
                          <div className="text-xs text-muted-foreground">{formatDateBerlin(e.child_dob)}</div>
                        )}
                        <button
                          type="button"
                          className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                          onClick={() => setDetail(e as unknown as WaitlistEntry)}
                        >
                          <FileText className="h-3 w-3" /> Details
                        </button>
                      </td>

                      <td className="py-2 pr-3">
                        {e.parent_name}
                        <div className="text-xs text-muted-foreground">{e.parent_email}</div>
                        {e.parent_phone && <div className="text-xs text-muted-foreground">{e.parent_phone}</div>}
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                          value={e.program_id ?? ""}
                          onChange={(ev) =>
                            update.mutate({ entryId: e.id, programId: ev.target.value || null })
                          }
                        >
                          <option value="">Kein Wunschkurs</option>
                          {programs.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        {wish && <div className="mt-1 text-xs text-muted-foreground">Wunsch: {wish}</div>}
                        {suggestion && (
                          <button
                            type="button"
                            className="mt-1 text-xs text-primary underline"
                            onClick={() => update.mutate({ entryId: e.id, programId: suggestion.id })}
                          >
                            Vorschlag übernehmen: {suggestion.name}
                          </button>
                        )}
                        {readyOn && (
                          <div className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                            <span>
                              Mindestalter erreicht ab {formatDateBerlin(readyOn)}
                              {tooYoungEverywhere ? " – aktuell kein passender Kursstart" : ""}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <NotesCell
                          entryId={e.id}
                          parentNote={e.notes}
                          adminNote={e.admin_notes}
                          onSave={(v) => {
                            update.mutate(v);
                            toast.success("Notiz gespeichert");
                          }}
                        />
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
                                if (!courseId) return;
                                const c = courses.find((x) => x.id === courseId);
                                if (c && !meetsMinAge(e.child_dob, c.starts_on, minAge)) {
                                  if (
                                    !confirm(
                                      `${e.child_name} erreicht zum Kursbeginn das Mindestalter noch nicht. Trotzdem anbieten?`,
                                    )
                                  )
                                    return;
                                }
                                offer.mutate({ entryId: e.id, courseId });
                              }}
                            >
                              <option value="">Platz anbieten…</option>
                              {courses.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                  {c.free != null ? ` (${c.free} frei)` : ""}
                                  {!meetsMinAge(e.child_dob, c.starts_on, minAge) ? " – zu jung" : ""}
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

      <OriginalRequestDialog entry={detail} open={!!detail} onOpenChange={(v) => !v && setDetail(null)} />

    </div>
  );
}
