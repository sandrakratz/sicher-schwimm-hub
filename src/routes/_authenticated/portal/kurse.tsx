import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, MapPin, Clock, Euro, Award, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import {
  exportMyPartialCertificate,
  exportMyCourseConfirmation,
} from "@/lib/trainer-courses.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/portal/kurse")({
  component: Page,
});

type Row = {
  id: string;
  participant_name: string | null;
  date_of_birth: string | null;
  status: "confirmed" | "waiting" | "cancelled";
  is_member: boolean | null;
  member_confirmed: boolean;
  price_amount: number | null;
  paid: boolean;
  goal_reached: boolean | null;
  badge: string | null;
  achievement: string | null;
  exam_criteria: unknown;
  courses: {
    id: string;
    name: string;
    starts_on: string | null;
    ends_on: string | null;
    schedule: string | null;
    location: string | null;
    duration: string | null;
    target_group: string | null;
  } | null;
};

const STATUS_LABEL: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  confirmed: { label: "Bestätigt", variant: "default" },
  waiting: { label: "Warteliste", variant: "secondary" },
  cancelled: { label: "Abgesagt", variant: "destructive" },
};

import { formatDateBerlin } from "@/lib/format";

function fmt(d: string | null) {
  if (!d) return null;
  return formatDateBerlin(d);
}
function fmtDuration(d: string | null) {
  if (!d) return null;
  const t = String(d).trim();
  if (/^\d+(\.\d+)?$/.test(t)) return `${t} Wochen`;
  return t;
}

function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const exportCert = useServerFn(exportMyPartialCertificate);
  const exportConf = useServerFn(exportMyCourseConfirmation);
  const [busy, setBusy] = useState<string | null>(null);
  async function download(id: string, kind: "cert" | "conf") {
    setBusy(id);
    try {
      const r =
        kind === "cert"
          ? await exportCert({ data: { participantId: id } })
          : await exportConf({ data: { participantId: id } });
      const bin = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bin], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message || "Download nicht möglich");
    } finally {
      setBusy(null);
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = r.participant_name?.trim() || "Ohne Namen";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("course_participants")
        .select(
          "id,participant_name,date_of_birth,status,is_member,member_confirmed,price_amount,paid,goal_reached,badge,achievement,exam_criteria,courses!course_participants_course_id_fkey(id,name,starts_on,ends_on,schedule,location,duration,target_group)",
        )
        .or(`parent_user_id.eq.${u.user.id},user_id.eq.${u.user.id}`)
        .order("created_at", { ascending: false });
      setRows((data as any) || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary-deep">Meine Kurse</h1>
        <p className="text-muted-foreground mt-1">
          Übersicht über alle Kurse, in denen Sie bzw. Ihre Kinder eingebucht sind.
        </p>
      </div>

      {loading ? (
        <Card className="border-0 shadow-soft">
          <CardContent className="p-10 text-center text-muted-foreground">
            Wird geladen…
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="border-0 shadow-soft">
          <CardContent className="p-10 text-center text-muted-foreground">
            Aktuell sind keine Kurse mit Ihrem Konto verknüpft.
            <div className="text-xs mt-2">
              Sobald wir Sie oder Ihr Kind einbuchen, erscheinen die Details hier automatisch.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([child, list]) => (
            <section key={child} className="space-y-3">
              <h2 className="font-display text-xl font-bold text-primary-deep">{child}</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {[...list]
                  .sort(
                    (a, b) =>
                      Number(!!a.courses?.ends_on && a.courses.ends_on < today) -
                      Number(!!b.courses?.ends_on && b.courses.ends_on < today),
                  )
                  .map((r) => {
                    const c = r.courses;
                    const st = STATUS_LABEL[r.status] || {
                      label: r.status,
                      variant: "secondary" as const,
                    };
                    return (
                      <Card key={r.id} className="border-0 shadow-soft">
                        <CardContent className="p-5 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-display text-lg font-bold text-primary-deep">
                                {c?.name || "Kurs"}
                              </div>
                              {r.participant_name && (
                                <div className="text-sm text-muted-foreground">
                                  Teilnehmer:{" "}
                                  <span className="font-medium text-foreground">
                                    {r.participant_name}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant={st.variant}>{st.label}</Badge>
                              {c?.ends_on && c.ends_on < today && (
                                <Badge variant="outline">Abgeschlossen</Badge>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1 text-sm">
                            {(c?.starts_on || c?.ends_on) && (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {fmt(c?.starts_on || null) || "—"} –{" "}
                                {fmt(c?.ends_on || null) || "—"}
                                {c?.duration && (
                                  <span className="text-muted-foreground">
                                    {" "}
                                    · {fmtDuration(c.duration)}
                                  </span>
                                )}
                              </div>
                            )}
                            {c?.schedule && (
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                {c.schedule}
                              </div>
                            )}
                            {c?.location && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                {c.location}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                            {r.price_amount != null && (
                              <div className="flex items-center gap-1 text-sm">
                                <Euro className="h-4 w-4" />
                                {Number(r.price_amount).toFixed(2)} €
                              </div>
                            )}
                            {r.paid ? (
                              <Badge className="bg-green-600 hover:bg-green-700">Bezahlt</Badge>
                            ) : (
                              <Badge variant="outline">Zahlung offen</Badge>
                            )}
                            {r.is_member === true && <Badge variant="secondary">Mitglied</Badge>}
                            {r.is_member === false && (
                              <Badge variant="outline">Nicht-Mitglied</Badge>
                            )}
                          </div>

                          {(r.goal_reached != null || r.badge || r.achievement) && (
                            <div className="pt-2 border-t text-sm space-y-1">
                              <div className="flex items-center gap-2 font-medium text-primary-deep">
                                <Award className="h-4 w-4" /> Ergebnis
                              </div>
                              {r.goal_reached === true && (
                                <Badge className="bg-green-600 hover:bg-green-700">
                                  Ziel erreicht
                                </Badge>
                              )}
                              {r.goal_reached === false && (
                                <Badge variant="secondary">Ziel noch nicht erreicht</Badge>
                              )}
                              {r.badge && (
                                <div>
                                  <span className="text-muted-foreground">Abzeichen:</span>{" "}
                                  {r.badge}
                                </div>
                              )}
                              {r.achievement && (
                                <div className="text-muted-foreground">{r.achievement}</div>
                              )}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {r.status === "confirmed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy === r.id}
                                onClick={() => download(r.id, "conf")}
                              >
                                <Download className="h-4 w-4 mr-1" /> Kursbestätigung (PDF)
                              </Button>
                            )}
                            {r.status === "confirmed" &&
                              r.goal_reached !== true &&
                              Array.isArray(r.exam_criteria) &&
                              r.exam_criteria.length > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busy === r.id}
                                  onClick={() => download(r.id, "cert")}
                                >
                                  <Download className="h-4 w-4 mr-1" /> Teilleistungsnachweis (PDF)
                                </Button>
                              )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
