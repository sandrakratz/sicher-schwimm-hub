import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listCourseAttendance,
  setAttendance,
  type AttendanceRecord,
  type AttendanceSession,
  type AttendanceStatus,
} from "@/lib/attendance.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateBerlin, formatDateTimeBerlin } from "@/lib/format";
import { toast } from "sonner";

export type AttendanceParticipant = { id: string; name: string };

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; className: string }[] = [
  { value: "present", label: "Anwesend", className: "bg-green-600 text-white border-transparent" },
  { value: "excused", label: "Entschuldigt", className: "bg-amber-100 text-amber-900 border-transparent" },
  { value: "absent", label: "Gefehlt", className: "bg-red-100 text-red-900 border-transparent" },
];

function sessionLabel(s: AttendanceSession): string {
  const time = s.start_time ? ` · ${s.start_time.slice(0, 5)} Uhr` : "";
  return `${s.session_index}. Termin – ${formatDateBerlin(s.session_date)}${time}`;
}

export function AttendanceBoard({
  courseId,
  participants,
  readOnly = false,
}: {
  courseId: string;
  participants?: AttendanceParticipant[];
  readOnly?: boolean;
}) {
  const load = useServerFn(listCourseAttendance);
  const save = useServerFn(setAttendance);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [people, setPeople] = useState<AttendanceParticipant[]>(participants || []);
  const [sessionId, setSessionId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await load({ data: { courseId } });
        if (cancelled) return;
        setSessions(res.sessions);
        setRecords(res.records);
        const today = new Date().toISOString().slice(0, 10);
        const next =
          res.sessions.find(s => s.session_date >= today) ||
          res.sessions[res.sessions.length - 1];
        setSessionId(next?.id || "");
      } catch (e: unknown) {
        if (!cancelled) toast.error((e as Error)?.message || "Anwesenheit konnte nicht geladen werden");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    if (participants && participants.length > 0) {
      setPeople(participants);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("course_participants")
        .select("id,participant_name,status")
        .eq("course_id", courseId)
        .neq("status", "cancelled");
      if (cancelled) return;
      setPeople(
        ((data as { id: string; participant_name: string | null }[]) || [])
          .map(p => ({ id: p.id, name: p.participant_name || "—" }))
          .sort((a, b) => a.name.localeCompare(b.name, "de")),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId, participants]);

  const byParticipant = useMemo(() => {
    const m = new Map<string, AttendanceRecord>();
    records.filter(r => r.session_id === sessionId).forEach(r => m.set(r.participant_id, r));
    return m;
  }, [records, sessionId]);

  async function update(participantId: string, status: AttendanceStatus | null, note?: string | null) {
    if (!sessionId || readOnly) return;
    setBusy(participantId);
    const prev = records;
    try {
      await save({ data: { sessionId, participantId, status, note: note ?? null } });
      setRecords(rs => {
        const rest = rs.filter(r => !(r.session_id === sessionId && r.participant_id === participantId));
        if (status === null) return rest;
        return [
          ...rest,
          {
            session_id: sessionId,
            participant_id: participantId,
            status,
            note: note?.trim() ? note.trim() : null,
            updated_at: new Date().toISOString(),
            recorded_by_name: null,
          },
        ];
      });
    } catch (e: unknown) {
      setRecords(prev);
      toast.error((e as Error)?.message || "Speichern fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Anwesenheit wird geladen…</p>;

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Für diesen Kurs sind noch keine Termine angelegt. Sobald Termine eingetragen sind, kann hier die
        Anwesenheit erfasst werden.
      </p>
    );
  }

  const counts = STATUS_OPTIONS.map(o => ({
    ...o,
    count: Array.from(byParticipant.values()).filter(r => r.status === o.value).length,
  }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={sessionId} onValueChange={setSessionId}>
          <SelectTrigger className="h-11 w-full sm:w-[16rem]">
            <SelectValue placeholder="Termin wählen" />
          </SelectTrigger>
          <SelectContent>
            {sessions.map(s => (
              <SelectItem key={s.id} value={s.id}>{sessionLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {counts.map(c => (
          <Badge key={c.value} className={c.className}>{c.label}: {c.count}</Badge>
        ))}
        <span className="text-xs text-muted-foreground">
          Offen: {Math.max(people.length - byParticipant.size, 0)}
        </span>
      </div>

      {/* Mobile: große Tipp-Flächen pro Kind */}
      <div className="space-y-2 md:hidden">
        {people.length === 0 && <p className="text-sm text-muted-foreground">Keine Teilnehmenden.</p>}
        {people.map(p => {
          const rec = byParticipant.get(p.id);
          return (
            <div key={p.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">{p.name}</span>
                {rec && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatDateTimeBerlin(rec.updated_at)}
                  </span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {STATUS_OPTIONS.map(o => (
                  <Button
                    key={o.value}
                    type="button"
                    variant={rec?.status === o.value ? "default" : "outline"}
                    disabled={readOnly || busy === p.id}
                    className="min-h-11 px-1 text-xs"
                    onClick={() => update(p.id, rec?.status === o.value ? null : o.value, rec?.note ?? null)}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
              {rec && (
                <Input
                  className="mt-2 h-11 text-sm"
                  defaultValue={rec.note || ""}
                  placeholder="Hinweis (optional)"
                  disabled={readOnly}
                  onBlur={e => {
                    const v = e.target.value;
                    if ((rec.note || "") !== v) update(p.id, rec.status, v);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead>Kind</TableHead>
            <TableHead>Anwesenheit</TableHead>
            <TableHead>Hinweis</TableHead>
            <TableHead>Zuletzt gespeichert</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {people.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">Keine Teilnehmenden.</TableCell>
            </TableRow>
          )}
          {people.map(p => {
            const rec = byParticipant.get(p.id);
            return (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {STATUS_OPTIONS.map(o => (
                      <Button
                        key={o.value}
                        type="button"
                        size="sm"
                        variant={rec?.status === o.value ? "default" : "outline"}
                        disabled={readOnly || busy === p.id}
                        onClick={() => update(p.id, rec?.status === o.value ? null : o.value, rec?.note ?? null)}
                      >
                        {o.label}
                      </Button>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Input
                    className="h-8 text-xs"
                    defaultValue={rec?.note || ""}
                    placeholder="optional"
                    disabled={readOnly || !rec}
                    onBlur={e => {
                      const v = e.target.value;
                      if (rec && (rec.note || "") !== v) update(p.id, rec.status, v);
                    }}
                  />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {rec ? (
                    <>
                      {formatDateTimeBerlin(rec.updated_at)}
                      {rec.recorded_by_name ? ` · ${rec.recorded_by_name}` : ""}
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export default AttendanceBoard;
