import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Heart, ThumbsUp, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { supabase } from "@/integrations/supabase/client";

type Program = { id: string; name: string; target_group: string | null; age_range: string | null };
type Pref = "gern" | "geht" | "nein";

const OPTIONS: { value: Pref; label: string; icon: typeof Heart }[] = [
  { value: "gern", label: "Gern", icon: Heart },
  { value: "geht", label: "Geht auch", icon: ThumbsUp },
  { value: "nein", label: "Nicht", icon: Ban },
];

/**
 * Grundsätzliche Bereitschaft je Kursart statt jeden Termin einzeln zu beantworten.
 * „Nicht“: wird für diese Kursart nie vorgeschlagen. „Gern“: wird bevorzugt. Ohne Angabe: „Geht auch“.
 */
export function ProgramPreferences({ me }: { me: string }) {
  const db = supabase as any;
  const [programs, setPrograms] = useState<Program[]>([]);
  const [prefs, setPrefs] = useState<Record<string, Pref>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const [p, a] = await Promise.all([
        db
          .from("course_programs")
          .select("id,name,target_group,age_range")
          .order("sort_order")
          .order("name"),
        db.from("trainer_program_preferences").select("program_id,preference").eq("trainer_id", me),
      ]);
      // Migration noch nicht eingespielt: Karte bleibt ausgeblendet
      if (p.error || a.error) return;
      setPrograms(p.data ?? []);
      const map: Record<string, Pref> = {};
      for (const r of a.data ?? []) map[r.program_id] = r.preference as Pref;
      setPrefs(map);
      setReady(true);
    })();
  }, [me]);

  async function choose(programId: string, value: Pref) {
    const before = prefs[programId] ?? "geht";
    if (before === value) return;
    setBusy(programId);
    setPrefs((prev) => ({ ...prev, [programId]: value }));
    const res =
      value === "geht"
        ? await db
            .from("trainer_program_preferences")
            .delete()
            .eq("trainer_id", me)
            .eq("program_id", programId)
        : await db.from("trainer_program_preferences").upsert({
            trainer_id: me,
            program_id: programId,
            preference: value,
          });
    setBusy(null);
    if (res.error) {
      setPrefs((prev) => ({ ...prev, [programId]: before }));
      toast.error("Konnte nicht gespeichert werden");
    }
  }

  if (!ready || programs.length === 0) return null;

  const excluded = programs.filter((p) => prefs[p.id] === "nein").length;

  return (
    <CollapsibleCard
      className="mb-8 border-0 shadow-soft"
      storageKey="trainer-program-prefs"
      title="Meine Kursarten"
      subtitle="Einmal angeben, was du grundsätzlich gern oder nicht betreust"
      meta={
        excluded > 0 ? (
          <span className="text-xs text-muted-foreground">{excluded} ausgeschlossen</span>
        ) : undefined
      }
    >
      <div className="divide-y rounded-md border">
        {programs.map((p) => {
          const current = prefs[p.id] ?? "geht";
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{p.name}</div>
                {(p.target_group || p.age_range) && (
                  <div className="text-xs text-muted-foreground">
                    {[p.target_group, p.age_range].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              <div
                role="group"
                aria-label={`Bereitschaft für ${p.name}`}
                className="inline-flex rounded-md border p-0.5"
              >
                {OPTIONS.map((o) => (
                  <Button
                    key={o.value}
                    size="sm"
                    type="button"
                    disabled={busy === p.id}
                    aria-pressed={current === o.value}
                    variant={
                      current === o.value
                        ? o.value === "nein"
                          ? "destructive"
                          : "default"
                        : "ghost"
                    }
                    className="min-h-9"
                    onClick={() => void choose(p.id, o.value)}
                  >
                    <o.icon className="h-4 w-4" /> {o.label}
                  </Button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Der Vorstand schlägt dich für „Nicht“ nie vor. Bereits eingeteilte Termine bleiben bestehen
        – diese bitte unter „Meine Einsätze“ absagen.
      </p>
    </CollapsibleCard>
  );
}
