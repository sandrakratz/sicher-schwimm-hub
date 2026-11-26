import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Pencil, Undo2 } from "lucide-react";
import { MoreMenu } from "@/components/admin/MoreMenu";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateBerlin, formatEuro } from "@/lib/format";
import { fetchIn } from "@/lib/fetch-all";
import type { Course, Participant } from "@/components/admin/kurse/shared";
import { isDeadBooking, paymentOf } from "@/components/admin/kurse/useParticipants";
import {
  ParticipantActionDialogs,
  useParticipantActions,
} from "@/components/admin/kurse/useParticipantActions";

const STATUS: Record<string, string> = {
  confirmed: "Gebucht",
  waiting: "Warteliste",
  cancelled: "Abgesagt / storniert",
};

type TransferCourse = {
  id: string;
  name: string;
  schedule: string | null;
  location: string | null;
  free: number | null;
};

/**
 * Buchungen einer Familie mit denselben Aktionen wie in der Teilnehmerliste eines Kurses:
 * bezahlt, bearbeiten, umbuchen, Absage erfassen, entfernen.
 */
export function FamilyBookings({
  bookingIds,
  onChanged,
}: {
  bookingIds: string[];
  /** Nach jeder Änderung: Familienübersicht (Verlauf, Zähler) neu laden */
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<Participant[] | null>(null);
  const [courses, setCourses] = useState<Map<string, Course>>(new Map());
  const [targets, setTargets] = useState<TransferCourse[]>([]);
  const [requestHealth, setRequestHealth] = useState<Record<string, string | null>>({});
  const [requestParent, setRequestParent] = useState<Record<string, string | null>>({});
  const idsKey = bookingIds.join(",");

  const load = useCallback(async () => {
    const ids = idsKey ? idsKey.split(",") : [];
    if (ids.length === 0) {
      setRows([]);
      return;
    }
    const { data: parts } = await supabase.from("course_participants").select("*").in("id", ids);
    const list = ((parts ?? []) as Participant[]).sort((a, b) =>
      (b.created_at ?? "").localeCompare(a.created_at ?? ""),
    );
    // Kurse der Buchungen (für Preise, Fälligkeit, Alter) und alle offenen Kurse als Umbuchungsziele
    const { data: open } = await supabase.from("courses").select("*").is("archived_at", null);
    const ownIds = [...new Set(list.map((p) => p.course_id))];
    const missing = ownIds.filter((id) => !(open ?? []).some((c) => c.id === id));
    const { data: archived } = missing.length
      ? await supabase.from("courses").select("*").in("id", missing)
      : { data: [] };
    const all = [...(open ?? []), ...(archived ?? [])] as unknown as Course[];
    setCourses(new Map(all.map((c) => [c.id, c])));
    const openIds = (open ?? []).map((c) => c.id);
    const confirmed = await fetchIn<{ course_id: string }>(openIds, (chunk, f, t) =>
      supabase
        .from("course_participants")
        .select("course_id")
        .in("course_id", chunk)
        .eq("status", "confirmed")
        .order("id")
        .range(f, t),
    );
    const count = new Map<string, number>();
    for (const r of confirmed) count.set(r.course_id, (count.get(r.course_id) ?? 0) + 1);
    setTargets(
      ((open ?? []) as unknown as Course[]).map((c) => ({
        id: c.id,
        name: c.name,
        schedule: c.schedule,
        location: c.location,
        free: c.max_participants != null ? c.max_participants - (count.get(c.id) ?? 0) : null,
      })),
    );
    const reqIds = list.map((p) => p.request_id).filter(Boolean) as string[];
    if (reqIds.length) {
      const { data: reqs } = await supabase
        .from("course_requests")
        .select("id,health_info,parent_name")
        .in("id", reqIds);
      setRequestHealth(Object.fromEntries((reqs ?? []).map((r) => [r.id, r.health_info])));
      setRequestParent(Object.fromEntries((reqs ?? []).map((r) => [r.id, r.parent_name])));
    }
    setRows(list);
  }, [idsKey]);
  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
    onChanged();
  }, [load, onChanged]);
  const a = useParticipantActions(refresh);
  const editCourse = useMemo(
    () => (a.editPart ? (courses.get(a.editPart.course_id) ?? null) : null),
    [a.editPart, courses],
  );

  if (!rows) return <p className="text-sm text-muted-foreground">Wird geladen …</p>;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Keine Buchungen.</p>;

  return (
    <>
      <div className="divide-y rounded-md border bg-card">
        {rows.map((p) => {
          const c = courses.get(p.course_id) ?? null;
          const pay = paymentOf(p, c);
          const dead = isDeadBooking(p);
          const active = p.status === "confirmed";
          return (
            <div key={p.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{p.participant_name ?? "–"}</span>
                  <Badge variant="secondary" title={p.cancel_reason ?? undefined}>
                    {p.removed_at ? "Aus dem Kurs genommen" : (STATUS[p.status] ?? p.status)}
                  </Badge>
                  {!dead && (
                    <Badge variant="outline" className={pay.className}>
                      {pay.label}
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  <Link
                    to="/admin/kurs/$courseId"
                    params={{ courseId: p.course_id }}
                    className="text-primary underline underline-offset-2"
                    title="Kurs mit allen Teilnehmern öffnen"
                  >
                    {c?.name ?? "Kurs"}
                  </Link>
                  {c?.starts_on &&
                    ` · ${formatDateBerlin(c.starts_on)}${c.ends_on && c.ends_on !== c.starts_on ? ` – ${formatDateBerlin(c.ends_on)}` : ""}`}
                  {p.price_amount != null && ` · ${formatEuro(p.price_amount)}`}
                  {` · gebucht ${formatDateBerlin(p.created_at)}`}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {!dead &&
                  (p.paid ? (
                    <Button size="sm" variant="ghost" onClick={() => void a.togglePaid(p, false)}>
                      <Undo2 className="h-4 w-4" aria-hidden="true" /> Zahlung zurücksetzen
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => void a.togglePaid(p, true)}>
                      <Check className="h-4 w-4" aria-hidden="true" /> Bezahlt
                    </Button>
                  ))}
                <Button size="sm" variant="outline" onClick={() => a.setEditPart(p)}>
                  <Pencil className="h-4 w-4" aria-hidden="true" /> Bearbeiten
                </Button>
                {active && (
                  <MoreMenu
                    items={[
                      {
                        label: "Umbuchen …",
                        hint: "Anderer Kurs; Gebühr nach § 3, Eltern stimmen per Link zu",
                        onSelect: () => a.setTransferPart(p),
                      },
                      {
                        label: "Absage erfassen …",
                        hint: "Familie sagt ab – zählt als Absage, Platz wird frei",
                        onSelect: () => void a.updateStatus(p, "cancelled"),
                      },
                      {
                        label: "Wieder auf die Warteliste …",
                        hint: "Platz wird frei, Kind wartet wieder – zählt nicht als Absage",
                        onSelect: () => void a.updateStatus(p, "waiting"),
                      },
                      {
                        label: "Aus dem Kurs nehmen …",
                        hint: "Durch den Verein, z. B. Nichtzahlung – Buchung bleibt mit Grund sichtbar",
                        onSelect: () => a.startRemove(p),
                      },
                    ]}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ParticipantActionDialogs
        a={a}
        editCourse={editCourse}
        transferCourses={targets}
        requestHealth={requestHealth}
        requestParent={requestParent}
      />
    </>
  );
}
