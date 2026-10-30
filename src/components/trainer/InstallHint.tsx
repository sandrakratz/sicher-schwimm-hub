import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type InstallEvent = Event & { prompt: () => Promise<void> };
const KEY = "install-hint-dismissed";

/** Hinweis „Als App auf den Startbildschirm“ – nur im Browser, nicht wenn die App schon installiert ist. */
export function InstallHint() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (standalone || localStorage.getItem(KEY)) return;
    } catch {
      /* ohne Speicher: Hinweis trotzdem zeigen */
    }
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIos(isIos);
    setHidden(false);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignorieren */
    }
    setHidden(true);
  }

  // Auf dem PC ohne Installationsmöglichkeit nichts anzeigen
  if (hidden || (!event && !ios)) return null;

  return (
    <Card className="border-0 shadow-soft bg-primary/5 md:hidden">
      <CardContent className="flex items-start gap-3 p-4">
        <Smartphone className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-semibold text-primary-deep">Als App aufs Handy</div>
          <p className="text-muted-foreground">
            {ios
              ? "Tippe unten auf „Teilen“ und dann auf „Zum Home-Bildschirm“. Dann öffnet sich der Trainerbereich wie eine App."
              : "Der Trainerbereich lässt sich wie eine App auf dem Startbildschirm installieren."}
          </p>
          {event && (
            <Button
              size="sm"
              className="mt-2 min-h-11"
              onClick={() => {
                void event.prompt();
                dismiss();
              }}
            >
              <Download className="h-4 w-4" /> Installieren
            </Button>
          )}
        </div>
        <Button size="sm" variant="ghost" aria-label="Hinweis schließen" onClick={dismiss}>
          <X className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
