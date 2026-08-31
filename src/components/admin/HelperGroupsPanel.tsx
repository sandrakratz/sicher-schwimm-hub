import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, Check, Plus, Trash2 } from "lucide-react";
import {
  listHelperGroups,
  saveHelperGroup,
  deleteHelperGroup,
  syncHelperGroupFill,
} from "@/lib/event-helpers.functions";
import { toBerlinInput, fromBerlinInput, type ShiftSignup } from "@/lib/event-shifts";
import type { TrainerOption } from "@/lib/trainers.functions";

export type HelperGroup = {
  id: string;
  event_id: string;
  name: string;
  needed_count: number;
  starts_at: string | null;
  ends_at: string | null;
  note: string | null;
  filled_at: string | null;
  sort_order: number;
};

/** Verwaltung der Helferstellen (Gruppen) eines Termins inkl. automatischer Besetzung. */
export function HelperGroupsPanel({
  eventId,
  signups,
  trainers,
}: {
  eventId: string;
  signups: Array<ShiftSignup & { group_id?: string | null; helper_name?: string | null }>;
  trainers: TrainerOption[];
}) {
  const [groups, setGroups] = useState<HelperGroup[]>([]);
  const [name, setName] = useState("");
  const [needed, setNeeded] = useState(1);
  const [busy, setBusy] = useState(false);

  const listFn = useServerFn(listHelperGroups);
  const saveFn = useServerFn(saveHelperGroup);
  const delFn = useServerFn(deleteHelperGroup);
  const syncFn = useServerFn(syncHelperGroupFill);

  async function load() {
    try {
      await syncFn({ data: { eventId } });
      const res = await listFn({ data: { eventIds: [eventId] } });
      setGroups((res.groups as unknown as HelperGroup[]) ?? []);
    } catch (e) {
      toast.error((e as Error).message || "Helferstellen konnten nicht geladen werden");
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [eventId, signups.length]);

  const trainerName = (id: string) => trainers.find(t => t.id === id)?.name || "Unbekannt";

  async function add() {
    if (!name.trim()) return toast.error("Bitte einen Namen für die Helferstelle angeben");
    setBusy(true);
    try {
      await saveFn({
        data: { eventId, name: name.trim(), neededCount: needed, sortOrder: groups.length },
      });
      setName("");
      setNeeded(1);
      await load();
      toast.success("Helferstelle angelegt");
    } catch (e) {
      toast.error((e as Error).message || "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function patch(g: HelperGroup, changes: Partial<HelperGroup>) {
    try {
      await saveFn({
        data: {
          id: g.id,
          eventId,
          name: changes.name ?? g.name,
          neededCount: changes.needed_count ?? g.needed_count,
          startsAt: changes.starts_at !== undefined ? changes.starts_at : g.starts_at,
          endsAt: changes.ends_at !== undefined ? changes.ends_at : g.ends_at,
          note: changes.note !== undefined ? changes.note : g.note,
          sortOrder: g.sort_order,
        },
      });
      await load();
    } catch (e) {
      toast.error((e as Error).message || "Speichern fehlgeschlagen");
    }
  }

  async function remove(g: HelperGroup) {
    if (!confirm(`Helferstelle „${g.name}“ löschen?`)) return;
    try {
      await delFn({ data: { id: g.id } });
      await load();
      toast.success("Helferstelle gelöscht");
    } catch (e) {
      toast.error((e as Error).message || "Löschen fehlgeschlagen");
    }
  }

  return (
    <div>
      <div className="mb-2 text-sm font-medium">Helferstellen</div>
      <p className="mb-2 text-xs text-muted-foreground">
        Lege fest, welche Aufgaben besetzt werden müssen (z. B. Kuchenstand, Erste Hilfe). Sobald genügend
        Zusagen vorliegen, wird die Stelle automatisch als besetzt markiert.
      </p>

      <div className="divide-y rounded-md border">
        {groups.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">Noch keine Helferstellen angelegt.</p>
        )}
        {groups.map(g => {
          const helpers = signups.filter(s => s.group_id === g.id && s.available);
          const full = helpers.length >= g.needed_count;
          return (
            <div key={g.id} className="space-y-2 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="h-8 w-48"
                  defaultValue={g.name}
                  onBlur={e => { if (e.target.value !== g.name) patch(g, { name: e.target.value }); }}
                />
                <span className="text-xs text-muted-foreground">benötigt</span>
                <Input
                  type="number"
                  min={1}
                  className="h-8 w-16"
                  defaultValue={g.needed_count}
                  onBlur={e => {
                    const v = Number(e.target.value);
                    if (v >= 1 && v !== g.needed_count) patch(g, { needed_count: v });
                  }}
                />
                <Input
                  type="datetime-local"
                  className="h-8 w-[13rem]"
                  defaultValue={toBerlinInput(g.starts_at)}
                  onBlur={e => patch(g, { starts_at: fromBerlinInput(e.target.value) })}
                />
                <span className="text-xs text-muted-foreground">bis</span>
                <Input
                  type="datetime-local"
                  className="h-8 w-[13rem]"
                  defaultValue={toBerlinInput(g.ends_at)}
                  onBlur={e => patch(g, { ends_at: fromBerlinInput(e.target.value) })}
                />
                {full ? (
                  <Badge className="gap-1 border-transparent bg-green-600 text-white">
                    <Check className="h-3 w-3" /> besetzt
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-900">
                    <AlertTriangle className="h-3 w-3" /> {helpers.length}/{g.needed_count}
                  </Badge>
                )}
                <Button variant="ghost" size="sm" onClick={() => remove(g)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                {helpers.length > 0
                  ? `Zusagen: ${helpers.map(h => h.helper_name || trainerName(h.trainer_id)).join(", ")}`
                  : "Noch keine Zusagen für diese Stelle."}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input
          className="h-8 w-48"
          placeholder="Neue Helferstelle"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <Input
          type="number"
          min={1}
          className="h-8 w-16"
          value={needed}
          onChange={e => setNeeded(Math.max(1, Number(e.target.value) || 1))}
        />
        <Button size="sm" variant="outline" disabled={busy} onClick={add}>
          <Plus className="h-4 w-4" /> Hinzufügen
        </Button>
      </div>
    </div>
  );
}
