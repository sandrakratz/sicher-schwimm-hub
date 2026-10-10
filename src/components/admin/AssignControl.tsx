import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { assignItem, getAssignmentContext, type AssignmentArea } from "@/lib/assignments.functions";

/** Vorstand/Verwaltung, angemeldete Person und Standard-Zuständigkeiten (gemeinsam zwischengespeichert). */
export function useAssignmentContext() {
  return useQuery({
    queryKey: ["assignment-context"],
    queryFn: () => getAssignmentContext(),
    staleTime: 5 * 60 * 1000,
  });
}

/** Wer ist zuständig? Ausdrückliche Zuweisung vor Standard-Zuständigkeit des Bereichs. */
export function effectiveAssignee(
  current: string | null | undefined,
  area: AssignmentArea,
  rules: Partial<Record<AssignmentArea, string>> | undefined,
): string {
  return (current || rules?.[area] || "").trim();
}

/**
 * Kleiner Knopf „Zuständig: …“ mit Dialog zum Zuweisen oder Weitergeben (mit Notiz an die neue
 * zuständige Person). Zeigt ohne ausdrückliche Zuweisung die Standard-Zuständigkeit des Bereichs.
 */
export function AssignControl({
  kind,
  id,
  area,
  current,
  label,
  onDone,
}: {
  kind: "waitlist" | "message" | "payment";
  id: string;
  area: AssignmentArea;
  current: string | null | undefined;
  /** Kurzbezeichnung des Vorgangs für den Dialogtitel */
  label: string;
  onDone: (assignee: string | null) => void;
}) {
  const ctx = useAssignmentContext();
  const [open, setOpen] = useState(false);
  const [person, setPerson] = useState("");
  const [note, setNote] = useState("");
  const rule = ctx.data?.rules?.[area] ?? null;
  const shown = current || rule || null;

  const save = useMutation({
    mutationFn: () => assignItem({ data: { kind, id, assignee: person || null, note } }),
    onSuccess: (res) => {
      toast.success(
        res.assignee
          ? `Zugewiesen an ${res.assignee}${res.notified ? " – E-Mail wurde verschickt" : ""}`
          : "Zuweisung aufgehoben",
      );
      setOpen(false);
      setNote("");
      onDone(res.assignee);
    },
    onError: (e: Error) => toast.error(e.message || "Zuweisen fehlgeschlagen"),
  });

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 gap-1 px-2 text-xs"
        title={
          current
            ? `Zuständig: ${current} – klicken zum Weitergeben`
            : rule
              ? `Standard-Zuständigkeit: ${rule} – klicken zum Zuweisen`
              : "Einem Vorstandsmitglied zuweisen"
        }
        onClick={() => {
          setPerson(current ?? "");
          setNote("");
          setOpen(true);
        }}
      >
        <UserRound className="h-3 w-3" />
        {shown ? `${shown}${current ? "" : " (Regel)"}` : "Zuweisen"}
      </Button>

      <Dialog open={open} onOpenChange={(v) => !save.isPending && setOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{current ? "Weitergeben" : "Zuweisen"}</DialogTitle>
            <DialogDescription>{label}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <label className="block">
              <span className="text-xs text-muted-foreground">Zuständig</span>
              <select
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={person}
                onChange={(e) => setPerson(e.target.value)}
              >
                <option value="">
                  {current ? "Niemand (Zuweisung aufheben)" : "– bitte wählen –"}
                </option>
                {(ctx.data?.staff ?? []).map((n) => (
                  <option key={n} value={n}>
                    {n}
                    {n === ctx.data?.me ? " (ich)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">
                Notiz an die neue zuständige Person (optional)
              </span>
              <Textarea
                className="mt-1"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="z. B. Familie hat nicht geantwortet, bitte telefonisch klären."
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Die neue zuständige Person erhält eine E-Mail mit Link und Notiz. Notiz und Zuweisung
              stehen am Vorgang und im Audit-Log.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={save.isPending}>
              Abbrechen
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || (!person && !current) || person === (current ?? "")}
            >
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {person ? (current ? "Weitergeben" : "Zuweisen") : "Zuweisung aufheben"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
