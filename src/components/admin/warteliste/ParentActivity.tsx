import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { formatDateBerlin, formatDateTimeBerlin } from "@/lib/format";
import { STATUS_TONE, STATUS_WORD, parentActionOf, type Todo, type WaitlistEntry } from "./logic";
import { EntryName, FamilyLink, Item, Section } from "./ui";

const STATUS_LEGEND: Array<[string, string]> = [
  ["wartend", STATUS_TONE["waiting"]!],
  ["Angebot offen", STATUS_TONE["offered"]!],
  ["gebucht", STATUS_TONE["accepted"]!],
  ["abgesagt / abgemeldet", STATUS_TONE["removed"]!],
];

const ACTIVITY_LABEL = {
  request: "Kursanfrage",
  message: "Nachricht",
  membership: "Mitgliedsantrag",
  majority: "Volljährigkeit bestätigt",
};

const LINK = "font-medium text-primary underline underline-offset-2";

/** Rechte Seite einer Zeile: Badges und Zeitpunkt. */
function Meta({ children }: { children: ReactNode }) {
  return <span className="flex items-center gap-2 text-xs text-muted-foreground">{children}</span>;
}

/** „Aktionen der Eltern in den letzten 7 Tagen“: Einträge, Online-Buchungen und Sonstiges. */
export function ParentActivity({
  t,
  entryTarget,
  onOpenDetail,
}: {
  t: Todo;
  entryTarget: (e: WaitlistEntry) => string;
  onOpenDetail: (e: WaitlistEntry) => void;
}) {
  const total = t.newEntries.length + t.newDirect.length + t.newOther.length;
  const items = [
    ...t.newDirect.map((b) => ({ at: b.created_at, kind: "direct" as const, b })),
    ...t.newEntries.map((e) => ({ at: parentActionOf(e).at, kind: "entry" as const, e })),
    ...t.newOther.map((a) => ({ at: a.at, kind: "other" as const, a })),
  ].sort((x, y) => y.at.localeCompare(x.at));

  return (
    <Section title="Aktionen der Eltern in den letzten 7 Tagen" count={total}>
      {total === 0 && (
        <li className="py-2 text-muted-foreground">
          Keine Aktionen der Eltern in den letzten 7 Tagen.
        </li>
      )}
      {items.map((item) => {
        if (item.kind === "direct") {
          const b = item.b;
          return (
            <Item key={`d-${b.id}`}>
              <span className="inline-flex flex-wrap items-center gap-2">
                {b.request_id ? (
                  <Link to="/admin/archiv" search={{ anfrage: b.request_id }} className={LINK}>
                    {b.child_name}
                  </Link>
                ) : (
                  <span className="font-medium">{b.child_name}</span>
                )}
                <FamilyLink email={b.parent_email ?? ""} />
                <span className="text-muted-foreground">{b.parent_email}</span>
              </span>
              <Meta>
                <Badge
                  variant="secondary"
                  className={b.status === "confirmed" ? STATUS_TONE["accepted"] : undefined}
                >
                  {b.status === "confirmed" ? "Online gebucht" : b.status} · {b.course_name}
                </Badge>
                {formatDateTimeBerlin(b.created_at)}
              </Meta>
            </Item>
          );
        }
        if (item.kind === "entry") {
          const e = item.e;
          const act = parentActionOf(e);
          const word = STATUS_WORD[e.status] ?? e.status;
          return (
            <Item key={`e-${e.id}`}>
              <span>
                <EntryName e={e} onOpen={onOpenDetail} />{" "}
                <span className="text-muted-foreground">{e.parent_email}</span>
                {act.detail && (
                  <span className="block text-xs text-muted-foreground">{act.detail}</span>
                )}
              </span>
              <Meta>
                <Badge variant="secondary" title={`${act.what} · Stand jetzt: ${word}`}>
                  {act.what} · {entryTarget(e)}
                </Badge>
                <Badge variant="secondary" className={STATUS_TONE[e.status]}>
                  {word}
                </Badge>
                <span title={`Eingegangen ${formatDateBerlin(e.created_at)}`}>
                  {formatDateTimeBerlin(act.at)}
                </span>
              </Meta>
            </Item>
          );
        }
        const a = item.a;
        return (
          <Item key={`o-${a.kind}-${a.id}`}>
            <span className="inline-flex flex-wrap items-center gap-2">
              {a.kind === "request" ? (
                <Link to="/admin/archiv" search={{ anfrage: a.id }} className={LINK}>
                  {a.name}
                </Link>
              ) : (
                <Link
                  to={a.kind === "message" ? "/admin/nachrichten" : "/admin/mitglieder"}
                  className={LINK}
                >
                  {a.name}
                </Link>
              )}
              {a.email && <FamilyLink email={a.email} />}
              <span className="text-muted-foreground">{a.email}</span>
            </span>
            <Meta>
              <Badge variant="secondary">
                {ACTIVITY_LABEL[a.kind]}
                {a.detail ? ` · ${a.detail}` : ""}
              </Badge>
              {formatDateTimeBerlin(a.at)}
            </Meta>
          </Item>
        );
      })}
      <li className="flex flex-wrap items-center gap-2 pt-3 text-xs text-muted-foreground">
        Farben:
        {STATUS_LEGEND.map(([label, tone]) => (
          <Badge key={label} variant="secondary" className={tone}>
            {label}
          </Badge>
        ))}
        <Badge variant="secondary">sonstiges</Badge>
      </li>
    </Section>
  );
}
