import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { withdrawFromSessions } from "@/lib/dienstplan.functions";
import { indexPlan, sessionLabel, type PlanData } from "@/lib/dienstplan";
import { todayBerlinIso } from "@/lib/format";

/** Telefonische Absage erfassen: Person wählen, Termine abhaken, Grund – Lücken entstehen automatisch. */
export function WithdrawalDialog({
  open,
  data,
  onClose,
  onDone,
}: {
  open: boolean;
  data: PlanData;
  onClose: () => void;
  /** Wird mit der ersten entstandenen Lücke aufgerufen, damit gleich Ersatz gesucht werden kann. */
  onDone: (firstGapSessionId: string | null) => void;
}) {
  const withdraw = useServerFn(withdrawFromSessions);
  const [trainerId, setTrainerId] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const ix = useMemo(() => indexPlan(data), [data]);
  const today = todayBerlinIso();
  const mine = useMemo(
    () =>
      (ix.sessionsByTrainer.get(trainerId) ?? [])
        .filter((s) => s.date >= today && !s.fixedIds.includes(trainerId))
        .sort((a, b) => (a.date + (a.start ?? "")).localeCompare(b.date + (b.start ?? ""))),
    [ix, trainerId, today],
  );
  // Nur Personen, die überhaupt künftige Einsätze haben, stehen oben
  const withShifts = new Set(
    data.trainers
      .filter((t) =>
        (ix.sessionsByTrainer.get(t.id) ?? []).some(
          (s) => s.date >= today && !s.fixedIds.includes(t.id),
        ),
      )
      .map((t) => t.id),
  );

  function reset() {
    setTrainerId("");
    setPicked(new Set());
    setReason("");
  }

  async function submit() {
    if (!trainerId || picked.size === 0 || reason.trim().length < 2) return;
    setBusy(true);
    try {
      const res = await withdraw({
        data: { trainerId, sessionIds: [...picked], reason: reason.trim() },
      });
      toast.success(
        res.gaps.length
          ? `Absage eingetragen – ${res.gaps.length} Termin(e) jetzt nicht voll besetzt`
          : "Absage eingetragen – alle Termine bleiben besetzt",
      );
      reset();
      onDone(res.gaps[0]?.sessionId ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Absage konnte nicht eingetragen werden");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Absage erfassen</DialogTitle>
          <DialogDescription>
            Wenn jemand telefonisch absagt: Person wählen, betroffene Termine abhaken, Grund
            eintragen. Die Person wird aus diesen Terminen ausgeteilt, die Lücken erscheinen sofort
            in der Liste.
          </DialogDescription>
        </DialogHeader>

        <Select
          value={trainerId}
          onValueChange={(v) => {
            setTrainerId(v);
            const list = (ix.sessionsByTrainer.get(v) ?? []).filter(
              (s) => s.date >= today && !s.fixedIds.includes(v),
            );
            setPicked(new Set(list.map((s) => s.id)));
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Wer sagt ab?" />
          </SelectTrigger>
          <SelectContent>
            {data.trainers
              .slice()
              .sort(
                (a, b) =>
                  Number(withShifts.has(b.id)) - Number(withShifts.has(a.id)) ||
                  a.name.localeCompare(b.name, "de"),
              )
              .map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                  {withShifts.has(t.id) ? "" : " (keine kommenden Einsätze)"}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        {trainerId && (
          <div className="space-y-2">
            {mine.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine kommenden Einsätze.</p>
            ) : (
              <>
                <div className="flex items-center gap-2 text-xs">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2"
                    onClick={() => setPicked(new Set(mine.map((s) => s.id)))}
                  >
                    Alle
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2"
                    onClick={() => setPicked(new Set())}
                  >
                    Keine
                  </Button>
                  <span className="text-muted-foreground">
                    {picked.size} von {mine.length} Terminen gewählt
                  </span>
                </div>
                <div className="max-h-64 divide-y overflow-y-auto rounded-md border">
                  {mine.map((s) => (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center gap-2 p-2 text-sm"
                    >
                      <Checkbox
                        checked={picked.has(s.id)}
                        onCheckedChange={(v) =>
                          setPicked((prev) => {
                            const n = new Set(prev);
                            if (v) n.add(s.id);
                            else n.delete(s.id);
                            return n;
                          })
                        }
                      />
                      {sessionLabel(s)}
                    </label>
                  ))}
                </div>
              </>
            )}
            <Input
              placeholder="Grund (z. B. krank, privat verhindert)"
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
            />
            <Button
              disabled={busy || picked.size === 0 || reason.trim().length < 2}
              onClick={() => void submit()}
            >
              Absage eintragen ({picked.size})
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
