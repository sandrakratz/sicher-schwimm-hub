import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { updateParticipantResult } from "@/lib/trainer-courses.functions";
import { toast } from "sonner";

export type ParticipantResult = {
  goal_reached: boolean | null;
  badge: string | null;
  achievement: string | null;
};

/** Kursergebnis vor Ort erfassen: Kursziel, Abzeichen, Anmerkung. */
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
  const [saving, setSaving] = useState(false);

  const dirty =
    goal !== value.goal_reached ||
    badge !== (value.badge || "") ||
    achievement !== (value.achievement || "");

  async function submit() {
    setSaving(true);
    try {
      const res = await save({ data: { participantId, goalReached: goal, badge, achievement } });
      onSaved?.(participantId, {
        goal_reached: res.goal_reached,
        badge: res.badge,
        achievement: res.achievement,
      });
      toast.success("Kursergebnis gespeichert");
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Kursziel erreicht?</Label>
          <Select
            value={goal == null ? "unset" : goal ? "yes" : "no"}
            onValueChange={v => setGoal(v === "unset" ? null : v === "yes")}
          >
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">— Offen —</SelectItem>
              <SelectItem value="yes">Ja, erreicht</SelectItem>
              <SelectItem value="no">Nein, nicht erreicht</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Abzeichen</Label>
          <Input
            className="h-9"
            placeholder="z.B. Seepferdchen"
            value={badge}
            onChange={e => setBadge(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Geschafft / Anmerkungen</Label>
        <Textarea
          rows={2}
          placeholder="z.B. 25m geschwommen, Sprung vom Beckenrand …"
          value={achievement}
          onChange={e => setAchievement(e.target.value)}
        />
      </div>
      <Button size="sm" onClick={submit} disabled={saving || !dirty}>
        {saving ? "Speichert…" : "Speichern"}
      </Button>
    </div>
  );
}

export default ParticipantResultEditor;
