import { useState } from "react";
import { toast } from "sonner";
import { Ban, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { blackoutOn, blackoutText, WEEKDAY_SHORT, type PlanBlackout } from "@/lib/dienstplan";
import { todayBerlinIso } from "@/lib/format";

/** Sperrzeiten: Urlaub oder feste Ausfälle einmal eintragen statt jeden Termin einzeln abzulehnen. */
export function Blackouts({
  me,
  blackouts,
  assignedDates,
  onChanged,
}: {
  me: string;
  blackouts: PlanBlackout[];
  /** Termine, an denen ich eingeteilt bin – für den Hinweis bei Überschneidung. */
  assignedDates: string[];
  onChanged: () => void;
}) {
  const today = todayBerlinIso();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [days, setDays] = useState<Set<number>>(new Set());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const db = supabase as any;

  async function add() {
    if (!from) return toast.error("Bitte ein Startdatum wählen.");
    const end = to || from;
    if (end < from) return toast.error("Das Ende liegt vor dem Beginn.");
    setBusy(true);
    const weekdays = days.size ? [...days].sort() : null;
    const { error } = await db.from("trainer_blackouts").insert({
      trainer_id: me,
      date_from: from,
      date_to: end,
      weekdays,
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    const candidate: PlanBlackout = { id: "", trainerId: me, from, to: end, weekdays, note: null };
    const clashes = assignedDates.filter(
      (d) => d >= today && blackoutOn([candidate], me, d),
    ).length;
    if (clashes > 0) {
      toast.warning(
        `Sperrzeit gespeichert. Achtung: Du bist in dieser Zeit noch an ${clashes} Termin(en) eingeteilt – bitte unter „Meine Einsätze“ absagen.`,
        { duration: 10000 },
      );
    } else toast.success("Sperrzeit gespeichert – du wirst dafür nicht eingeplant.");
    setFrom("");
    setTo("");
    setDays(new Set());
    setNote("");
    onChanged();
  }

  async function remove(id: string) {
    const { error } = await db.from("trainer_blackouts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChanged();
  }

  const mine = blackouts
    .filter((b) => b.trainerId === me && b.to >= today)
    .sort((a, b) => a.from.localeCompare(b.from));

  return (
    <CollapsibleCard
      className="mb-8 border-0 shadow-soft"
      storageKey="trainer-blackouts"
      title="Meine Sperrzeiten"
      subtitle={
        mine.length
          ? `${mine.length} eingetragen – dafür wirst du nicht eingeplant`
          : "Urlaub oder feste Ausfälle einmal eintragen"
      }
    >
      <div className="space-y-3">
        {mine.length > 0 && (
          <ul className="divide-y rounded-md border">
            {mine.map((b) => (
              <li key={b.id} className="flex items-center gap-2 p-2 text-sm">
                <Ban className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{blackoutText(b)}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Sperrzeit löschen"
                  onClick={() => void remove(b.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">
            Von
            <Input type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-xs text-muted-foreground">
            Bis (leer = nur dieser Tag)
            <Input
              type="date"
              min={from || today}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        <div>
          <div className="mb-1 text-xs text-muted-foreground">
            Nur bestimmte Wochentage? (keiner gewählt = jeden Tag)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_SHORT.map((d, i) => (
              <Button
                key={d}
                type="button"
                size="sm"
                variant={days.has(i + 1) ? "default" : "outline"}
                className="h-8 w-10 px-0"
                onClick={() =>
                  setDays((prev) => {
                    const n = new Set(prev);
                    if (n.has(i + 1)) n.delete(i + 1);
                    else n.add(i + 1);
                    return n;
                  })
                }
              >
                {d}
              </Button>
            ))}
          </div>
        </div>
        <Input
          placeholder="Notiz (z. B. Urlaub, Prüfungsphase)"
          value={note}
          maxLength={120}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button disabled={busy || !from} onClick={() => void add()}>
          Sperrzeit eintragen
        </Button>
      </div>
    </CollapsibleCard>
  );
}
