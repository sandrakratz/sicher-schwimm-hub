// Server-only: Aufnahmebestätigung per E-Mail, sobald der Vorstand eine Mitgliedschaft freigibt.
// Ersetzt die frühere „Konto freigeschaltet“-Mail. Je Mitgliedschaft höchstens einmal.
import { firstYearFee } from "@/lib/billing-config";
import { todayBerlinIso, fullName } from "@/lib/format";

const TYPE_LABEL: Record<string, string> = {
  children_youth: "Kinder & Jugend",
  adult: "Erwachsene",
  family: "Familie",
  supporting: "Förderung",
};

const euro = (n: number) => `${String(n).replace(".", ",")} €`;
const dayLabel = (iso: string) => iso.split("-").reverse().join(".");

async function confirmationAlreadySent(membershipId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("email_send_log")
    .select("id")
    .eq("template_name", "membership-confirmation")
    .eq("status", "sent")
    .eq("metadata->>membership_id", membershipId)
    .limit(1);
  return !!(data && data.length);
}

/**
 * Setzt bei der ersten Freigabe den Beginn (Satzung § 3: Mitgliedschaft beginnt mit Zugang der
 * Bestätigung): fehlt „Mitglied ab“ oder liegt es in der Vergangenheit, gilt heute.
 * Nach bereits versandter Bestätigung bleibt das Datum unverändert.
 */
export async function applyStartOnFirstApproval(membershipId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (await confirmationAlreadySent(membershipId)) return;
  const { data: m } = await (supabaseAdmin.from("memberships") as any)
    .select("start_date")
    .eq("id", membershipId)
    .maybeSingle();
  if (!m) return;
  const today = todayBerlinIso();
  if (!m.start_date || m.start_date < today) {
    await (supabaseAdmin.from("memberships") as any)
      .update({ start_date: today })
      .eq("id", membershipId);
  }
}

export async function sendMembershipConfirmationEmail(opts: {
  membershipId: string;
  senderUserId?: string | null;
}): Promise<{ sent: boolean; reason?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: m } = await (supabaseAdmin.from("memberships") as any)
    .select("email,first_name,last_name,membership_type,start_date,family_members")
    .eq("id", opts.membershipId)
    .maybeSingle();
  const email = String(m?.email ?? "")
    .trim()
    .toLowerCase();
  if (!m || !email) return { sent: false, reason: "no_recipient" };

  if (await confirmationAlreadySent(opts.membershipId)) {
    return { sent: false, reason: "already_sent" };
  }

  const start: string = m.start_date || todayBerlinIso();
  const type = m.membership_type as string;
  const fee = firstYearFee(type as any, start);
  const fm = m.family_members ?? {};
  const members: string[] = [
    ...(fm.partner?.name ? [fm.partner.name] : []),
    ...((fm.children ?? []) as Array<{ name?: string }>).map((c) => c.name).filter(Boolean),
  ] as string[];

  const { queueTemplateEmail } = await import("@/lib/email-send.server");
  const r = await queueTemplateEmail({
    templateName: "membership-confirmation",
    recipientEmail: email,
    templateData: {
      first_name: m.first_name ?? undefined,
      member_name: fullName(m.first_name, m.last_name) || undefined,
      membership_label: TYPE_LABEL[type] ?? type,
      start_date_label: dayLabel(start),
      members,
      fee_annual: euro(fee.annual),
      fee_first_year: euro(fee.firstYear),
      fee_half: fee.half,
      fee_is_minimum: type === "supporting",
      login_url: "https://sicher-schwimmen.com/auth",
    },
    idempotencyKey: `membership-confirmation-${opts.membershipId}`,
    metadata: { membership_id: opts.membershipId },
    senderUserId: opts.senderUserId ?? null,
  });
  return { sent: r.queued, reason: r.reason };
}
