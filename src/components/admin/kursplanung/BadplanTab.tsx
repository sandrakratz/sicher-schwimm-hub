import { AlertTriangle, FileUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Planning } from "./usePlanning";
import type { PlanUpload } from "./usePlanUpload";
import { fmt } from "./utils";

export function BadplanTab({ plan, upload }: { plan: Planning; upload: PlanUpload }) {
  const { cfg, data } = plan;
  const { slots, sourceFile, taken } = data;
  const { pending, conflicts, fileRef } = upload;
  const dateInput = (label: string, value: string, set: (v: string) => void) => (
    <label className="text-xs">
      {label}
      <Input className="h-8 w-40" type="date" value={value} onChange={(e) => set(e.target.value)} />
    </label>
  );
  return (
    <>
      <section className="space-y-2 rounded-md border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Nutzungsplan {cfg.name}</div>
            <p className="text-xs text-muted-foreground">
              {slots.length
                ? `${slots.length} Termine gespeichert (${fmt(slots[0].date)} bis ${fmt(slots[slots.length - 1].date)})${sourceFile ? `, zuletzt aus „${sourceFile}“` : ""}. Ein neuer Plan überschreibt die Zeiten je Datum, deine Sperren bleiben erhalten.`
                : "Noch kein Plan gespeichert."}{" "}
              Möglich: PDF, Excel, Word, CSV oder Text.
            </p>
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.xlsx,.xlsm,.docx,.csv,.tsv,.txt"
              className="hidden"
              onChange={(e) => upload.onFile(e.target.files?.[0])}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <FileUp className="h-4 w-4" />{" "}
              {slots.length ? "Neuen Plan hochladen" : "Plan hochladen"}
            </Button>
          </div>
        </div>

        {cfg.rule && (
          <div className="flex flex-wrap items-end gap-2 border-t pt-2 text-sm">
            <span className="w-full text-xs text-muted-foreground">
              {cfg.name}: feste Nutzungszeit {cfg.dayName}s {cfg.rule.start}–{cfg.rule.end} Uhr, nur
              das ganze Bad. Zeitraum angeben, die Termine werden vorgeschlagen:
            </span>
            {dateInput("von", upload.ruleFrom, upload.setRuleFrom)}
            {dateInput("bis", upload.ruleTo, upload.setRuleTo)}
            <Button size="sm" variant="outline" onClick={upload.generateRule}>
              {cfg.dayName}e erzeugen
            </Button>
          </div>
        )}
      </section>

      {pending && (
        <section className="space-y-2 rounded-md bg-muted/40 p-3 text-sm">
          <div className="font-medium">
            {pending.file}: {pending.parsed.length} Termine erkannt,{" "}
            {pending.diff.length
              ? `${pending.diff.length} Änderungen zum gespeicherten Plan`
              : "keine Änderungen"}
          </div>
          {pending.diff.length > 0 && (
            <ul className="max-h-60 space-y-0.5 overflow-y-auto text-xs">
              {pending.diff.map((d) => (
                <li key={d.date}>
                  <Badge variant="outline" className="mr-2">
                    {d.kind}
                  </Badge>
                  {fmt(d.date)}: {d.was} → {d.now}
                  {(taken[d.date] ?? []).length > 0 && (
                    <span className="ml-2 font-semibold text-red-600">
                      Achtung: {(taken[d.date] ?? []).map((t) => t.name).join(", ")} läuft schon
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Button size="sm" disabled={upload.busy} onClick={upload.applyPlan}>
              Plan übernehmen
            </Button>
            <Button size="sm" variant="ghost" onClick={() => upload.setPending(null)}>
              Verwerfen
            </Button>
          </div>
        </section>
      )}

      {conflicts.length > 0 && (
        <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs">
          <div className="flex items-center gap-1 font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" /> Bereits angelegte Kurse sind betroffen – bitte
            Termine prüfen und Eltern informieren:
          </div>
          {conflicts.map((c) => (
            <div key={c}>{c}</div>
          ))}
        </div>
      )}
    </>
  );
}
