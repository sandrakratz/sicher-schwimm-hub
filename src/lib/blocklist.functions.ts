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
  /** Kurzinfo zur ursprünglichen Kursanfrage, falls der Eintrag daraus entstand */
  request?: {
    parent_name: string | null
    parent_email: string | null
    child_name: string | null
    desired_course: string | null
    status: string | null
    created_at: string | null
  } | null
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

    const rows = (data ?? []) as BlocklistEntry[]
    const requestIds = rows.map((r) => r.request_id).filter((v): v is string => !!v)
    const byId = new Map<string, NonNullable<BlocklistEntry['request']>>()
    if (requestIds.length) {
      const { data: reqs } = await supabaseAdmin
        .from('course_requests')
        .select('id,parent_name,parent_email,child_name,desired_course,status,created_at')
        .in('id', requestIds)
      for (const r of reqs ?? []) {
        byId.set(r.id, {
          parent_name: r.parent_name,
          parent_email: r.parent_email,
          child_name: r.child_name,
          desired_course: r.desired_course,
          status: r.status,
          created_at: r.created_at,
        })
      }
    }

    return {
      entries: rows.map((r) => ({ ...r, request: r.request_id ? byId.get(r.request_id) ?? null : null })),
    }
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
