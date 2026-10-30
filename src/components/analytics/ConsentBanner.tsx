import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  browserSignalsOptOut,
  getConsent,
  setConsent,
  subscribeConsent,
} from "@/lib/analytics/consent";

export const OPEN_CONSENT_EVENT = "ss:open-consent";

/** Öffnet die Einstellungen erneut, z. B. aus dem Footer oder der Datenschutzerklärung. */
export function openConsentSettings() {
  window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
}

/**
 * Einwilligungsbanner für die Nutzungsmessung.
 * „Alle akzeptieren“ und „Nur notwendige“ sind gleich gestaltet und gleich groß.
 */
export function ConsentBanner() {
  const [ready, setReady] = useState(false);
  const [decided, setDecided] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [open, setOpen] = useState(false);
  const signalOptOut = ready ? browserSignalsOptOut() : false;

  useEffect(() => {
    const sync = () => {
      const state = getConsent();
      setDecided(state !== null);
      setAnalytics(state?.analytics === true);
    };
    sync();
    setReady(true);
    const unsubscribe = subscribeConsent(sync);
    const reopen = () => {
      setOpen(true);
      setShowSettings(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => {
      unsubscribe();
      window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
    };
  }, []);

  if (!ready || (decided && !open)) return null;

  const decide = (value: boolean) => {
    setConsent(value);
    setOpen(false);
    setShowSettings(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background shadow-lg"
    >
      <div className="container mx-auto px-4 py-4 max-w-3xl space-y-3">
        <h2 id="consent-title" className="font-display text-lg font-bold text-primary-deep">
          Hilf uns, die Webseite zu verbessern
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Mit deiner Erlaubnis messen wir anonym, welche Seiten genutzt werden, wie lange und wo
          Formulare scheitern, und testen verschiedene Varianten unserer Seite. Dafür speichern wir
          eine zufällige Kennung in deinem Browser. Es werden keine Eingaben aus Formularen und
          keine IP-Adressen gespeichert, und nichts geht an Werbe- oder Drittanbieter. Du kannst
          deine Entscheidung jederzeit im Footer ändern. Mehr in der{" "}
          <Link to="/datenschutz" hash="messung" className="underline">
            Datenschutzerklärung
          </Link>
          .
        </p>

        {showSettings && (
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label className="text-sm font-semibold">Notwendig</Label>
                <p className="text-xs text-muted-foreground">
                  Anmeldung und Oberflächeneinstellungen. Immer aktiv.
                </p>
              </div>
              <Switch checked disabled aria-label="Notwendig, immer aktiv" />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="consent-analytics" className="text-sm font-semibold">
                  Nutzungsmessung und Tests
                </Label>
                <p className="text-xs text-muted-foreground">
                  Zufällige Kennung, Seitenaufrufe, Verweildauer, Formular-Fehler, A/B-Tests.
                </p>
                {signalOptOut && (
                  <p className="text-xs text-destructive mt-1">
                    Dein Browser sendet „Do Not Track“ oder „Global Privacy Control“. Wir messen
                    deshalb nicht, auch wenn du hier zustimmst.
                  </p>
                )}
              </div>
              <Switch
                id="consent-analytics"
                checked={analytics}
                onCheckedChange={setAnalytics}
                disabled={signalOptOut}
              />
            </div>
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => decide(analytics && !signalOptOut)}
            >
              Auswahl speichern
            </Button>
          </div>
        )}

        {!showSettings && (
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" size="lg" className="sm:flex-1" onClick={() => decide(false)}>
              Nur notwendige
            </Button>
            <Button variant="outline" size="lg" className="sm:flex-1" onClick={() => decide(true)}>
              Alle akzeptieren
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setShowSettings(true)}>
              Einstellungen
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
