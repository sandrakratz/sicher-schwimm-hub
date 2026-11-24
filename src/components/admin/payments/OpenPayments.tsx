import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, Check, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { sendPaymentReminders } from "@/lib/payment-reminders.functions";
import { formatDateBerlin, formatEuro, todayBerlinIso } from "@/lib/format";
import { cancelPaymentMail, schedulePaymentMail } from "@/lib/payment-notify-client";
import { paymentState, paymentTerms } from "@/lib/payment-status";
import { AssignControl } from "@/components/admin/AssignControl";

/** Eine gebuchte, noch nicht bezahlte Kursteilnahme. */
export type PaymentRow = {
  id: string;
  participant_name: string | null;
  participant_email: string | null;
  participant_phone: string | null;
  price_amount: number | null;
  payment_note: string | null;
  payment_method: string | null;
  payment_due_date: string | null;
  assigned_to: string | null;
  created_at: string;
  courses: {
    name: string;
    starts_on: string | null;
    ends_on: string | null;
    payment_due_days: number | null;
    location: string | null;
  } | null;
};

export function dueOf(r: PaymentRow): Date {
  if (r.payment_due_date) return new Date(`${r.payment_due_date}T23:59:59`);
  return paymentTerms({
    bookedAt: r.created_at,
    startsOn: r.courses?.starts_on,
    paymentDueDays: r.courses?.payment_due_days,
  }).dueDate;
}

/** „Überfällig“ wie in der Aufgabenliste: ausdrückliche Zahlungsfrist liegt vor heute. */
export function isOverdue(r: PaymentRow): boolean {
  return !!r.payment_due_date && r.payment_due_date < todayBerlinIso();
}

/**
 * Offene Zahlungen laden und bearbeiten (bezahlt, erinnern, Frist verlängern, Notiz).
 * Wird von „Offene Zahlungen“ und vom Eingang gemeinsam genutzt.
 */
export function useOpenPayments() {
  const remindFn = useServerFn(sendPaymentReminders);
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("course_participants")
      .select(
        "id,participant_name,participant_email,participant_phone,assigned_to,price_amount,payment_note,payment_method,payment_due_date,created_at,courses!course_participants_course_id_fkey(name,starts_on,ends_on,payment_due_days,location)",
      )
      .eq("status", "confirmed")
      .eq("paid", false);
    setLoading(false);
    if (error) return void toast.error(error.message);
    setRows((data ?? []) as unknown as PaymentRow[]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const patch = (id: string, p: Partial<PaymentRow>) =>
    setRows((rs) => rs.map((x) => (x.id === id ? { ...x, ...p } : x)));

  async function undoPaid(r: PaymentRow) {
    cancelPaymentMail(r.id);
    const { error } = await supabase
      .from("course_participants")
      .update({ paid: false, paid_at: null, paid_by: null, payment_note: r.payment_note })
      .eq("id", r.id);
    if (error) return void toast.error(error.message);
    toast.info(`Zahlung von ${r.participant_name ?? "Teilnehmer"} wieder auf „offen“ gesetzt`);
    await load();
  }

  async function saveNote(r: PaymentRow, note: string) {
    const merged = r.payment_note ? `${r.payment_note}\n${note}` : note;
    setBusy(r.id);
    const { error } = await supabase
      .from("course_participants")
      .update({ payment_note: merged })
      .eq("id", r.id);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return false;
    }
    patch(r.id, { payment_note: merged });
    toast.success("Notiz gespeichert");
    return true;
  }

  async function remind(r: PaymentRow) {
    if (!r.participant_email?.trim()) return void toast.error("Keine E-Mail-Adresse hinterlegt.");
    if (!window.confirm(`Zahlungserinnerung an ${r.participant_email} senden?`)) return;
    setBusy(r.id);
    try {
      const res = await remindFn({ data: { participantId: r.id } });
      if (res?.sentCount) {
        toast.success(`Erinnerung an ${r.participant_name ?? "Teilnehmer"} versendet`);
        await load();
      } else {
        toast.info(res?.skipped?.[0]?.reason ?? "Es wurde keine Erinnerung versendet.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Versand fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  }

  async function extendDue(r: PaymentRow, newDate: string, reason: string) {
    const oldLabel = formatDateBerlin(dueOf(r));
    const newLabel = formatDateBerlin(`${newDate}T12:00:00`);
    const entry = `Zahlungsfrist verlängert: ${oldLabel} → ${newLabel}${reason ? ` (${reason})` : ""}`;
    const merged = r.payment_note ? `${r.payment_note}\n${entry}` : entry;
    setBusy(r.id);
    const { error } = await supabase
      .from("course_participants")
      .update({ payment_due_date: newDate, payment_note: merged })
      .eq("id", r.id);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return false;
    }
    patch(r.id, { payment_due_date: newDate, payment_note: merged });
    toast.success(`Frist für ${r.participant_name ?? "Teilnehmer"} bis ${newLabel} verlängert`);
    return true;
  }

  async function markPaid(r: PaymentRow, note: string) {
    setBusy(r.id);
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const { error } = await supabase
      .from("course_participants")
      .update({
        paid: true,
        paid_at: new Date().toISOString(),
        paid_by: userId,
        ...(note ? { payment_note: r.payment_note ? `${r.payment_note}\n${note}` : note } : {}),
      })
      .eq("id", r.id);
    setBusy(null);
    if (error) return void toast.error(error.message);
    setRows((rs) => rs.filter((x) => x.id !== r.id));
    schedulePaymentMail(r.id, (sent) => {
      if (sent) toast.info(`Zahlungsbestätigung an ${r.participant_name ?? "die Eltern"} gesendet`);
    });
    // Fehlklick abfangen: kurz Zeit zum Rückgängigmachen
    toast.success(`${r.participant_name ?? "Teilnehmer"} als bezahlt markiert`, {
      duration: 10000,
      action: { label: "Rückgängig", onClick: () => void undoPaid(r) },
    });
  }

  return { rows, loading, busy, load, patch, saveNote, remind, extendDue, markPaid };
}

export type OpenPayments = ReturnType<typeof useOpenPayments>;

/** Eine offene Zahlung mit allen Knöpfen. */
export function PaymentCard({ r, pay }: { r: PaymentRow; pay: OpenPayments }) {
  const [note, setNote] = useState("");
  // Neues Fristdatum (YYYY-MM-DD), solange das Verlängern-Feld offen ist
  const [extend, setExtend] = useState<string | null>(null);
  const busy = pay.busy === r.id;
  const st = paymentState({
    paid: false,
    bookedAt: r.created_at,
    startsOn: r.courses?.starts_on,
    paymentDueDays: r.courses?.payment_due_days,
    method: r.payment_method,
    dueDate: r.payment_due_date,
  });
  return (
    <Card>
      <CardContent className="py-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{r.participant_name ?? "–"}</span>
            <Badge variant="outline" className={st.className}>
              {st.label}
            </Badge>
            <span className="text-sm">fällig {formatDateBerlin(dueOf(r))}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {r.courses?.name ?? "Kurs"}
            {r.courses?.starts_on &&
              ` · ${formatDateBerlin(r.courses.starts_on)}${r.courses.ends_on ? ` – ${formatDateBerlin(r.courses.ends_on)}` : ""}`}
            {r.courses?.location && ` · ${r.courses.location}`}
          </div>
          <div className="text-sm text-muted-foreground">
            {r.participant_email}
            {r.participant_phone && ` · ${r.participant_phone}`}
          </div>
          <div className="text-xs text-muted-foreground">{st.detail}</div>
          {r.payment_note && (
            <div className="text-xs whitespace-pre-line">Notiz: {r.payment_note}</div>
          )}
        </div>
        <AssignControl
          kind="payment"
          id={r.id}
          area="payments"
          current={r.assigned_to}
          label={`Offene Zahlung – ${r.participant_name ?? "Teilnehmer"}`}
          onDone={(a) => pay.patch(r.id, { assigned_to: a })}
        />
        <div className="font-semibold whitespace-nowrap">
          {r.price_amount != null ? formatEuro(r.price_amount) : "–"}
        </div>
        <div className="flex flex-col gap-2 md:w-96">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Notiz (z. B. Überweisung, Absprache)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button onClick={() => void pay.markPaid(r, note.trim())} disabled={busy}>
              <Check className="h-4 w-4 mr-1" /> Bezahlt
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (await pay.saveNote(r, note.trim())) setNote("");
              }}
              disabled={busy || !note.trim()}
            >
              Notiz speichern
            </Button>
            <Button size="sm" variant="outline" onClick={() => void pay.remind(r)} disabled={busy}>
              <Mail className="h-4 w-4 mr-1" /> Erinnerung senden
            </Button>
            {extend === null ? (
              <Button size="sm" variant="outline" onClick={() => setExtend(todayBerlinIso())}>
                <CalendarClock className="h-4 w-4 mr-1" /> Frist verlängern
              </Button>
            ) : (
              <>
                <Input
                  type="date"
                  className="h-8 w-40"
                  aria-label="Neue Zahlungsfrist"
                  value={extend}
                  min={todayBerlinIso()}
                  onChange={(e) => setExtend(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={async () => {
                    if (await pay.extendDue(r, extend, note.trim())) {
                      setExtend(null);
                      setNote("");
                    }
                  }}
                  disabled={busy || !extend}
                >
                  Frist setzen
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setExtend(null)}>
                  Abbrechen
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
