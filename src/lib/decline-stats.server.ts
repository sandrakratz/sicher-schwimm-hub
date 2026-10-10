// Server-only: Absagen und Stornierungen je Familie zusammenzählen (Grundlage für den Sperrvorschlag).
// Gezählt werden
//  - Absagen auf der Anfrageliste (waitlist_entries.decline_count) und
//  - Stornierungen gebuchter Plätze durch die Familie (Umbuchung / „zurück auf die Warteliste“),
//    erkennbar an status = cancelled UND transferred_at gesetzt. Absagen des Vereins (Kurs entfällt)
//    und Verwaltungs-Verschiebungen setzen transferred_at nicht und zählen deshalb nicht.
// Zählweise je Eltern-E-Mail ODER Kind (Name); der höhere Wert gilt.

export const BLOCK_SUGGESTION_THRESHOLD = 3;

export type CancellationRow = {
  id: string;
  course_id: string;
  participant_name: string | null;
  participant_email: string | null;
  transfer_reason: string | null;
  transferred_at: string | null;
  transferred_to_course_id: string | null;
  block_review_dismissed_at: string | null;
};

type EntryLike = {
  parent_email: string | null;
  child_name: string | null;
  decline_count?: number | null;
  block_review_dismissed_at?: string | null;
};

type BlockLike = {
  email_norm: string | null;
  child_name_norm: string | null;
  child_dob: string | null;
};

const norm = (v: string | null | undefined) => (v ?? "").trim().replace(/\s+/g, " ").toLowerCase();

export async function loadCancellations(): Promise<CancellationRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const out: CancellationRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("course_participants")
      .select(
        "id,course_id,participant_name,participant_email,transfer_reason,transferred_at,transferred_to_course_id,block_review_dismissed_at",
      )
      .eq("status", "cancelled")
      .not("transferred_at", "is", null)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(`Stornierungen konnten nicht geladen werden: ${error.message}`);
    out.push(...((data ?? []) as CancellationRow[]));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

export function buildDeclineStats(
  entries: EntryLike[],
  cancellations: CancellationRow[],
  blocks: BlockLike[],
) {
  const byEmail = new Map<string, number>();
  const byChild = new Map<string, number>();
  const dismissedEmail = new Set<string>();
  const dismissedChild = new Set<string>();
  const add = (email: string, child: string, n: number, dismissed: boolean) => {
    if (email) byEmail.set(email, (byEmail.get(email) ?? 0) + n);
    if (child) byChild.set(child, (byChild.get(child) ?? 0) + n);
    if (dismissed) {
      if (email) dismissedEmail.add(email);
      if (child) dismissedChild.add(child);
    }
  };
  for (const e of entries)
    add(
      norm(e.parent_email),
      norm(e.child_name),
      Number(e.decline_count ?? 0),
      !!e.block_review_dismissed_at,
    );
  for (const c of cancellations)
    add(
      norm(c.participant_email),
      norm(c.participant_name),
      1,
      !!c.block_review_dismissed_at,
    );

  return (email: string | null, childName: string | null, childDob: string | null = null) => {
    const em = norm(email);
    const ch = norm(childName);
    const total = Math.max(em ? (byEmail.get(em) ?? 0) : 0, ch ? (byChild.get(ch) ?? 0) : 0);
    const blocked = blocks.some(
      (b) =>
        (b.email_norm && b.email_norm === em) ||
        (b.child_name_norm &&
          b.child_name_norm === ch &&
          (!b.child_dob || !childDob || b.child_dob === childDob)),
    );
    const dismissed = (!!em && dismissedEmail.has(em)) || (!!ch && dismissedChild.has(ch));
    return {
      total,
      blocked,
      dismissed,
      suggest: total >= BLOCK_SUGGESTION_THRESHOLD && !blocked && !dismissed,
    };
  };
}
