import { useEffect, useRef, type FocusEvent } from "react";
import { track } from "./client";

/** Macht aus Feldnamen und Kennungen einen erlaubten Code (nur a–z, 0–9, _). Nie Eingabewerte übergeben. */
export function toCode(value: string | null | undefined): string | undefined {
  const code = (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return code || undefined;
}

export type FormTracking = {
  /** Auf das <form> spreaden: erkennt Beginn und letztes Feld. */
  formProps: { onFocusCapture: (e: FocusEvent<HTMLFormElement>) => void };
  /** Eingaben unvollständig oder fehlerhaft. `fields` = Feldnamen (nicht Werte). */
  invalid: (fields?: string[], code?: string) => void;
  /** Eingaben sind in Ordnung, die Anfrage geht jetzt an den Server. */
  attempt: () => void;
  /** Server hat abgelehnt oder die Anfrage ist fehlgeschlagen. */
  failed: (code: string) => void;
  /** Erfolgreich abgesendet. */
  succeeded: () => void;
};

/**
 * Misst ein Formular: begonnen, Absendeversuche, Fehler je Feld, Erfolg, Abbruch.
 * Erfasst nur Feldnamen und Codes, nie Eingaben. Ohne Einwilligung passiert nichts.
 */
export function useFormTracking(form: string): FormTracking {
  const state = useRef({
    started: false,
    done: false,
    abandoned: false,
    lastField: undefined as string | undefined,
    path: undefined as string | undefined,
  });
  const api = useRef<FormTracking | null>(null);

  useEffect(() => {
    const abandon = () => {
      const s = state.current;
      if (!s.started || s.done || s.abandoned) return;
      s.abandoned = true;
      // Pfad vom Beginn: beim Seitenwechsel ist die Adresse schon die nächste
      track(
        "form_abandon",
        { form, ...(s.lastField ? { last_field: s.lastField } : {}) },
        undefined,
        s.path,
      );
    };
    window.addEventListener("pagehide", abandon);
    return () => {
      window.removeEventListener("pagehide", abandon);
      abandon();
    };
  }, [form]);

  if (!api.current) {
    api.current = {
      formProps: {
        onFocusCapture: (e) => {
          const s = state.current;
          const target = e.target as HTMLElement & { name?: string };
          const field = toCode(target.getAttribute?.("name") || target.id);
          if (field) s.lastField = field;
          s.abandoned = false;
          if (!s.started) {
            s.started = true;
            s.path = window.location.pathname.replace(/\/+$/, "") || "/";
            track("form_start", { form });
          }
        },
      },
      invalid: (fields = [], code = "ungueltig") => {
        track("form_submit_attempt", { form, valid: false });
        for (const f of fields.slice(0, 12)) {
          const field = toCode(f);
          if (field) track("form_field_error", { form, field, code: toCode(code) ?? "ungueltig" });
        }
      },
      attempt: () => track("form_submit_attempt", { form, valid: true }),
      failed: (code) => track("form_submit_error", { form, code: toCode(code) ?? "unbekannt" }),
      succeeded: () => {
        state.current.done = true;
        track("form_submit_success", { form });
      },
    };
  }
  return api.current;
}
