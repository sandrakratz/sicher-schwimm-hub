import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { escapeLike } from "@/lib/like";

const tokenSchema = z.object({ token: z.string().regex(/^[a-f0-9]{48}$/) });

/** Öffentlich über geheimen Link: lädt die Vorbelegung zur Datenbestätigung. */
export const getMajorityConfirmation = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => tokenSchema.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("majority_confirmations")
      .select("id,status,first_name,last_name,date_of_birth,email,membership_id,child_index")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) return { found: false as const };
    const { data: m } = await supabaseAdmin
      .from("memberships")
      .select("membership_type,phone,address_street,address_zip,address_city,sepa_account_holder,sepa_iban")
      .eq("id", row.membership_id)
      .maybeSingle();
    const iban = (m as any)?.sepa_iban as string | null;
    return {
      found: true as const,
      done: row.status !== "open",
      first_name: row.first_name as string,
      last_name: row.last_name as string,
      date_of_birth: row.date_of_birth as string | null,
      email: (row.email as string | null) ?? "",
      is_family: (m as any)?.membership_type === "family",
      phone: row.child_index == null ? ((m as any)?.phone ?? "") : "",
      address_street: (m as any)?.address_street ?? "",
      address_zip: (m as any)?.address_zip ?? "",
      address_city: (m as any)?.address_city ?? "",
      current_account_holder: (m as any)?.sepa_account_holder ?? null,
      current_iban_hint: iban ? `…${iban.replace(/\s/g, "").slice(-4)}` : null,
    };
  });

const confirmSchema = tokenSchema.extend({
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(5).max(40),
  address_street: z.string().trim().min(3).max(200),
  address_zip: z.string().trim().regex(/^\d{5}$/),
  address_city: z.string().trim().min(2).max(100),
  payment: z.enum(["keep", "own_sepa"]),
  sepa_account_holder: z.string().trim().max(200).optional(),
  sepa_iban: z.string().trim().max(40).optional(),
  sepa_mandate: z.boolean().optional(),
  wants_termination: z.boolean(),
  termination_note: z.string().trim().max(1000).optional(),
});

export const submitMajorityConfirmation = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => {
    const d = confirmSchema.parse(i);
    if (!d.wants_termination && d.payment === "own_sepa") {
      const iban = (d.sepa_iban || "").replace(/\s/g, "").toUpperCase();
      if (!d.sepa_account_holder || !/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban) || !d.sepa_mandate) {
        throw new Error("Bitte Kontoinhaber, gültige IBAN und das SEPA-Mandat angeben.");
      }
    }
    return d;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data: row } = await sb.from("majority_confirmations").select("*").eq("token", data.token).maybeSingle();
    if (!row) throw new Error("Link ungültig.");
    if (row.status !== "open") return { ok: true, already: true, account: !!row.user_id };

    const iban = (data.sepa_iban || "").replace(/\s/g, "").toUpperCase();
    const confirmed = {
      email: data.email, phone: data.phone,
      address_street: data.address_street, address_zip: data.address_zip, address_city: data.address_city,
      payment: data.payment,
      sepa_account_holder: data.payment === "own_sepa" ? data.sepa_account_holder : null,
      sepa_iban: data.payment === "own_sepa" ? iban : null,
      sepa_mandate_at: data.payment === "own_sepa" ? new Date().toISOString() : null,
      termination_note: data.termination_note || null,
    };

    // Einzelmitglied: Stammdaten direkt aktualisieren (keine neue Mitgliedschaft).
    if (row.child_index == null) {
      const upd: Record<string, unknown> = {
        member_email: data.email, phone: data.phone,
        address_street: data.address_street, address_zip: data.address_zip, address_city: data.address_city,
      };
      if (data.payment === "own_sepa") { upd.sepa_account_holder = data.sepa_account_holder; upd.sepa_iban = iban; upd.payer_role = "member"; }
      await sb.from("memberships").update(upd).eq("id", row.membership_id);
    } else {
      const { data: m } = await sb.from("memberships").select("family_members").eq("id", row.membership_id).maybeSingle();
      const fm = m?.family_members;
      if (fm?.children?.[row.child_index]) {
        fm.children[row.child_index].email = data.email;
        await sb.from("memberships").update({ family_members: fm }).eq("id", row.membership_id);
      }
    }

    let userId: string | null = null;
    if (!data.wants_termination) {
      userId = await ensureMemberAccount(sb, data.email, row.first_name, row.last_name);
      if (userId) await sb.from("profiles").update({ phone: data.phone, address_street: data.address_street, address_zip: data.address_zip, address_city: data.address_city, date_of_birth: row.date_of_birth }).eq("id", userId);
    }

    await sb.from("majority_confirmations").update({
      status: data.wants_termination ? "termination_requested" : "confirmed",
      confirmed_data: confirmed, wants_termination: data.wants_termination,
      email: data.email, user_id: userId, confirmed_at: new Date().toISOString(),
    }).eq("id", row.id);

    try {
      const { queueTemplateEmail } = await import("@/lib/email-send.server");
      await queueTemplateEmail({
        templateName: "contact-message",
        idempotencyKey: `majority-confirmed-${row.id}`,
        templateData: {
          from_name: `${row.first_name} ${row.last_name}`,
          from_email: data.email,
          category: "Mitgliedschaft",
          subject: data.wants_termination ? "Volljährigkeit: Kündigungswunsch" : "Volljährigkeit: Daten bestätigt",
          body: data.wants_termination
            ? `${row.first_name} ${row.last_name} möchte die Mitgliedschaft nach Satzung kündigen.\n${data.termination_note || ""}`
            : `${row.first_name} ${row.last_name} hat die Daten zur Volljährigkeit bestätigt. Zahlungsart: ${data.payment === "keep" ? "wie bisher" : "neues SEPA-Mandat (eigenes Konto)"}. Ein Mitgliederzugang wurde angelegt.`,
        },
      });
    } catch (e) { console.error("[majority] notify failed", e); }

    return { ok: true, already: false, account: !!userId };
  });

async function ensureMemberAccount(sb: any, email: string, first: string, last: string): Promise<string | null> {
  const origin = "https://sicher-schwimmen.com";
  let userId: string | null = null;
  const { data: existing } = await sb.from("profiles").select("id").ilike("email", escapeLike(email)).maybeSingle();
  if (existing?.id) {
    userId = existing.id;
  } else {
    const { data: inv, error } = await sb.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/reset-password`,
      data: { first_name: first, last_name: last },
    });
    if (error) { console.error("[majority] invite failed", error); return null; }
    userId = inv?.user?.id ?? null;
  }
  if (!userId) return null;
  // Profil kann per Trigger verzögert entstehen – upsert absichern.
  await sb.from("profiles").update({ status: "active", first_name: first, last_name: last }).eq("id", userId);
  const { error: roleErr } = await sb.from("user_roles").insert({ user_id: userId, role: "member" });
  if (roleErr && !String(roleErr.message).toLowerCase().includes("duplicate")) console.error("[majority] role", roleErr);
  return userId;
}
