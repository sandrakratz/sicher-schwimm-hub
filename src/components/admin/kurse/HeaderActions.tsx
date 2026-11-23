import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, FileSpreadsheet, Mail, Plus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OfferDeadlinesDialog } from "@/components/admin/OfferDeadlinesDialog";
import type { useCourseExports } from "@/components/admin/kurse/useCourseExports";
import { useCourseMailings } from "@/components/admin/kurse/useCourseMailings";

/** Knopfleiste oben rechts: Trainer-Nachweis, Info-Mails, Angebotsfristen, Kursplanung, neuer Kurs. */
export function HeaderActions({
  exports: x,
  onNewProgram,
}: {
  exports: ReturnType<typeof useCourseExports>;
  onNewProgram: () => void;
}) {
  const { inviting, inviteAbsence, handleSendAbsenceInvites, handleSendPushInvites } =
    useCourseMailings();
  const [deadlinesOpen, setDeadlinesOpen] = useState(false);
  const thisYear = new Date().getFullYear();
  return (
    <div className="flex flex-wrap gap-2">
      <div className="flex items-center gap-1">
        <Select value={String(x.proofYear)} onValueChange={(v) => x.setProofYear(Number(v))}>
          <SelectTrigger className="h-9 w-[88px]" aria-label="Jahr für den Trainer-Nachweis">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[0, 1, 2, 3].map((i) => (
              <SelectItem key={i} value={String(thisYear - i)}>
                {thisYear - i}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" disabled={x.proofBusy} onClick={x.downloadTrainerProof}>
          <FileSpreadsheet className="h-4 w-4" />{" "}
          {x.proofBusy ? "Erstelle…" : `Trainer-Nachweis ${x.proofYear}`}
        </Button>
      </div>
      <Button
        variant="outline"
        disabled={inviting}
        onClick={handleSendPushInvites}
        title="Einmalige Info-Mail mit Link zum Aktivieren der Handy-Mitteilungen"
      >
        <Smartphone className="h-4 w-4" />{" "}
        {inviting ? "Sende…" : "Info-Mail zu Mitteilungen an alle gebuchten Familien senden"}
      </Button>
      <Button
        variant="outline"
        disabled={inviteAbsence}
        onClick={handleSendAbsenceInvites}
        title="Einmalige Info-Mail mit Abmelde-Link an Familien mit laufenden Kursen"
      >
        <Mail className="h-4 w-4" />{" "}
        {inviteAbsence ? "Sende…" : "Abmelde-Link an Familien laufender Kurse senden"}
      </Button>
      <Button variant="outline" onClick={() => setDeadlinesOpen(true)}>
        <CalendarDays className="h-4 w-4" /> Angebotsfristen
      </Button>
      <Button variant="outline" asChild>
        <Link to="/admin/kursplanung">
          <CalendarDays className="h-4 w-4" /> Kursplanung
        </Link>
      </Button>
      <Button onClick={onNewProgram}>
        <Plus className="h-4 w-4" /> Neuer Kurs
      </Button>
      <OfferDeadlinesDialog open={deadlinesOpen} onOpenChange={setDeadlinesOpen} />
    </div>
  );
}
