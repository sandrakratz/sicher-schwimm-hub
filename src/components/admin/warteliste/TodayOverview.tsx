import type { TodayOnly, TodayView, Todo, WaitingKind } from "./logic";
import { Tile, TileRow, type Tone } from "./ui";

/** Ton einer Kachel: nur hervorheben, wenn es etwas zu tun gibt. */
const toneIf = (n: number, tone: Tone): Tone => (n > 0 ? tone : "normal");

const shortName = (name: string) => name.replace(/^Schwimmabzeichen /, "");

/** Kachelübersicht von „Heute“: jede Kachel öffnet einen Bereich oder einen Reiter. */
export function TodayOverview({
  t,
  counts,
  onOnly,
  onGoto,
  onWaitingKind,
}: {
  t: Todo;
  counts: { offered: number; followup: number; declined: number; done: number };
  onOnly: (o: TodayOnly) => void;
  onGoto: (v: TodayView) => void;
  onWaitingKind: (k: WaitingKind) => void;
}) {
  const today = [...t.newToday, ...t.newDirectToday, ...t.newOtherToday];
  return (
    <div className="space-y-5">
      <TileRow title="Eingang · neu in den letzten 7 Tagen">
        <Tile
          n={t.newEntries.length + t.newDirect.length + t.newOther.length}
          label="Aktionen der Eltern"
          hint={
            today.length > 0
              ? `heute: ${today.map((e) => ("name" in e ? e.name : e.child_name)).join(", ")}`
              : "heute noch nichts"
          }
          tone={toneIf(today.length, "warn")}
          onClick={() => onOnly("new")}
        />
        <Tile
          n={t.newUnassigned.length}
          label="Davon nicht zugewiesen"
          hint="noch niemand zuständig"
          tone={toneIf(t.newUnassigned.length, "warn")}
          action="Zuweisen"
          onClick={() => onOnly("new")}
        />
      </TileRow>

      <TileRow title="Wartend · wer wartet warum">
        <Tile
          n={t.waitNow.length}
          label="Wartet auf einen Platz"
          hint="Niveau und Wunsch passen"
          onClick={() => onWaitingKind("now")}
        />
        <Tile
          n={t.waitUnmet.length}
          label="Voraussetzung nicht erfüllt"
          hint="Niveau oder Wunschtag passt nicht"
          tone={toneIf(t.waitUnmet.length, "warn")}
          action="Prüfen"
          onClick={() => onWaitingKind("unmet")}
        />
        <Tile
          n={t.waitLater.length}
          label="Später gewünscht"
          hint="auf Elternwunsch ab einem Datum"
          onClick={() => onWaitingKind("later")}
        />
      </TileRow>

      <TileRow title="Angebote und Fristen">
        <Tile
          n={t.expiringOffers.length}
          label="Laufen in 48 Std. ab"
          hint="Absage erfassen oder abwarten"
          tone={toneIf(t.expiringOffers.length, "urgent")}
          onClick={() => onOnly("expiring")}
        />
        <Tile
          n={counts.offered}
          label="Angebote offen"
          hint="Antwort der Eltern steht aus"
          onClick={() => onGoto("offered")}
        />
        <Tile
          n={counts.followup}
          label="Rückfrage offen"
          hint="„Warteliste behalten?“"
          tone={toneIf(counts.followup, "warn")}
          onClick={() => onGoto("followup")}
        />
        <Tile
          n={t.dueFollowUps.length}
          label="Wiedervorlage fällig"
          hint="heute nachfassen"
          tone={toneIf(t.dueFollowUps.length, "urgent")}
          onClick={() => onOnly("due")}
        />
      </TileRow>

      <TileRow title="Plätze und Kurse">
        <Tile
          n={t.freeCourses.length}
          label="Freie Plätze mit Familien"
          hint={
            t.freeCourses.length > 0
              ? t.freeCourses
                  .slice(0, 3)
                  .map((x) => `${shortName(x.course.name)} ${x.course.free}`)
                  .join(" · ")
              : "keine passenden Familien"
          }
          tone={toneIf(t.freeCourses.length, "warn")}
          action="Plätze vergeben"
          onClick={() => onOnly("free")}
        />
        <Tile
          n={t.fitChecks.length}
          label="Passt das? Manuell prüfen"
          hint="freier Platz, aber nichts passt automatisch"
          tone={toneIf(t.fitChecks.length, "urgent")}
          action="Prüfen"
          onClick={() => onOnly("fit")}
        />
        <Tile
          n={t.minCourses.length}
          label="Mindestzahl nicht erreicht"
          hint={
            t.minCourses.length > 0
              ? t.minCourses
                  .slice(0, 2)
                  .map((c) => `${shortName(c.name)} ${c.confirmed}/${c.min_participants}`)
                  .join(" · ")
              : "alle Kurse über der Mindestzahl"
          }
          tone={toneIf(t.minCourses.length, "warn")}
          onClick={() => onOnly("min")}
        />
        <Tile
          n={null}
          label="Nachfrage je Angebot"
          hint="wo ein zusätzlicher Kurs lohnt"
          onClick={() => onGoto("report")}
        />
      </TileRow>

      <TileRow title="Klärung und Verlauf">
        <Tile
          n={t.suggestions.length}
          label="Sperrliste prüfen"
          hint="ab 3 Absagen oder Stornos"
          tone={toneIf(t.suggestions.length, "urgent")}
          onClick={() => onOnly("suggestions")}
        />
        <Tile
          n={counts.declined}
          label="Absagen und Stornos"
          hint="zum Nachhalten"
          onClick={() => onGoto("declined")}
        />
        <Tile
          n={counts.done}
          label="Archiv"
          hint="erledigte Einträge"
          onClick={() => onGoto("done")}
        />
      </TileRow>
    </div>
  );
}
