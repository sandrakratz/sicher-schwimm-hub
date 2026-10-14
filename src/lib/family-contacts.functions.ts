import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const contact = z.object({
  email: z.string().trim().max(255).email().or(z.literal("")),
  phone: z.string().trim().max(40),
});

const inputSchema = z.object({
  membership_id: z.string().uuid(),
  partner: contact.nullable(),
  children: z.array(contact).max(10),
  /** Ältere Mitgliedschaften: Familie als einfache Liste, Zuordnung per Position. */
  list: z.array(contact).max(20).optional(),
});

/**
 * Mitglieder pflegen Telefon und E-Mail ihrer Familienmitglieder selbst.
 * Nur diese beiden Felder werden geändert (Zuordnung per Position); Namen und
 * Geburtsdaten bleiben unberührt. Schreibzugriff nur serverseitig.
 */
export const updateOwnFamilyContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => inputSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m, error } = await supabaseAdmin
      .from("memberships")
      .select("id,user_id,family_members")
      .eq("id", data.membership_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!m || m.user_id !== context.userId) throw new Response("Forbidden", { status: 403 });

    const apply = (person: any, c: { email: string; phone: string }) => ({
      ...person,
      email: c.email || null,
      phone: c.phone || null,
    });
    if (Array.isArray(m.family_members)) {
      const list = data.list ?? [];
      const nextList = (m.family_members as any[]).map((p, i) =>
        list[i] ? apply(p, list[i]) : p,
      );
      const { error: listErr } = await supabaseAdmin
        .from("memberships")
        .update({ family_members: nextList })
        .eq("id", m.id);
      if (listErr) throw new Error(listErr.message);
      return { ok: true as const };
    }
    const fm = ((m.family_members ?? {}) as Record<string, any>) || {};
    const next = {
      ...fm,
      partner: fm.partner?.name && data.partner ? apply(fm.partner, data.partner) : fm.partner,
      children: Array.isArray(fm.children)
        ? fm.children.map((child: any, i: number) =>
            data.children[i] ? apply(child, data.children[i]) : child,
          )
        : fm.children,
    };
    const { error: upErr } = await supabaseAdmin
      .from("memberships")
      .update({ family_members: next })
      .eq("id", m.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true as const };
  });
