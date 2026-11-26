import { askConfirm } from "@/components/admin/confirm-store";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorText, formatDateBerlin } from "@/lib/format";
import {
  bookWaitlistPlaceDirect,
  deleteWaitlistEntry,
  migrateWaitingRequests,
  offerWaitlistPlace,
  recordWaitlistDecline,
  resolveBlockSuggestion,
  runWaitlistAllocation,
  updateWaitlistEntry,
} from "@/lib/waitlist.functions";

export const WAITLIST_QUERY_KEY = ["admin-waitlist"] as const;

/** Änderungen an einem Eintrag (siehe updateWaitlistEntry). */
export type EntryPatch = {
  entryId: string;
  status?: "waiting" | "removed";
  adminNotes?: string;
  appendNote?: string;
  programId?: string | null;
  childName?: string;
  childDob?: string | null;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string | null;
  isMember?: boolean | null;
  notes?: string | null;
  availableFrom?: string | null;
  blocklist?: boolean;
  blocklistReason?: string;
  dismissBlockSuggestion?: boolean;
  followUpOn?: string | null;
  declineCount?: number;
};

const toastError = (fallback: string) => (e: Error) => toast.error(errorText(e, fallback));

/** Alle Server-Aktionen der Anfrageliste; nach Erfolg wird die Liste neu geladen. */
export function useWaitlistMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: WAITLIST_QUERY_KEY });

  const migrate = useMutation({
    mutationFn: () => migrateWaitingRequests(),
    onSuccess: (res) => {
      if (res.migrated > 0) {
        toast.success(`${res.migrated} Anfrage(n) in die Warteliste übernommen.`);
        invalidate();
      }
    },
  });

  const allocate = useMutation({
    mutationFn: () => runWaitlistAllocation({ data: { courseId: null } }),
    onSuccess: (res) => {
      toast.success(
        `${res.offers} Platzangebot(e) verschickt, ${res.expired} abgelaufene Angebote geschlossen.`,
      );
      invalidate();
    },
    onError: () => toast.error("Platzvergabe fehlgeschlagen"),
  });

  const offer = useMutation({
    mutationFn: (v: { entryId: string; courseId: string }) => offerWaitlistPlace({ data: v }),
    onSuccess: () => {
      toast.success("Platzangebot verschickt");
      invalidate();
    },
    onError: toastError("Angebot fehlgeschlagen"),
  });

  const bookDirect = useMutation({
    mutationFn: (v: { entryId: string; courseId: string }) => bookWaitlistPlaceDirect({ data: v }),
    onSuccess: (res) => {
      toast.success(
        `Verbindlich gebucht: ${res.courseName}. Zahlung bis ${formatDateBerlin(res.paymentDueDate)}${
          res.immediatePayment ? " (Sofortüberweisung)" : ""
        }.`,
      );
      invalidate();
    },
    onError: toastError("Buchung fehlgeschlagen"),
  });

  const recordDecline = useMutation({
    mutationFn: (v: {
      entryId: string;
      stay: boolean;
      availableFrom: string | null;
      reason: string | null;
    }) => recordWaitlistDecline({ data: v }),
    onSuccess: (res) => {
      toast.success(
        res.deactivated
          ? "Absage erfasst – 3. Absage, Wartelistenplatz wurde deaktiviert."
          : `Absage erfasst (${res.count}. Absage). Platz ist frei${res.newOffers > 0 ? `, ${res.newOffers} neues Angebot verschickt` : ""}.`,
      );
      invalidate();
    },
    onError: toastError("Absage konnte nicht erfasst werden"),
  });

  const update = useMutation({
    mutationFn: (v: EntryPatch) => updateWaitlistEntry({ data: v }),
    onSuccess: () => invalidate(),
    onError: toastError("Aktualisierung fehlgeschlagen"),
  });

  const resolveSuggestion = useMutation({
    mutationFn: (v: {
      action: "block" | "dismiss";
      email: string | null;
      childName: string | null;
      reason?: string;
    }) => resolveBlockSuggestion({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.action === "block" ? "Auf die Sperrliste gesetzt" : "Vorschlag ignoriert");
      invalidate();
    },
    onError: toastError("Aktion fehlgeschlagen"),
  });

  const remove = useMutation({
    mutationFn: (entryId: string) => deleteWaitlistEntry({ data: { entryId } }),
    onSuccess: () => {
      toast.success("Eintrag gelöscht");
      invalidate();
    },
    onError: () => toast.error("Löschen fehlgeschlagen"),
  });

  /** Sperrvorschlag (aus „Heute“ oder den Stornierungen) übernehmen – nur nach Rückfrage. */
  const blockSuggested = async (
    s: { childName: string | null; email: string | null; total: number },
    listWord: "Anfrageliste" | "Warteliste",
  ) => {
    if (
      !(await askConfirm({
        title: "Auf die Sperrliste setzen?",
        consequence: `${s.childName} / ${s.email} wird auf die Sperrliste gesetzt. Buchung und ${listWord} sind dann gesperrt. Es geht keine Mail raus. Du kannst den Eintrag unter Sperrliste wieder löschen.`,
        confirmLabel: "Auf Sperrliste setzen",
        destructive: true,
      }))
    )
      return;
    resolveSuggestion.mutate({
      action: "block",
      email: s.email,
      childName: s.childName,
      reason: `Wiederholte Absagen/Stornierungen (${s.total})`,
    });
  };
  const dismissSuggested = (s: { childName: string | null; email: string | null }) =>
    resolveSuggestion.mutate({ action: "dismiss", email: s.email, childName: s.childName });

  return {
    invalidate,
    migrate,
    allocate,
    offer,
    bookDirect,
    recordDecline,
    update,
    remove,
    blockSuggested,
    dismissSuggested,
  };
}

export type WaitlistMutations = ReturnType<typeof useWaitlistMutations>;
