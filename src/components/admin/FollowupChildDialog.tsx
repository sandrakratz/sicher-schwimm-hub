import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FamilyTimeline } from "@/components/admin/FamilyTimeline";
import { getFamilyOverview } from "@/lib/family.functions";
import { placeFollowupChild } from "@/lib/followup-booking.functions";
import { formatDateBerlin } from "@/lib/format";
import { beltLabel } from "@/lib/belt";
import { LEVEL_LABEL, type Candidate, type Group } from "@/lib/follow-up-candidates";

export type CourseOption = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string | null;
  schedule: string | null;
  free: number | null;
};

/** Welche Kurse zur Gruppe passen (Kursname), damit sie in der Auswahl oben stehen. */
const FITS: Record<Group, RegExp> = {
  wasserzeit: /schwimmstarter/i,
  schwimmstarter: /seepferdchen/i,
  seepferdchen: /seepferdchen/i,
  bronze: /bronze|aufbau/i,
  aufbau: /aufbau|bronze|silber|gold/i,
};

type Pending = { mode: "offer" | "book"; course: CourseOption };

/**
 * Kind aus „Folgekurse“: Verlauf der Familie einsehen und – nach dem Gespräch mit den Eltern –
 * einen Kursplatz anbieten oder direkt zubuchen.
 */
export function FollowupChildDialog({
  candidate,
  courses,
  onClose,
  onDone,
}: {
  candidate: Candidate | null;
  courses: CourseOption[];
  onClose: () => void;
  /** Nach erfolgreichem Anbieten/Buchen: Liste neu laden */
  onDone: () => void;
}) {
  const [courseId, setCourseId] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);

  const overview = useQuery({
    queryKey: ["followup-family", candidate?.email, candidate?.name],
    queryFn: () =>
      getFamilyOverview({
        data: { email: candidate!.email || null, childName: candidate!.name },
      }),
    enabled: !!candidate,
  });

  const place = useMutation({
    mutationFn: (v: Pending) =>
      placeFollowupChild({
        data: {
          mode: v.mode,
          courseId: v.course.id,
          childName: candidate!.name,
          childDob: candidate!.dob,
          parentName: candidate!.parent,
          parentEmail: candidate!.email,
          parentPhone: candidate!.phone || null,
          fromCourse: candidate!.lastCourse,
        },
      }),
    onSuccess: (res) => {
      toast.success(
        res.mode === "offer"
          ? `Platzangebot für „${res.courseName}“ verschickt`
          : `Verbindlich gebucht: ${res.courseName}. Zahlung bis ${formatDateBerlin(res.paymentDueDate)}${
              res.immediatePayment ? " (Sofortüberweisung)" : ""
            }. ${res.addressFrom ? "Rechnungsadresse aus den vorhandenen Daten übernommen." : "Achtung: keine Rechnungsadresse hinterlegt."}`,
      );
      setPending(null);
      onDone();
      onClose();
    },
    onError: (e: Error) => {
      setPending(null);
      toast.error(e.message || "Aktion fehlgeschlagen");
    },
  });

  if (!candidate) return null;
  const fits = courses.filter((c) => FITS[candidate.group].test(c.name));
  const others = courses.filter((c) => !FITS[candidate.group].test(c.name));
  const chosen = courses.find((c) => c.id === courseId) ?? null;
  const canAct = !!candidate.email && !!chosen && !place.isPending;
  const label = (c: CourseOption) =>
    `${c.name} · ab ${formatDateBerlin(c.starts_on)}${
      c.free == null ? "" : c.free > 0 ? ` · ${c.free} frei` : " · ausgebucht"
    }`;

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {candidate.name}
              {candidate.age != null && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {candidate.age} Jahre
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {candidate.parent || "Eltern unbekannt"} · {candidate.email || "keine E-Mail"}
              {candidate.phone ? ` · ${candidate.phone}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{LEVEL_LABEL[candidate.level]}</Badge>
              <Badge variant="outline">Gurt: {beltLabel(candidate.belt)}</Badge>
              {candidate.contactOk === true && <Badge>Kontakt erlaubt</Badge>}
              {candidate.contactOk === false && (
                <Badge variant="destructive">Kontakt nicht erlaubt</Badge>
              )}
              {candidate.contactOk == null && <Badge variant="outline">Kontakt unbekannt</Badge>}
              {candidate.onWaitlist && <Badge variant="outline">auf Warteliste</Badge>}
              {overview.data?.blocked && <Badge variant="destructive">Auf der Sperrliste</Badge>}
            </div>

            <section className="space-y-1">
              <h3 className="font-semibold">Kurse bei uns</h3>
              <ul className="list-disc pl-5">
                {candidate.history.map((h) => (
                  <li key={h.id}>
                    {h.course} ({formatDateBerlin(h.starts_on)} – {formatDateBerlin(h.ends_on)})
                    {h.belt != null && ` · Gurt: ${beltLabel(h.belt)}`}
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-2 rounded-lg border border-border p-3">
              <h3 className="font-semibold">Kursplatz für den Folgekurs</h3>
              <p className="text-muted-foreground">
                Erst mit den Eltern sprechen. „Platz anbieten“ schickt ihnen die übliche E-Mail mit
                Zusage-Link. „Direkt zubuchen“ bucht verbindlich und verschickt sofort die
                Buchungsbestätigung mit Zahlungsfrist. Die Rechnungsadresse wird aus der früheren
                Buchung (sonst der Mitgliedschaft) übernommen.
              </p>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                aria-label="Folgekurs wählen"
              >
                <option value="">Kurs wählen …</option>
                {fits.length > 0 && (
                  <optgroup label="Passend zum Stand des Kindes">
                    {fits.map((c) => (
                      <option key={c.id} value={c.id} disabled={c.free != null && c.free <= 0}>
                        {label(c)}
                      </option>
                    ))}
                  </optgroup>
                )}
                {others.length > 0 && (
                  <optgroup label="Weitere kommende Kurse">
                    {others.map((c) => (
                      <option key={c.id} value={c.id} disabled={c.free != null && c.free <= 0}>
                        {label(c)}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {chosen?.schedule && (
                <p className="text-xs text-muted-foreground">Termine: {chosen.schedule}</p>
              )}
              {!candidate.email && (
                <p className="text-destructive">
                  Ohne E-Mail-Adresse der Eltern ist weder Angebot noch Buchung möglich.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={!canAct}
                  onClick={() => chosen && setPending({ mode: "offer", course: chosen })}
                >
                  Platz anbieten
                </Button>
                <Button
                  disabled={!canAct}
                  onClick={() => chosen && setPending({ mode: "book", course: chosen })}
                >
                  Direkt zubuchen
                </Button>
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Verlauf der Familie</h3>
                {candidate.email && (
                  <Link
                    to="/admin/familie"
                    search={{ email: candidate.email }}
                    className="text-xs text-primary underline"
                  >
                    Familie, Verlauf (eigene Seite)
                  </Link>
                )}
              </div>
              {overview.isLoading ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Verlauf wird geladen …
                </p>
              ) : overview.error ? (
                <p className="text-destructive">Verlauf konnte nicht geladen werden.</p>
              ) : (
                <FamilyTimeline events={overview.data?.events ?? []} />
              )}
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pending}
        onOpenChange={(o) => !o && !place.isPending && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.mode === "offer" ? "Platz anbieten?" : "Verbindlich zubuchen?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending &&
                (pending.mode === "offer"
                  ? `${candidate.name} bekommt einen Platz in „${pending.course.name}“ (ab ${formatDateBerlin(pending.course.starts_on)}) angeboten. Die Eltern (${candidate.email}) erhalten eine E-Mail mit Zusage-Link.`
                  : `${candidate.name} wird sofort verbindlich in „${pending.course.name}“ (ab ${formatDateBerlin(pending.course.starts_on)}) gebucht. Die Eltern (${candidate.email}) erhalten die Buchungsbestätigung mit Zahlungsfrist.`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={place.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={place.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (pending) place.mutate(pending);
              }}
            >
              {place.isPending
                ? "Bitte warten …"
                : pending?.mode === "offer"
                  ? "Angebot senden"
                  : "Jetzt buchen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
