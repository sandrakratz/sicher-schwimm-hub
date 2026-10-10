import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTimeBerlin } from "@/lib/format";
import { REQUEST_STATUS_LABEL, fmtDate, type CourseRequest } from "@/components/admin/kurse/shared";

/** Schreibgeschützte Ansicht einer Kursanfrage. */
export function RequestDialog({
  open,
  onOpenChange,
  loading,
  request,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  request: CourseRequest | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kursanfrage</DialogTitle>
        </DialogHeader>
        {loading && <div className="text-sm text-muted-foreground">Wird geladen …</div>}
        {!loading && !request && (
          <div className="text-sm text-muted-foreground">Keine Anfrage gefunden.</div>
        )}
        {request && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {REQUEST_STATUS_LABEL[request.status] || request.status}
              </Badge>
              <span className="text-muted-foreground">
                Eingegangen: {formatDateTimeBerlin(request.created_at)}
              </span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Eltern / Kontakt</div>
                <div className="font-medium">{request.parent_name}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">E-Mail</div>
                <div className="font-medium break-all">{request.parent_email}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Telefon</div>
                <div className="font-medium">{request.parent_phone || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Kontaktaufnahme erlaubt</div>
                <div className="font-medium">{request.contact_permission ? "Ja" : "Nein"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Kind</div>
                <div className="font-medium">{request.child_name || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Geburtsdatum</div>
                <div className="font-medium">
                  {request.child_dob ? fmtDate(request.child_dob) : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Gewünschter Kurs</div>
                <div className="font-medium">{request.desired_course || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Schwimmniveau</div>
                <div className="font-medium">{request.swimming_level || "—"}</div>
              </div>
            </div>
            {request.health_info && (
              <div>
                <div className="text-xs text-muted-foreground">Gesundheitshinweise</div>
                <div className="whitespace-pre-wrap">{request.health_info}</div>
              </div>
            )}
            {request.message && (
              <div>
                <div className="text-xs text-muted-foreground">Nachricht</div>
                <div className="whitespace-pre-wrap">{request.message}</div>
              </div>
            )}
            {request.admin_notes && (
              <div>
                <div className="text-xs text-muted-foreground">Interne Notizen</div>
                <div className="whitespace-pre-wrap">{request.admin_notes}</div>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
