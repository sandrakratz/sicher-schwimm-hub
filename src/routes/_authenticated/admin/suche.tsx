import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { formatDateBerlin, formatDateTimeBerlin } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/suche")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/role-guard");
    const { redirect } = await import("@tanstack/react-router");
    try {
      await assertHasAnyRole({ data: { roles: ["admin", "board"] } });
    } catch {
      throw redirect({ to: "/admin/benutzer" });
    }
  },
  head: () => ({
    meta: [
      { title: "Suche – Verwaltung | Sicher Schwimmen e.V." },
      { name: "description", content: "Familien, Kinder und Buchungen im Verein schnell finden." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Page,
});

const PART_STATUS: Record<string, string> = {
  confirmed: "Bestätigt",
  waiting: "Warteliste",
  cancelled: "Storniert",
};
const MEM_STATUS: Record<string, string> = {
  pending: "Wartet auf Freigabe",
  active: "Aktiv",
  suspended: "Pausiert",
  terminated: "Beendet",
};
const MEM_TYPE: Record<string, string> = {
  children_youth: "Kinder & Jugend",
  adult: "Erwachsene",
  family: "Familie",
  supporting: "Förderung",
};
const WL_STATUS: Record<string, string> = {
  waiting: "Wartet",
  offered: "Angebot offen",
  accepted: "Angenommen",
  declined: "Abgelehnt",
  expired: "Abgelaufen",
  removed: "Entfernt",
};
const REQ_STATUS: Record<string, string> = {
  new: "Neu",
  under_review: "In Prüfung",
  contacted: "Kontaktiert",
  accepted: "Akzeptiert",
  waiting_list: "Warteliste",
  rejected: "Abgelehnt",
};

type Results = { parts: any[]; mems: any[]; wl: any[]; reqs: any[]; names: Record<string, string> };

function clean(q: string) {
  // Anführungszeichen würden den Filter-Ausdruck der Abfrage zerstören
  return q.replace(/[,()*%"\\]/g, " ").trim();
}

function Page() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = clean(q);
    if (term.length < 2) {
      setRes(null);
      setError(null);
      return;
    }
    // Eine ältere, langsamere Antwort darf eine neuere nicht überschreiben
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      const p = `%${term}%`;
      const [parts, mems0, fams, wl, reqs] = await Promise.all([
        supabase
          .from("course_participants")
          .select(
            "id,participant_name,participant_email,participant_phone,status,paid,paid_at,paid_by,price_amount,document_no,payment_due_date,course_id,courses!course_participants_course_id_fkey(name,starts_on,ends_on,schedule,location)",
          )
          .or(
            `participant_name.ilike.${p},participant_email.ilike.${p},participant_phone.ilike.${p},document_no.ilike.${p}`,
          )
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("memberships")
          .select(
            "id,first_name,last_name,email,phone,guardian_name,guardian_email,membership_type,status,family_members",
          )
          .or(
            `first_name.ilike.${p},last_name.ilike.${p},email.ilike.${p},phone.ilike.${p},guardian_name.ilike.${p},guardian_email.ilike.${p}`,
          )
          .limit(30),
        supabase
          .from("memberships")
          .select(
            "id,first_name,last_name,email,phone,guardian_name,guardian_email,membership_type,status,family_members",
          )
          .not("family_members", "is", null)
          .limit(1000),
        supabase
          .from("waitlist_entries")
          .select(
            "id,child_name,child_dob,parent_name,parent_email,parent_phone,status,available_from,created_at,course_programs(name)",
          )
          .or(
            `child_name.ilike.${p},parent_name.ilike.${p},parent_email.ilike.${p},parent_phone.ilike.${p}`,
          )
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("course_requests")
          .select(
            "id,child_name,parent_name,parent_email,parent_phone,desired_course,status,created_at",
          )
          .or(
            `child_name.ilike.${p},parent_name.ilike.${p},parent_email.ilike.${p},parent_phone.ilike.${p}`,
          )
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      if (cancelled) return;
      // Datenbankfehler anzeigen statt „Keine Treffer“
      const failed = [parts, mems0, fams, wl, reqs].find((r) => r.error);
      if (failed?.error) {
        setError(failed.error.message);
        setRes(null);
        setLoading(false);
        return;
      }
      const low = term.toLowerCase();
      const famHits = (fams.data || []).filter((m: any) =>
        JSON.stringify(m.family_members || {})
          .toLowerCase()
          .includes(low),
      );
      const memMap = new Map<string, any>();
      [...(mems0.data || []), ...famHits].forEach((m: any) => memMap.set(m.id, m));
      const mems = { data: [...memMap.values()] };
      const ids = [...new Set((parts.data || []).map((r: any) => r.paid_by).filter(Boolean))];
      const names: Record<string, string> = {};
      if (ids.length) {
        const { data } = await supabase
          .from("profiles")
          .select("id,first_name,last_name,email")
          .in("id", ids);
        (data || []).forEach((u: any) => {
          names[u.id] = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;
        });
      }
      if (cancelled) return;
      setRes({
        parts: parts.data || [],
        mems: mems.data || [],
        wl: wl.data || [],
        reqs: reqs.data || [],
        names,
      });
      setLoading(false);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const total = res ? res.parts.length + res.mems.length + res.wl.length + res.reqs.length : 0;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary-deep">Suche</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Name von Kind oder Eltern, E-Mail, Telefon oder Buchungsnummer (z. B. SK-2026-00022).
        </p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="z. B. Mellin"
          className="pl-10 h-12 text-base"
        />
      </div>

      {loading && <p className="text-sm text-muted-foreground">Suche läuft …</p>}
      {error && <p className="text-sm text-destructive">Die Suche ist fehlgeschlagen: {error}</p>}
      {res && !loading && total === 0 && (
        <p className="text-sm text-muted-foreground">Keine Treffer.</p>
      )}

      {res && res.parts.length > 0 && (
        <Section title={`Kursbuchungen (${res.parts.length})`}>
          {res.parts.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{r.participant_name}</span>
                  <Badge variant="outline">{PART_STATUS[r.status] || r.status}</Badge>
                  {r.status !== "cancelled" &&
                    (r.paid ? (
                      <Badge className="bg-primary/10 text-primary border-transparent">
                        Bezahlt
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Nicht bezahlt</Badge>
                    ))}
                  {r.document_no && (
                    <span className="text-xs text-muted-foreground">{r.document_no}</span>
                  )}
                </div>
                <div className="text-sm">
                  {r.courses?.name} · {formatDateBerlin(r.courses?.starts_on)} –{" "}
                  {formatDateBerlin(r.courses?.ends_on)}
                  {r.courses?.schedule ? ` · ${r.courses.schedule}` : ""}
                  {r.courses?.location ? ` · ${r.courses.location}` : ""}
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.participant_email} {r.participant_phone && `· ${r.participant_phone}`}
                  {r.price_amount != null &&
                    ` · ${Number(r.price_amount).toFixed(2).replace(".", ",")} €`}
                  {r.paid &&
                    r.paid_at &&
                    ` · bezahlt vermerkt am ${formatDateTimeBerlin(r.paid_at)}${r.paid_by && res.names[r.paid_by] ? ` von ${res.names[r.paid_by]}` : ""}`}
                  {!r.paid &&
                    r.payment_due_date &&
                    ` · fällig ${formatDateBerlin(r.payment_due_date)}`}
                </div>
                <Link to="/admin/kurse" className="text-xs text-primary underline">
                  Zu den Kursen
                </Link>
              </CardContent>
            </Card>
          ))}
        </Section>
      )}

      {res && res.mems.length > 0 && (
        <Section title={`Mitgliedschaften (${res.mems.length})`}>
          {res.mems.map((m) => {
            const fm = m.family_members || {};
            return (
              <Card key={m.id}>
                <CardContent className="p-4 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      {m.first_name} {m.last_name}
                    </span>
                    <Badge variant="outline">
                      {MEM_TYPE[m.membership_type] || m.membership_type}
                    </Badge>
                    <Badge variant="outline">{MEM_STATUS[m.status] || m.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m.email}
                    {m.phone && ` · ${m.phone}`}
                    {m.guardian_name && ` · Erziehungsberechtigt: ${m.guardian_name}`}
                  </div>
                  {(fm.partner?.name || fm.children?.length) && (
                    <div className="text-sm">
                      {fm.partner?.name && <>Partner:in: {fm.partner.name}. </>}
                      {fm.children?.length > 0 && (
                        <>Kinder: {fm.children.map((c: any) => c.name).join(", ")}</>
                      )}
                    </div>
                  )}
                  <Link to="/admin/mitgliedschaften" className="text-xs text-primary underline">
                    Zu den Mitgliedschaften
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </Section>
      )}

      {res && res.wl.length > 0 && (
        <Section title={`Warteliste (${res.wl.length})`}>
          {res.wl.map((w) => (
            <Card key={w.id}>
              <CardContent className="p-4 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{w.child_name}</span>
                  <span className="text-sm text-muted-foreground">({w.parent_name})</span>
                  <Badge variant="outline">{WL_STATUS[w.status] || w.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {w.course_programs?.name && `${w.course_programs.name} · `}
                  {w.parent_email}
                  {w.parent_phone && ` · ${w.parent_phone}`} · eingetragen{" "}
                  {formatDateBerlin(w.created_at)}
                  {w.available_from &&
                    ` · zurückgestellt bis ${formatDateBerlin(w.available_from)}`}
                </div>
                <Link to="/admin/warteliste" className="text-xs text-primary underline">
                  Zur Warteliste
                </Link>
              </CardContent>
            </Card>
          ))}
        </Section>
      )}

      {res && res.reqs.length > 0 && (
        <Section title={`Kursanfragen (${res.reqs.length})`}>
          {res.reqs.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{r.child_name || "—"}</span>
                  <span className="text-sm text-muted-foreground">({r.parent_name})</span>
                  <Badge variant="outline">{REQ_STATUS[r.status] || r.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.desired_course && `${r.desired_course} · `}
                  {r.parent_email}
                  {r.parent_phone && ` · ${r.parent_phone}`} · {formatDateBerlin(r.created_at)}
                </div>
              </CardContent>
            </Card>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-semibold text-lg">{title}</h2>
      {children}
    </section>
  );
}
