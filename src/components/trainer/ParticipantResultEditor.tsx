import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { updateParticipantResult } from "@/lib/trainer-courses.functions";
import {
  EXAM_LEVELS,
  findExamLevel,
  allCriteriaDone,
  countCriteriaDone,
  type ExamCriteriaState,
} from "@/lib/swim-exams";
import { toast } from "sonner";

export type ParticipantResult = {
  goal_reached: boolean | null;
  badge: string | null;
  achievement: string | null;
  exam_level?: string | null;
  exam_criteria?: ExamCriteriaState;
  exam_date?: string | null;
  exam_pass_no?: string | null;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Prüfungsnachweis vor Ort erfassen: Abzeichenstufe, Teilleistungen nach DPO,
 * Prüfungsdatum, Schwimmpass-Nr., Gesamtergebnis und Anmerkung.
 */
export function ParticipantResultEditor({
  participantId,
  value,
  onSaved,
}: {
  participantId: string;
  value: ParticipantResult;
  onSaved?: (participantId: string, result: ParticipantResult) => void;
}) {
  const save = useServerFn(updateParticipantResult);
  const [goal, setGoal] = useState<boolean | null>(value.goal_reached);
  const [badge, setBadge] = useState(value.badge || "");
  const [achievement, setAchievement] = useState(value.achievement || "");
  const [level, setLevel] = useState(value.exam_level || "");
  const [criteria, setCriteria] = useState<ExamCriteriaState>(value.exam_criteria || {});
  const [examDate, setExamDate] = useState(value.exam_date || "");
  const [passNo, setPassNo] = useState(value.exam_pass_no || "");
  const [saving, setSaving] = useState(false);

  const levelDef = findExamLevel(level);
  const doneCount = countCriteriaDone(level, criteria);
  const complete = allCriteriaDone(level, criteria);

  function setCriterion(key: string, patch: { done?: boolean; value?: string; total?: string }) {
    setCriteria(prev => {
      const next = { ...prev, [key]: { ...prev[key], ...patch } };
      // Sobald alle Teile erfüllt sind, das Gesamtergebnis vorschlagen.
      if (patch.done && allCriteriaDone(level, next)) {
        setGoal(true);
        if (!examDate) setExamDate(todayIso());
      }
      return next;
    });
  }

  function chooseLevel(next: string) {
    setLevel(next);
    const def = findExamLevel(next);
    if (def && !badge) setBadge(def.label);
  }

  async function submit() {
    setSaving(true);
    try {
      const res = await save({
        data: {
          participantId,
          goalReached: goal,
          badge,
          achievement,
          examLevel: level || null,
          examCriteria: criteria,
          examDate: examDate || null,
          examPassNo: passNo || null,
        },
      });
      onSaved?.(participantId, {
        goal_reached: res.goal_reached,
        badge: res.badge,
        achievement: res.achievement,
        exam_level: res.exam_level,
        exam_criteria: res.exam_criteria,
        exam_date: res.exam_date,
        exam_pass_no: res.exam_pass_no,
      });
      toast.success("Prüfungsnachweis gespeichert");
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Abzeichen / Prüfungsstufe</Label>
        <Select value={level || "none"} onValueChange={v => chooseLevel(v === "none" ? "" : v)}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Bitte wählen" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Keine Prüfung —</SelectItem>
            {EXAM_LEVELS.map(l => (
              <SelectItem key={l.key} value={l.key}>{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {levelDef && (
        <div className="rounded-md border p-3">
          <p className="mb-2 text-xs font-semibold">
            Prüfungsteile ({doneCount} von {levelDef.criteria.length} erfüllt)
          </p>
          <div className="space-y-2">
            {levelDef.criteria.map(c => {
              const state = criteria[c.key] || {};
              return (
                <div key={c.key} className="space-y-1">
                  <label className="flex items-start gap-2 text-xs">
                    <Checkbox
                      className="mt-0.5"
                      checked={state.done === true}
                      onCheckedChange={v => setCriterion(c.key, { done: v === true })}
                    />
                    <span>{c.label}</span>
                  </label>
                  {c.valueLabel && (
                    <div className="ml-6 space-y-1">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">{c.valueLabel}</Label>
                        <Input
                          className="h-8 w-40"
                          placeholder={c.valuePlaceholder || c.valueLabel}
                          value={state.value || ""}
                          onChange={e => setCriterion(c.key, { value: e.target.value })}
                        />
                      </div>
                      {c.totalLabel && (
                        <div>
                          <Label className="text-[11px] text-muted-foreground">{c.totalLabel}</Label>
                          <Input
                            className="h-8 w-52"
                            placeholder={c.totalPlaceholder || c.totalLabel}
                            value={state.total || ""}
                            onChange={e => setCriterion(c.key, { total: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {complete && (
            <p className="mt-2 text-xs font-medium text-green-700">Alle Teile erfüllt – Prüfung bestanden.</p>
          )}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Prüfungsdatum</Label>
          <Input type="date" className="h-9" value={examDate} onChange={e => setExamDate(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Schwimmpass-Nr. (optional)</Label>
          <Input className="h-9" value={passNo} onChange={e => setPassNo(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Gesamtergebnis</Label>
          <Select
            value={goal == null ? "unset" : goal ? "yes" : "no"}
            onValueChange={v => setGoal(v === "unset" ? null : v === "yes")}
          >
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">— Offen —</SelectItem>
              <SelectItem value="yes">Bestanden</SelectItem>
              <SelectItem value="no">Nicht bestanden</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Abzeichen (Freitext)</Label>
          <Input
            className="h-9"
            placeholder="z. B. Seepferdchen"
            value={badge}
            onChange={e => setBadge(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">Anmerkungen</Label>
        <Textarea
          rows={2}
          placeholder="z. B. Sprung noch unsicher, Baderegeln sehr gut"
          value={achievement}
          onChange={e => setAchievement(e.target.value)}
        />
      </div>

      <Button size="sm" onClick={submit} disabled={saving}>
        {saving ? "Speichert…" : "Speichern"}
      </Button>
    </div>
  );
}

export default ParticipantResultEditor;
