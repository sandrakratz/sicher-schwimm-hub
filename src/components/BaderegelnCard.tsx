import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Maximize2 } from "lucide-react";
import poster from "@/assets/baderegeln-seepferdchen.png.asset.json";

const ALT =
  "Poster „Baderegeln für dein Seepferdchen“ von Sicher Schwimmen e.V. mit 10 Baderegeln für Kinder und der Rettungskette";

export function BaderegelnCard({ variant = "full" }: { variant?: "full" | "compact" }) {
  const [open, setOpen] = useState(false);

  const preview = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="group relative block w-full overflow-hidden rounded-xl border bg-muted/30"
      aria-label="Baderegeln-Poster in großer Ansicht öffnen"
    >
      <img
        src={poster.url}
        alt={ALT}
        loading="lazy"
        className="w-full h-auto transition-transform duration-300 group-hover:scale-[1.02]"
      />
      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold text-primary-deep shadow-soft">
        <Maximize2 className="h-3.5 w-3.5" /> Großansicht
      </span>
    </button>
  );

  const download = (
    <Button asChild variant="accent" className={variant === "full" ? "" : "w-full"}>
      <a href={poster.url} download="Baderegeln-Sicher-Schwimmen.png">
        <Download className="h-4 w-4" /> Poster herunterladen
      </a>
    </Button>
  );

  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Baderegeln für dein Seepferdchen</DialogTitle>
        </DialogHeader>
        <img src={poster.url} alt={ALT} className="w-full h-auto rounded-lg" />
        <div className="flex justify-end">
          <Button asChild variant="accent">
            <a href={poster.url} download="Baderegeln-Sicher-Schwimmen.png">
              <Download className="h-4 w-4" /> Poster herunterladen
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (variant === "compact") {
    return (
      <div className="space-y-3 text-sm">
        <h2 className="font-display text-lg font-bold text-primary-deep">Baderegeln zum Mitnehmen</h2>
        <p className="text-muted-foreground">
          Unsere 10 Baderegeln plus Rettungskette – kindgerecht erklärt für alle, die auf dem Weg zum Seepferdchen sind.
        </p>
        {preview}
        {download}
        <p className="text-[11px] text-muted-foreground">
          Quellen: DLRG e.V. – Baderegeln · Deutscher Schwimm-Verband e.V. – Seepferdchen &amp; Sicherheit im Wasser
        </p>
        {dialog}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center">
        <div>
          <h2 className="font-display text-2xl font-bold text-primary-deep mb-2">
            Baderegeln für dein Seepferdchen
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Zehn einfache Baderegeln und die Rettungskette – kindgerecht illustriert. Schauen Sie das Poster gemeinsam
            mit Ihrem Kind an oder laden Sie es herunter und hängen Sie es zu Hause auf.
          </p>
          {download}
          <p className="text-[11px] text-muted-foreground mt-3">
            Quellen: DLRG e.V. – Baderegeln · Deutscher Schwimm-Verband e.V. – Seepferdchen &amp; Sicherheit im Wasser
          </p>
        </div>
        {preview}
      </div>
      {dialog}
    </div>
  );
}
