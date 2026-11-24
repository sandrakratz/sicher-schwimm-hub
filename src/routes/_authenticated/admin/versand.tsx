import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlarmClock,
  ArrowRight,
  CalendarDays,
  Euro,
  Mail,
  Megaphone,
  Newspaper,
  Smartphone,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDateBerlin } from "@/lib/format";
import { canNotify } from "@/lib/news-notice";
import { CourseBroadcastDialog } from "@/components/admin/CourseBroadcastDialog";
import { CourseSessionsMailDialog } from "@/components/admin/CourseSessionsMailDialog";
import { NewsNoticeDialog } from "@/components/admin/NewsNoticeDialog";
import { MemberMessage } from "@/components/admin/versand/MemberMessage";
import { useCourseMailings } from "@/components/admin/kurse/useCourseMailings";

/** Alle Rundmails an einem Ort. Jede Art nutzt denselben Baustein wie bisher an ihrer alten Stelle. */
const KINDS = [
  {
    id: "eil",
    icon: Megaphone,
    label: "Eilnachricht an die Eltern eines Kurses",
    hint: "z. B. Ausfall, Verspätung – per Mail und Handy-Mitteilung",
  },
  {
    id: "termine",
    icon: CalendarDays,
    label: "Kurstermine nachsenden",
    hint: "alle Termine eines Kurses noch einmal an die Eltern",
  },
  {
    id: "mitglieder",
    icon: Users,
    label: "Mitglieder anschreiben",
    hint: "Nachricht ins Portal-Postfach ausgewählter Mitglieder",
  },
  {
    id: "news",
    icon: Newspaper,
    label: "Auf einen News-Beitrag hinweisen",
    hint: "Hinweis-Mail an alle aktiven Mitglieder",
  },
  {
    id: "zahlung",
    icon: Euro,
    label: "Zahlungserinnerungen",
    hint: "an alle offenen Fälle (Sofortzahlung erwartet oder überfällig)",
  },
  {
    id: "abmelde",
    icon: AlarmClock,
    label: "Abmelde-Link an Familien laufender Kurse",
    hint: "einmalige Info-Mail, wie Eltern ihr Kind abmelden",
  },
  {
    id: "push",
    icon: Smartphone,
    label: "Info-Mail zu Handy-Mitteilungen",
    hint: "einmalig an alle gebuchten Familien",
  },
] as const;

type Kind = (typeof KINDS)[number]["id"];
const isKind = (v: unknown): v is Kind => KINDS.some((k) => k.id === v);

export const Route = createFileRoute("/_authenticated/admin/versand")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { art?: Kind } =>
    isKind(search["art"]) ? { art: search["art"] } : {},
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
  head: () => ({
    meta: [{ title: "Versand – Verwaltung" }, { name: "robots", content: "noindex, nofollow" }],
  }),
});

type CourseOption = { id: string; name: string; starts_on: string | null };

/** Laufende und kommende Kurszeiträume (nicht archiviert) für die Kursauswahl. */
function useCourses() {
  const [courses, setCourses] = useState<CourseOption[] | null>(null);
  useEffect(() => {
    void supabase
      .from("courses")
      .select("id,name,starts_on")
      .is("archived_at", null)
      .order("starts_on", { ascending: true })
      .then(({ data }) => setCourses((data ?? []) as CourseOption[]));
  }, []);
  return courses;
}

/** Kurs wählen, dann den Dialog der jeweiligen Mail öffnen. */
function CourseMail({ kind }: { kind: "eil" | "termine" }) {
  const courses = useCourses();
  const [courseId, setCourseId] = useState("");
  const [open, setOpen] = useState<{ id: string; name: string } | null>(null);
  const picked = courses?.find((c) => c.id === courseId) ?? null;
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="versand-kurs" className="text-sm font-semibold">
          Kurs
        </label>
        <NativeSelect
          id="versand-kurs"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          disabled={!courses}
        >
          <option value="">{courses ? "Bitte wählen …" : "Wird geladen …"}</option>
          {(courses ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.starts_on ? ` · ab ${formatDateBerlin(c.starts_on)}` : ""}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button
        disabled={!picked}
        onClick={() => picked && setOpen({ id: picked.id, name: picked.name })}
      >
        {kind === "eil" ? "Eilnachricht schreiben" : "Termine ansehen und senden"}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
      {kind === "eil" ? (
        <CourseBroadcastDialog course={open} onClose={() => setOpen(null)} />
      ) : (
        <CourseSessionsMailDialog course={open} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

type NewsRow = {
  id: string;
  title: string;
  published: boolean;
  visibility: string;
  published_at: string | null;
};

/** Veröffentlichte Beiträge, auf die per Mail hingewiesen werden kann. */
function NewsMail() {
  const [rows, setRows] = useState<NewsRow[] | null>(null);
  const [noticeFor, setNoticeFor] = useState<string | null>(null);
  useEffect(() => {
    void supabase
      .from("news")
      .select("id,title,published,visibility,published_at")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(15)
      .then(({ data }) => setRows(((data ?? []) as NewsRow[]).filter(canNotify)));
  }, []);
  if (!rows) return <p className="text-sm text-muted-foreground">Wird geladen …</p>;
  if (rows.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Kein veröffentlichter Beitrag für Öffentlichkeit oder Mitglieder.{" "}
        <Link to="/admin/news" className="underline">
          Zu den News
        </Link>
      </p>
    );
  return (
    <div className="space-y-2">
      {rows.map((n) => (
        <div
          key={n.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3"
        >
          <span>
            <span className="font-semibold">{n.title}</span>
            <span className="block text-xs text-muted-foreground">
              {n.published_at ? `veröffentlicht ${formatDateBerlin(n.published_at)}` : ""}
            </span>
          </span>
          <Button size="sm" onClick={() => setNoticeFor(n.id)}>
            <Mail className="h-4 w-4" aria-hidden="true" /> Mitglieder informieren
          </Button>
        </div>
      ))}
      <NewsNoticeDialog newsId={noticeFor} onClose={() => setNoticeFor(null)} />
    </div>
  );
}

/** Sammel-Mails ohne Auswahl: ein Knopf, die bisherige Rückfrage bleibt. */
function OneClickMail({ kind }: { kind: "zahlung" | "abmelde" | "push" }) {
  const m = useCourseMailings();
  const cfg = {
    zahlung: {
      text: "Erinnert alle Familien, deren Zahlung sofort erwartet wird oder überfällig ist. Vor dem Senden kommt eine Rückfrage.",
      busy: m.reminding,
      label: "Zahlungserinnerungen senden",
      run: () => m.handleSendReminders(null),
    },
    abmelde: {
      text: "Jede Adresse bekommt diese Mail nur ein einziges Mal. Pro Klick werden bis zu 12 Familien bedient – bei Rest einfach erneut klicken.",
      busy: m.inviteAbsence,
      label: "Abmelde-Link senden",
      run: m.handleSendAbsenceInvites,
    },
    push: {
      text: "Link zum Aktivieren der Handy-Mitteilungen. Jede Familie bekommt diese Mail nur ein einziges Mal.",
      busy: m.inviting,
      label: "Info-Mail senden",
      run: m.handleSendPushInvites,
    },
  }[kind];
  return (
    <div className="space-y-4">
      <p>{cfg.text}</p>
      <Button disabled={cfg.busy} onClick={() => void cfg.run()}>
        {cfg.busy ? "Sende …" : cfg.label}
      </Button>
    </div>
  );
}

function Page() {
  const { art } = Route.useSearch();
  const navigate = useNavigate();
  const kind: Kind = art ?? "eil";
  const current = KINDS.find((k) => k.id === kind)!;
  const Icon = current.icon;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-bold text-primary-deep">Versand</h1>
          <p className="text-muted-foreground mt-1">
            Jede Mail an viele Empfänger entsteht hier. Was rausgegangen ist, steht unter „Gesendete
            E-Mails“.
          </p>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <nav aria-label="Art der Mail" className="space-y-2 lg:sticky lg:top-6 lg:self-start">
          {KINDS.map((k) => {
            const KIcon = k.icon;
            const on = k.id === kind;
            return (
              <button
                key={k.id}
                type="button"
                aria-pressed={on}
                onClick={() => void navigate({ to: "/admin/versand", search: { art: k.id } })}
                className={`w-full text-left grid grid-cols-[2.25rem_1fr] items-center gap-3 rounded-xl px-4 py-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  on ? "bg-secondary ring-2 ring-primary" : "bg-card hover:bg-surface shadow-soft"
                }`}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary-deep">
                  <KIcon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold">{k.label}</span>
                  <span className="block text-xs text-muted-foreground">{k.hint}</span>
                </span>
              </button>
            );
          })}
        </nav>
        <section aria-label={current.label} className="min-w-0 rounded-2xl bg-secondary/60 p-6">
          <div className="mb-5 flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card text-primary-deep shadow-soft">
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-2xl font-bold text-primary-deep">{current.label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{current.hint}</p>
            </div>
          </div>
          <Card className="border-0 shadow-soft">
            <CardContent className="p-5">
              {(kind === "eil" || kind === "termine") && <CourseMail key={kind} kind={kind} />}
              {kind === "mitglieder" && <MemberMessage embedded />}
              {kind === "news" && <NewsMail />}
              {(kind === "zahlung" || kind === "abmelde" || kind === "push") && (
                <OneClickMail kind={kind} />
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
