// Server-only: Aufruf der Datenbankfunktion book_course_seat (siehe Migration
// 20261002130000_book_course_seat.sql). Prüfung und Buchung laufen dort in einer Transaktion.

export type SeatResult =
  | { result: "booked"; participantId: string; documentNo: string }
  | { result: "full" }
  | { result: "duplicate" }
  | { result: "offer_not_valid" }
  | { result: "course_not_found" };

export type SeatParticipant = {
  participant_name: string;
  participant_email: string | null;
  participant_phone: string | null;
  payer_street: string | null;
  payer_zip: string | null;
  payer_city: string | null;
  date_of_birth: string | null;
  notes: string | null;
  is_member: boolean | null;
  price_amount: number | null;
  online_booking: boolean;
  payment_method: string | null;
  payment_due_date: string | null;
  push_token: string;
  document_issued_at: string;
};

export async function bookSeat(args: {
  courseId: string;
  participant: SeatParticipant;
  entryId?: string | null;
  source: "parent" | "admin";
}): Promise<SeatResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Die Funktion ist nicht in den generierten Typen enthalten.
  const { data, error } = await (supabaseAdmin as any).rpc("book_course_seat", {
    p_course_id: args.courseId,
    p_participant: args.participant,
    p_entry_id: args.entryId ?? null,
    p_source: args.source,
  });
  if (error) throw new Error(error.message);

  const r = data as { result: SeatResult["result"]; participant_id?: string; document_no?: string };
  if (r.result === "booked") {
    return {
      result: "booked",
      participantId: r.participant_id as string,
      documentNo: r.document_no as string,
    };
  }
  return { result: r.result } as SeatResult;
}
