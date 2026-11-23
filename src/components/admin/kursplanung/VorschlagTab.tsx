import { CalendarPlus, Wand2 } from "lucide-react";
import type { ReactNode } from "react";
import type { ProgramRow } from "@/components/admin/kurse/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { hourStart, type PlannedTerm } from "@/lib/pool-schedule";
import type { Planning } from "./usePlanning";
import { fmt, hhmm, short, time, type Kind } from "./utils";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="text-[11px] text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

/** Zahlenfeld mit Untergrenze; leere oder ungültige Eingabe ergibt das Minimum. */
function NumField({
  label,
  value,
  onChange,
  min = 1,
  max = Infinity,
  className = "h-8",
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  return (
    <Field label={label}>
      <Input
        className={className}
        type="number"
        value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
      />
    </Field>
  );
}

/** Eine Kursart: ankreuzen, Startzeit, Anzahl, Beginn und Details (Bahnen, Dauer, Termine, Plätze, Trainer). */
function KindRow({ p, plan }: { p: ProgramRow; plan: Planning }) {
  const k = plan.kinds.find((x) => x.id === p.id);
  const on = !!k && k.count > 0;
  const set = (patch: Partial<Kind>) => plan.patchKind(p.id, patch);
  const dem = k ? plan.demandOf(k) : plan.demandFor(p.id, null);
  const mx = k ? plan.maxFor(k) : null;
  const { cfg, typical, nBlocks } = plan;
  return (
    <div className={`rounded-md border p-2.5 ${on ? "" : "bg-muted/30"}`}>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <label className="flex min-w-[14rem] flex-1 cursor-pointer items-center gap-2 self-center text-sm font-semibold">
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => plan.toggleKind(p.id, e.target.checked)}
          />
          {p.name}
          {plan.waiting !== null && (
            <span className="text-xs font-normal text-muted-foreground">
              {dem} wartend{mx && on ? ` (≈ ${(dem / mx).toFixed(1)} Kurse)` : ""}
            </span>
          )}
        </label>
        {on && k && (
          <>
            <Field label="Startzeit">
              <Select value={String(k.block)} onValueChange={(v) => set({ block: Number(v) })}>
                <SelectTrigger className="h-8 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: Math.max(2, nBlocks, k.block + 1) }, (_, b) => (
                    <SelectItem key={b} value={String(b)}>
                      {b + 1}. Stunde
                      {typical?.start ? ` · ${hhmm(hourStart(typical, b))} Uhr` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <NumField
              label="Kurse parallel"
              className="h-8 w-20"
              value={k.count}
              onChange={(count) => set({ count })}
            />
            <Field label="Start frühestens">
              <Input
                className="h-8 w-40"
                type="date"
                value={k.from ?? ""}
                onChange={(e) => set({ from: e.target.value || null })}
              />
            </Field>
          </>
        )}
      </div>
      {on && k && (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Bahnen, Dauer, Termine, Plätze, Trainer ({k.lanes} {k.lanes === 1 ? "Bahn" : "Bahnen"},{" "}
            {k.minutes} Min., {k.units} Termine)
          </summary>
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <NumField
              label="Bahnen"
              value={k.lanes}
              max={cfg.lanes}
              onChange={(lanes) => set({ lanes })}
            />
            <NumField
              label="Minuten"
              value={k.minutes}
              min={15}
              onChange={(minutes) => set({ minutes })}
            />
            <NumField
              label="Termine je Kurs"
              value={k.units}
              max={30}
              onChange={(units) => set({ units })}
            />
            <Field label="Plätze">
              <Input
                className="h-8"
                type="number"
                value={k.max ?? mx ?? ""}
                onChange={(e) => set({ max: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
            <NumField
              label="Trainer"
              value={k.trainers}
              max={10}
              onChange={(trainers) => set({ trainers })}
            />
          </div>
        </details>
      )}
    </div>
  );
}

/** Ein vorgeschlagener Kurszeitraum mit Auswahl, Hinweisen und Anpassung einzelner Termine. */
function TermCard({ t, plan }: { t: PlannedTerm; plan: Planning }) {
  const { terms, adjust, setAdj } = plan;
  const trackId = t.track.id;
  const ov = plan.overlap(t);
  const first = t.sessions[0];
  const last = t.sessions[t.sessions.length - 1];
  const k = plan.kinds.find((x) => x.id === t.track.kindId)!;
  const th = plan.staffGaps(t);
  const same = terms.filter((x) => x.track.id === trackId);
  const isFirst = same[0] === t;
  const odd = t.sessions.filter((s) => s.start !== first.start);
  const prev = same[same.indexOf(t) - 1];
  const prevLast = prev ? prev.sessions[prev.sessions.length - 1].date : "";
  // Von Hand ausgelassene Tage, die in diesen Zeitraum fallen.
  const byHand = Object.entries(adjust)
    .filter(([key, a]) => a.skip && key.startsWith(`${trackId}|`))
    .map(([key]) => key.slice(trackId.length + 1))
    .filter((date) => date > prevLast && date <= last.date)
    .sort();
  const notices = plan.noticeDates(t);
  return (
    <div className="rounded border p-2 text-sm">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={plan.isSelected(t)}
          onChange={(e) => plan.setToggled((m) => ({ ...m, [t.id]: e.target.checked }))}
        />
        <div className="flex-1">
          <div className="font-medium">
            {plan.programName(t.track.kindId)}
            {k.count > 1 ? ` ${t.track.copy}` : ""}
            <span className="font-normal text-muted-foreground">
              {" "}
              · {fmt(first.date)} bis {fmt(last.date)} · {t.sessions.length} Termine · {first.start}
              –{first.end} Uhr
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1 text-[11px]">
            {isFirst && plan.waiting !== null && (
              <Badge variant="outline" className="text-emerald-700">
                {plan.demandFor(t.track.kindId, first.date)} wartend
              </Badge>
            )}
            {t.breaks.length > 0 && (
              <Badge variant="outline">
                Pausen: {t.breaks.map((b) => `${short(b.date)} ${b.note}`).join(", ")}
              </Badge>
            )}
            {odd.length > 0 && (
              <Badge variant="outline">
                andere Zeit: {odd.map((s) => `${short(s.date)} ${s.start}`).join(", ")}
              </Badge>
            )}
            {!t.complete && (
              <Badge variant="outline" className="text-amber-700">
                nur {t.sessions.length} von {k.units} Terminen (Vertragsende)
              </Badge>
            )}
            {th.length > 0 && (
              <Badge
                variant="outline"
                className={th.some((c) => c.hard) ? "text-red-600" : "text-amber-700"}
                title="frei / benötigt; „schon eingeteilt“ = Trainer sind zur selben Zeit in einem anderen Kurs"
              >
                Trainer:{" "}
                {th
                  .map(
                    (c) =>
                      `${short(c.date)} ${c.st.yes + (plan.surveyed ? 0 : c.st.unknown)}/${c.req}${c.st.busy ? ` (${c.st.busy} schon eingeteilt)` : ""}`,
                  )
                  .join(", ")}
              </Badge>
            )}
            {ov && (
              <Badge variant="outline" className="text-red-600">
                überschneidet {ov}
              </Badge>
            )}
          </div>
        </div>
      </label>
      <label className="ml-7 mt-1 flex cursor-pointer items-start gap-2 text-xs">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={plan.hasNotice(t)}
          onChange={(e) => plan.setNoticeOn((m) => ({ ...m, [t.id]: e.target.checked }))}
        />
        <span>
          Hinweis für Eltern: Uhrzeit kann sich bis 5 Tage vorher ändern
          {notices.length > 0 && (
            <span className="text-muted-foreground">
              {" "}
              – laut Badplan betrifft das {notices.map(short).join(", ")}
            </span>
          )}
        </span>
      </label>
      <details className="ml-7 mt-1">
        <summary className="cursor-pointer text-xs text-muted-foreground">Termine anpassen</summary>
        <ul className="mt-1 space-y-1 text-xs">
          {t.sessions.map((s) => (
            <li key={s.date} className="flex flex-wrap items-center gap-2">
              <span className="w-28 font-medium">{fmt(s.date)}</span>
              <Input
                className="h-7 w-28"
                type="time"
                step={300}
                value={s.start}
                onChange={(e) =>
                  e.target.value && setAdj(trackId, s.date, { start: e.target.value })
                }
              />
              <span className="text-muted-foreground">bis {s.end} Uhr</span>
              {s.manual && (
                <button
                  type="button"
                  className="underline"
                  onClick={() => setAdj(trackId, s.date, { start: undefined })}
                >
                  Zeit zurücksetzen
                </button>
              )}
              {s.moved && <span className="text-amber-700">frühere Stunde (Badzeit/belegt)</span>}
              <button
                type="button"
                className="text-destructive underline"
                onClick={() => setAdj(trackId, s.date, { skip: true })}
              >
                Tag auslassen
              </button>
            </li>
          ))}
          {byHand.map((date) => (
            <li key={date} className="flex flex-wrap items-center gap-2">
              <span className="w-28 text-muted-foreground line-through">{fmt(date)}</span>
              <span className="text-muted-foreground">ausgelassen</span>
              <button
                type="button"
                className="underline"
                onClick={() => setAdj(trackId, date, { skip: false })}
              >
                wieder aufnehmen
              </button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function VorschlagTab({ plan }: { plan: Planning }) {
  const { cfg, data, kindRows, terms, chosen, typical, adjust } = plan;
  const more = data.programs.filter((p) => !kindRows.some((r) => r.id === p.id));
  const changes = Object.keys(adjust).length;

  return (
    <>
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">
              1. Welche Kurse sollen jeden {cfg.dayName} laufen?
            </div>
            <p className="text-xs text-muted-foreground">
              Kurse ankreuzen und Startzeit wählen: die 1. Stunde beginnt mit der Badzeit, die 2.
              Stunde eine Stunde später. Termine und abweichende Badzeiten kommen aus dem Badplan.{" "}
              {cfg.name} hat {cfg.lanes} {cfg.lanes === 1 ? "Bahn (nur ganzes Bad)" : "Bahnen"}.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={plan.applyDemand}>
            <Wand2 className="h-4 w-4" /> Nach Warteliste vorschlagen
          </Button>
        </div>

        <div className="space-y-1.5">
          {kindRows.map((p) => (
            <KindRow key={p.id} p={p} plan={plan} />
          ))}
        </div>

        {more.length > 0 && (
          <Select value="" onValueChange={(id) => plan.toggleKind(id, true)}>
            <SelectTrigger className="h-8 w-72">
              <SelectValue placeholder="Weiteres Kursangebot hinzufügen…" />
            </SelectTrigger>
            <SelectContent>
              {more.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  {p.location ? ` · ${p.location}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {Object.entries(plan.usage).map(([b, n]) => (
            <span
              key={b}
              className={n > cfg.lanes ? "font-semibold text-red-600" : "text-muted-foreground"}
            >
              {Number(b) + 1}. Stunde: {n}/{cfg.lanes} Bahnen
              {n > cfg.lanes ? " – zu viele!" : ""}
            </span>
          ))}
          {plan.noFit.map(({ k, fit }) => (
            <span key={k.id} className="font-semibold text-red-600">
              {plan.programName(k.id)}: nur {fit} von {k.count} Kursen pro Tag passen in die
              Badezeit ({time(typical)})
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">2. Vorgeschlagene Kurszeiträume</div>
            <p className="text-xs text-muted-foreground">
              Bereits laufende Kurse, gesperrte Termine und Feiertage sind berücksichtigt; die
              Uhrzeiten richten sich nach der Badzeit des jeweiligen Tages. Unter „Termine“ kannst
              du einzelne Tage auslassen oder die Uhrzeit ändern. Was du ankreuzt, siehst du im
              Terminplan gestrichelt.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button disabled={plan.busy || !chosen.length} onClick={plan.createTerms}>
              <CalendarPlus className="h-4 w-4" /> {chosen.length} anlegen
            </Button>
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={plan.publish}
                onChange={(e) => plan.setPublish(e.target.checked)}
              />
              gleich auf der Webseite zeigen
            </label>
            {changes > 0 && (
              <button
                type="button"
                className="text-[11px] text-muted-foreground underline"
                onClick={() => plan.setAdjust({})}
              >
                {changes} Änderungen zurücksetzen
              </button>
            )}
          </div>
        </div>
        {!terms.length && (
          <p className="text-sm text-muted-foreground">
            Mit diesen Einstellungen ist kein Zeitraum möglich.
          </p>
        )}
        <div className="space-y-1">
          {terms.map((t) => (
            <TermCard key={t.id} t={t} plan={plan} />
          ))}
        </div>
      </section>
    </>
  );
}
