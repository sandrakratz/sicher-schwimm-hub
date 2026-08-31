import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

async function assertStaff(context: any) {
  const { data: isStaff } = await context.supabase.rpc('is_staff', { _user_id: context.userId })
  if (!isStaff) throw new Error('Forbidden')
}

/** Helfergruppen eines Termins inkl. Anzahl der Zusagen. */
export const listHelperGroups = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventIds: Array<string> }) =>
    z.object({ eventIds: z.array(z.string().uuid()).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.eventIds.length === 0) return { groups: [] }
    const { data: groups } = await context.supabase
      .from('event_helper_groups')
      .select('*')
      .in('event_id', data.eventIds)
      .order('sort_order', { ascending: true })
    return { groups: (groups ?? []) as Array<Record<string, unknown>> }
  })

const groupSchema = z.object({
  id: z.string().uuid().optional(),
  eventId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  neededCount: z.number().int().min(1).max(99),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
})

export const saveHelperGroup = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => groupSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const row = {
      event_id: data.eventId,
      name: data.name,
      needed_count: data.neededCount,
      starts_at: data.startsAt ?? null,
      ends_at: data.endsAt ?? null,
      note: data.note ?? null,
      sort_order: data.sortOrder ?? 0,
    }
    const { error } = data.id
      ? await supabaseAdmin.from('event_helper_groups').update(row).eq('id', data.id)
      : await supabaseAdmin.from('event_helper_groups').insert(row)
    if (error) throw new Error(error.message)
    return { ok: true as const }
  })

export const deleteHelperGroup = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    await supabaseAdmin.from('event_shift_signups').update({ group_id: null }).eq('group_id', data.id)
    const { error } = await supabaseAdmin.from('event_helper_groups').delete().eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true as const }
  })

/**
 * Automatische Besetzung: Sobald genug Zusagen für eine Helfergruppe vorliegen,
 * wird sie als besetzt markiert – fällt eine Zusage weg, wieder als offen.
 */
export const syncHelperGroupFill = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => z.object({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const [{ data: groups }, { data: signups }] = await Promise.all([
      supabaseAdmin.from('event_helper_groups').select('*').eq('event_id', data.eventId),
      supabaseAdmin
        .from('event_shift_signups')
        .select('id,group_id,trainer_id,available')
        .eq('event_id', data.eventId),
    ])
    const now = new Date().toISOString()
    let filled = 0
    for (const g of groups ?? []) {
      const helpers = new Set(
        (signups ?? []).filter((s) => s.group_id === g.id && s.available).map((s) => s.trainer_id),
      )
      const isFull = helpers.size >= g.needed_count
      if (isFull) filled++
      const target = isFull ? g.filled_at ?? now : null
      if (target !== g.filled_at) {
        await supabaseAdmin.from('event_helper_groups').update({ filled_at: target }).eq('id', g.id)
      }
    }
    return { groups: (groups ?? []).length, filled }
  })
