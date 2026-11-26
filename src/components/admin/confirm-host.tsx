import { useEffect, useState } from "react";
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog";
import { registerConfirmHost, type AskResult, type PendingConfirm } from "./confirm-store";

/** Zeigt das Fenster „Das passiert“ für askConfirm(); einmal im Verwaltungs-Layout einbinden. */
export function ConfirmHost() {
  const [pending, set] = useState<PendingConfirm | null>(null);
  useEffect(() => {
    registerConfirmHost(set);
    return () => registerConfirmHost(null);
  }, []);
  if (!pending) return null;
  const done = (r: AskResult) => {
    pending.resolve(r);
    set(null);
  };
  return (
    <ConfirmActionDialog
      {...pending.opts}
      onConfirm={(reason, option) => done({ ok: true, reason, option })}
      onClose={() => done({ ok: false, reason: "", option: false })}
    />
  );
}
