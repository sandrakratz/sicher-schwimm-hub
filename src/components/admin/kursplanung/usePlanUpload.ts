import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extractPlanLines } from "@/lib/pool-file";
import { parsePoolSlots, type PoolSlot } from "@/lib/pool-schedule";
import type { Planning } from "./usePlanning";
import { diffPlan, fmt, ruleSlots, type Pending } from "./utils";

const db = supabase as any;

/** Neuen Badplan (Datei oder feste Regel) einlesen, mit dem gespeicherten vergleichen und übernehmen. */
export function usePlanUpload({ cfg, data }: Planning, onApplied: (conflicts: number) => void) {
  const { slots, taken, loadSlots } = data;
  const [pending, setPending] = useState<Pending | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [ruleFrom, setRuleFrom] = useState("");
  const [ruleTo, setRuleTo] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const stage = (parsed: PoolSlot[], file: string) => setPending(diffPlan(slots, parsed, file));

  async function onFile(f: File | undefined) {
    if (!f) return;
    try {
      const parsed = parsePoolSlots(await extractPlanLines(f), cfg.weekday);
      if (!parsed.length) return toast.error("In der Datei wurden keine Nutzungstermine erkannt.");
      stage(parsed, f.name);
    } catch (e: any) {
      toast.error(`Datei konnte nicht gelesen werden: ${e?.message ?? e}`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function generateRule() {
    if (!cfg.rule) return;
    if (!ruleFrom || !ruleTo || ruleTo < ruleFrom) return toast.error("Bitte Zeitraum angeben.");
    const parsed = ruleSlots(cfg, cfg.rule, ruleFrom, ruleTo);
    if (!parsed.length) return toast.error(`Im Zeitraum liegt kein ${cfg.dayName}.`);
    stage(parsed, `Regel: ${cfg.dayName} ${cfg.rule.start}–${cfg.rule.end} Uhr`);
  }

  async function applyPlan() {
    if (!pending) return;
    setBusy(true);
    const fail = (message: string) => {
      setBusy(false);
      toast.error(message);
    };
    const rows = pending.parsed.map((s) => ({
      pool: cfg.id,
      slot_date: s.date,
      start_time: s.start,
      end_time: s.end,
      closed: s.closed,
      pdf_note: s.note,
      source_file: pending.file,
      uploaded_at: new Date().toISOString(),
    }));
    // „mode“ fehlt absichtlich: eigene Festlegungen bleiben bei bestehenden Terminen erhalten.
    const up = await db.from("pool_slots").upsert(rows, { onConflict: "pool,slot_date" });
    if (up.error) return fail(up.error.message);
    if (pending.removed.length) {
      const rm = await db
        .from("pool_slots")
        .update({ closed: true, pdf_note: "nicht mehr im Plan", source_file: pending.file })
        .eq("pool", cfg.id)
        .in("slot_date", pending.removed);
      if (rm.error) return fail(rm.error.message);
    }
    const list = pending.diff.flatMap((d) =>
      (taken[d.date] ?? []).map(
        (t) => `${fmt(d.date)}: ${t.name} (${t.start} Uhr) – Bad jetzt ${d.now}`,
      ),
    );
    setConflicts(list);
    setBusy(false);
    setPending(null);
    toast.success(`Badplan übernommen (${pending.diff.length} Änderungen)`);
    await loadSlots();
    onApplied(list.length);
  }

  const reset = () => {
    setPending(null);
    setConflicts([]);
  };

  return {
    pending,
    setPending,
    conflicts,
    ruleFrom,
    setRuleFrom,
    ruleTo,
    setRuleTo,
    busy,
    fileRef,
    onFile,
    generateRule,
    applyPlan,
    reset,
  };
}

export type PlanUpload = ReturnType<typeof usePlanUpload>;
