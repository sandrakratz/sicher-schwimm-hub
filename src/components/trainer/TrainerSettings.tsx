import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { TrainerPushToggle } from "@/components/trainer/TrainerPushToggle";

const LIMITS = [2, 3, 4, 5, 6, 8, 10, 12];

/**
 * Persönliche Wünsche: höchstens so viele Einsätze im Monat (der automatische Vorschlag des Vorstands
 * hält das ein) und Erinnerungen per E-Mail.
 */
export function TrainerSettings({ me }: { me: string }) {
  const db = supabase as any;
  const [max, setMax] = useState<number | null>(null);
  const [reminders, setReminders] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await db
        .from("trainer_settings")
        .select("max_per_month,reminders")
        .eq("trainer_id", me)
        .maybeSingle();
      if (error) return; // Migration noch nicht eingespielt: Karte bleibt ausgeblendet
      setMax(data?.max_per_month ?? null);
      setReminders(data?.reminders ?? true);
      setReady(true);
    })();
  }, [me]);

  async function save(next: { max: number | null; reminders: boolean }) {
    const res = await db.from("trainer_settings").upsert({
      trainer_id: me,
      max_per_month: next.max,
      reminders: next.reminders,
    });
    if (res.error) toast.error("Konnte nicht gespeichert werden");
    else toast.success("Gespeichert");
  }

  if (!ready) return null;

  return (
    <CollapsibleCard
      className="mb-8 border-0 shadow-soft"
      storageKey="trainer-settings"
      defaultOpen={false}
      title="Meine Wünsche"
      subtitle="Mitteilungen, Erinnerungen und Einsätze pro Monat"
    >
      <div className="space-y-4">
        <TrainerPushToggle />
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="max-per-month" className="text-sm font-medium">
            Höchstens so viele Einsätze im Monat
          </label>
          <select
            id="max-per-month"
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={max ?? ""}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : null;
              setMax(v);
              void save({ max: v, reminders });
            }}
          >
            <option value="">Keine Grenze</option>
            {LIMITS.map((n) => (
              <option key={n} value={n}>
                {n} Einsätze
              </option>
            ))}
          </select>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          Ein Wunsch, keine Garantie: Der Vorstand kann im Notfall trotzdem fragen.
        </p>
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <Checkbox
            checked={reminders}
            onCheckedChange={(v) => {
              setReminders(!!v);
              void save({ max, reminders: !!v });
            }}
          />
          Erinnerungen per E-Mail (Abend vor dem Einsatz, sonntags die Wochenvorschau)
        </label>
      </div>
    </CollapsibleCard>
  );
}
