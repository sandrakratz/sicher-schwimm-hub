import { notifyPaymentReceived } from "@/lib/payment-received.functions";

const DELAY_MS = 10_000;
const pending = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Schickt die Mail „Zahlung eingegangen“ erst nach ein paar Sekunden, damit ein Fehlklick noch
 * zurückgenommen werden kann (dann `cancelPaymentMail`). Der Timer überlebt Seitenwechsel in der App.
 */
export function schedulePaymentMail(participantId: string, onResult?: (sent: boolean) => void) {
  cancelPaymentMail(participantId);
  pending.set(
    participantId,
    setTimeout(() => {
      pending.delete(participantId);
      notifyPaymentReceived({ data: { participantId } })
        .then((r) => onResult?.(r.sent))
        .catch((e) => console.warn("Zahlungsbestätigung nicht gesendet", e));
    }, DELAY_MS),
  );
}

export function cancelPaymentMail(participantId: string) {
  const t = pending.get(participantId);
  if (t) clearTimeout(t);
  pending.delete(participantId);
}
