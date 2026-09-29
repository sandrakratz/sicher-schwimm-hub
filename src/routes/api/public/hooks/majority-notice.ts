import { createFileRoute } from '@tanstack/react-router'
import { MEMBERSHIP_FEES } from '@/lib/billing-config'

/** Sucht Mitglieder, die in genau 42 Tagen (6 Wochen) 18 werden, und informiert Mitglied + Eltern.
 *  Beendet oder ändert keine Mitgliedschaft. */
function berlinTodayPlus(days: number) {
  const b = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }))
  b.setDate(b.getDate() + days)
  return b
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const de = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`

export const Route = createFileRoute('/api/public/hooks/majority-notice')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get('apikey') ?? ''
        const accepted = [process.env['SUPABASE_ANON_KEY'], process.env['SUPABASE_PUBLISHABLE_KEY']].filter(Boolean) as string[]
        if (!apiKey || !accepted.includes(apiKey)) return new Response('unauthorized', { status: 401 })

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { queueTemplateEmail } = await import('@/lib/email-send.server')

        const target = berlinTodayPlus(42)
        const dobTarget = iso(new Date(target.getFullYear() - 18, target.getMonth(), target.getDate()))
        const birthday = de(target)

        const { data: rows, error } = await supabaseAdmin
          .from('memberships')
          .select('id,membership_type,first_name,last_name,date_of_birth,email,member_email,guardian_email,guardian_name,family_members')
          .eq('status', 'active')
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

        type Job = { mid: string; idx: number | null; dob: string; last: string; key: string; first: string; family: string; memberEmail: string | null; parentEmail: string | null; isFamily: boolean }
        const jobs: Job[] = []
        for (const m of (rows ?? []) as any[]) {
          if (m.date_of_birth === dobTarget && m.membership_type !== 'family') {
            jobs.push({
              mid: m.id, idx: null, dob: dobTarget, last: m.last_name, key: `${m.id}-self`, first: m.first_name, family: m.last_name,
              memberEmail: m.member_email || (m.guardian_email ? m.email : null),
              parentEmail: m.guardian_email || null, isFamily: false,
            })
          }
          const kids = (m.family_members?.children ?? []) as Array<{ name: string; date_of_birth?: string; email?: string }>
          kids.forEach((k, i) => {
            if (k.date_of_birth !== dobTarget) return
            jobs.push({
              mid: m.id, idx: i, dob: dobTarget, last: (k.name || '').split(' ').slice(1).join(' ') || m.last_name, key: `${m.id}-child-${i}`, first: (k.name || '').split(' ')[0], family: m.last_name,
              memberEmail: k.email || null, parentEmail: m.email, isFamily: true,
            })
          })
        }

        let sent = 0
        for (const j of jobs) {
          const sb = supabaseAdmin as any
          let q = sb.from('majority_confirmations').select('token').eq('membership_id', j.mid)
          q = j.idx == null ? q.is('child_index', null) : q.eq('child_index', j.idx)
          let { data: conf } = await q.maybeSingle()
          if (!conf) {
            const ins = await sb.from('majority_confirmations').insert({ membership_id: j.mid, child_index: j.idx, first_name: j.first, last_name: j.last, date_of_birth: j.dob, email: j.memberEmail }).select('token').single()
            conf = ins.data
          }
          const confirm_url = conf?.token ? `https://sicher-schwimmen.com/volljaehrigkeit?token=${conf.token}` : undefined
          const base = { confirm_url, member_first_name: j.first, family_name: j.family, birthday, is_family: j.isFamily, adult_fee: MEMBERSHIP_FEES.adult }
          const targets: Array<['member' | 'parent', string | null]> = [['member', j.memberEmail], ['parent', j.parentEmail]]
          for (const [audience, to] of targets) {
            if (!to) continue
            if (audience === 'parent' && to === j.memberEmail) continue
            const idempotencyKey = `majority-${j.key}-${audience}`
            const { data: ex } = await supabaseAdmin.from('email_send_log').select('id')
              .eq('template_name', 'majority-notice').contains('metadata', { idempotency_key: idempotencyKey }).limit(1)
            if (ex && ex.length) continue
            const r = await queueTemplateEmail({
              templateName: 'majority-notice', recipientEmail: to, idempotencyKey,
              metadata: { idempotency_key: idempotencyKey, job: j.key, audience },
              templateData: { ...base, audience },
            })
            if (r.queued) sent += 1
          }
        }
        return new Response(JSON.stringify({ success: true, dobTarget, candidates: jobs.length, sent }), { headers: { 'Content-Type': 'application/json' } })
      },
    },
  },
})
