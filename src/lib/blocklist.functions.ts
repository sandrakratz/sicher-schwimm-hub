import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'

export type BlocklistEntry = {
  id: string
  child_name_norm: string | null
  child_dob: string | null
  email_norm: string | null
  reason: string | null
  source: string
  request_id: string | null
  active: boolean
  created_at: string
}

async function assertStaff(context: { supabase: any; userId: string }) {
  const { data: isStaff } = await context.supabase.rpc('is_staff', { _user_id: context.userId })
  if (!isStaff) throw new Error('Forbidden')
}

export const listBlocklist = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context as any)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data, error } = await supabaseAdmin
      .from('booking_blocklist')
      .select('id,child_name_norm,child_dob,email_norm,reason,source,request_id,active,created_at')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return { entries: (data ?? []) as BlocklistEntry[] }
  })

const addSchema = z.object({
  childName: z.string().trim().max(120).optional().or(z.literal('')),
  childDob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  email: z.string().trim().max(200).optional().or(z.literal('')),
  reason: z.string().trim().max(500).optional().or(z.literal('')),
})

export const addBlocklistEntry = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => addSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context as any)
    const email = (data.email || '').trim().toLowerCase() || null
    const child = (data.childName || '').trim().replace(/\s+/g, ' ').toLowerCase() || null
    const dob = data.childDob || null
    if (!email && !(child && dob)) {
      throw new Error('Bitte entweder eine E-Mail-Adresse oder Kindname + Geburtsdatum angeben.')
    }

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { error } = await supabaseAdmin.from('booking_blocklist').insert({
      child_name_norm: child,
      child_dob: dob,
      email_norm: email,
      reason: data.reason || 'Manuell gesperrt',
      source: 'manual',
      active: true,
      created_by: context.userId,
    })
    if (error) throw new Error(error.message)

    const { logAudit } = await import('@/lib/audit.server')
    await logAudit(context.supabase, context.userId, {
      action: 'blocklist.added',
      entity: 'booking_blocklist',
      metadata: { email, child, dob },
    })
    return { ok: true }
  })

export const setBlocklistActive = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context as any)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { error } = await supabaseAdmin
      .from('booking_blocklist')
      .update({ active: data.active })
      .eq('id', data.id)
    if (error) throw new Error(error.message)

    const { logAudit } = await import('@/lib/audit.server')
    await logAudit(context.supabase, context.userId, {
      action: data.active ? 'blocklist.activated' : 'blocklist.deactivated',
      entity: 'booking_blocklist',
      entity_id: data.id,
    })
    return { ok: true }
  })

export const deleteBlocklistEntry = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context as any)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { error } = await supabaseAdmin.from('booking_blocklist').delete().eq('id', data.id)
    if (error) throw new Error(error.message)

    const { logAudit } = await import('@/lib/audit.server')
    await logAudit(context.supabase, context.userId, {
      action: 'blocklist.deleted',
      entity: 'booking_blocklist',
      entity_id: data.id,
    })
    return { ok: true }
  })
