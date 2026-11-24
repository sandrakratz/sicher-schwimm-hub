import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, FileSpreadsheet, Mail, Plus } from "lucide-react";
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

/** Knopfleiste oben rechts: Trainer-Nachweis, Rundmails (Versand), Angebotsfristen, Kursplanung, neuer Kurs. */
export function HeaderActions({
  exports: x,
  onNewProgram,
}: {
  exports: ReturnType<typeof useCourseExports>;
  onNewProgram: () => void;
}) {
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
      {/* Info-Mails an alle Familien liegen jetzt gesammelt im Versand. */}
      <Button variant="outline" asChild>
        <Link to="/admin/versand">
          <Mail className="h-4 w-4" /> Rundmails
        </Link>
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
