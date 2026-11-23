import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listTransferConsents } from "@/lib/course-transfer-consent.functions";
import { paymentState } from "@/lib/payment-status";
import { relatedProgramIds } from "@/lib/waitlist-programs";
import type { Course, Participant, ProgramRow } from "@/components/admin/kurse/shared";

export type TransferConsent = {
  participant_id: string;
  from_participant_id: string | null;
  status: string;
  confirmed_at: string | null;
  reminded_at: string | null;
};

export type WaitlistOption = {
  id: string;
  child_name: string | null;
  child_dob: string | null;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  notes: string | null;
  is_member: boolean | null;
  program_id: string | null;
  status: string;
  created_at: string;
  /** Eintrag passt zum Angebot dieses Kurses (inkl. Mischkurse) */
  fits: boolean;
};

export const paymentOf = (p: Participant, course: Course | null) =>
  paymentState({
    paid: p.paid,
    paidAt: p.paid_at,
    bookedAt: p.created_at,
    startsOn: course?.starts_on,
    paymentDueDays: course?.payment_due_days,
    method: p.payment_method,
    dueDate: p.payment_due_date,
  });

/** Abgesagte Buchungen ohne Zahlungseingang schulden nichts mehr: weder Filter noch „dringend zuerst“. */
export const isDeadBooking = (p: Participant) => p.status === "cancelled" && !p.paid;

/**
 * Teilnehmerliste eines Kurses samt Umbuchungs-Zustimmungen, Angaben aus der Anfrage und
 * passender Warteliste. `reloadCourses` aktualisiert die Kennzahlen der Kursliste.
 */
export function useParticipants(programs: ProgramRow[], reloadCourses: () => Promise<void>) {
  const listConsentsFn = useServerFn(listTransferConsents);
  const [open, setOpen] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  /** Gesundheitsangaben aus der Anmeldung je Anfrage-ID (siehe combineChildHint) */
  const [requestHealth, setRequestHealth] = useState<Record<string, string | null>>({});
  const [requestParent, setRequestParent] = useState<Record<string, string | null>>({});
  const [consents, setConsents] = useState<Record<string, TransferConsent | undefined>>({});
  // Alte Buchungen, deren Umbuchung noch auf die Zustimmung der Eltern wartet: bleiben sichtbar
  const [pendingMoveOut, setPendingMoveOut] = useState<Set<string>>(new Set());
  const [waitlist, setWaitlist] = useState<WaitlistOption[]>([]);

  async function openFor(c: Course) {
    setCourse(c);
    setOpen(true);
    const { data } = await supabase
      .from("course_participants")
      .select("*")
      .eq("course_id", c.id)
      .order("created_at", { ascending: true });
    const all = (data as Participant[]) || [];
    // Haben die Eltern einer Umbuchung zugestimmt, steht das Kind nur noch im neuen Kurs.
    // Bis zur Zustimmung bleibt die alte Buchung (Status „Abgesagt“) sichtbar.
    let consentRows: TransferConsent[] = [];
    try {
      consentRows = await listConsentsFn({ data: { participantIds: all.map((x) => x.id) } });
    } catch {
      consentRows = [];
    }
    const movedFrom = (confirmed: boolean) =>
      new Set(
        consentRows
          .filter((r) => (r.status === "confirmed") === confirmed && r.from_participant_id)
          .map((r) => r.from_participant_id as string),
      );
    const movedOut = movedFrom(true);
    setConsents(Object.fromEntries(consentRows.map((r) => [r.participant_id, r])));
    setPendingMoveOut(movedFrom(false));
    const shown = all.filter((x) => !movedOut.has(x.id));
    setParticipants(shown);
    const requestIds = shown.map((x) => x.request_id).filter(Boolean) as string[];
    let reqs: { id: string; health_info: string | null; parent_name: string | null }[] = [];
    if (requestIds.length > 0) {
      const { data: rows } = await supabase
        .from("course_requests")
        .select("id,health_info,parent_name")
        .in("id", requestIds);
      reqs = rows || [];
    }
    setRequestHealth(Object.fromEntries(reqs.map((r) => [r.id, r.health_info])));
    setRequestParent(Object.fromEntries(reqs.map((r) => [r.id, r.parent_name])));
    const { data: wl } = await supabase
      .from("waitlist_entries")
      .select(
        "id,child_name,child_dob,parent_name,parent_email,parent_phone,notes,is_member,program_id,status,created_at",
      )
      .in("status", ["waiting", "offered"])
      .order("created_at", { ascending: true });
    const rel = relatedProgramIds(c.program_id ?? null, programs);
    const list = ((wl as Omit<WaitlistOption, "fits">[]) || []).map((e) => ({
      ...e,
      fits: rel.includes(e.program_id as string),
    }));
    list.sort((a, b) => Number(b.fits) - Number(a.fits));
    setWaitlist(list);
  }

  /** Liste neu laden, standardmäßig auch die Kennzahlen der Kursliste. */
  async function refresh(withCourses = true) {
    if (course) await openFor(course);
    if (withCourses) await reloadCourses();
  }

  return {
    open,
    setOpen,
    course,
    participants,
    requestHealth,
    requestParent,
    consents,
    pendingMoveOut,
    waitlist,
    openFor,
    refresh,
  };
}

export type ParticipantList = ReturnType<typeof useParticipants>;
