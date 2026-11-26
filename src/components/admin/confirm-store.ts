import type { ReactNode } from "react";

export type AskOptions = {
  title: string;
  /** Was nach dem Klick passiert (ganze Sätze, inkl. Mail ja/nein und Weg zurück). */
  consequence: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  reason?: { label: string; placeholder?: string; required?: boolean };
  option?: { label: string };
};

export type AskResult = { ok: boolean; reason: string; option: boolean };

export type PendingConfirm = { opts: AskOptions; resolve: (r: AskResult) => void };

let show: ((p: PendingConfirm | null) => void) | null = null;

/** Vom <ConfirmHost /> im Verwaltungs-Layout aufgerufen. */
export function registerConfirmHost(fn: ((p: PendingConfirm | null) => void) | null) {
  show = fn;
}

/**
 * Fenster „Das passiert“ als Ersatz für confirm(), mit Grund-Feld und Ankreuzfeld möglich.
 * Der Host (<ConfirmHost />) hängt im Verwaltungs-Layout.
 */
export function askConfirmDetailed(opts: AskOptions): Promise<AskResult> {
  return new Promise((resolve) => {
    if (!show) {
      resolve({ ok: false, reason: "", option: false });
      return;
    }
    show({ opts, resolve });
  });
}

/** `if (!(await askConfirm({...}))) return;` */
export async function askConfirm(opts: AskOptions): Promise<boolean> {
  return (await askConfirmDetailed(opts)).ok;
}
