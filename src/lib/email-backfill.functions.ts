import * as React from 'react'
import { render } from '@react-email/components'
import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { TEMPLATES } from '@/lib/email-templates/registry'

const BATCH = 200
const WINDOW_MS = 10 * 60 * 1000 // ±10 minutes

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

async function renderTemplate(name: string, data: Record<string, any>) {
  const tpl = TEMPLATES[name]
  if (!tpl) return null
  const element = React.createElement(tpl.component, data)
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject = typeof tpl.subject === 'function' ? tpl.subject(data) : tpl.subject
  return { html, text, subject }
}

function findClosestByTime<T extends { created_at?: string | null }>(rows: T[], target: string): T | null {
  const t = new Date(target).getTime()
  let best: T | null = null
  let bestDelta = Infinity
  for (const r of rows) {
    if (!r.created_at) continue
    const d = Math.abs(new Date(r.created_at).getTime() - t)
    if (d < bestDelta && d <= WINDOW_MS) {
      best = r
      bestDelta = d
    }
  }
  return best
}

export const backfillEmailBodies = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' })
    if (!isAdmin) throw new Error('Forbidden')

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    const { data: rows, error } = await supabaseAdmin
      .from('email_send_log')
      .select('id, message_id, template_name, recipient_email, status, created_at, subject, body_html, body_text')
      .is('body_html', null)
      .is('body_text', null)
      .in('status', ['pending', 'sent', 'suppressed', 'failed', 'dlq'])
      .order('created_at', { ascending: false })
      .limit(BATCH)

    if (error) throw new Error(error.message)
    if (!rows || rows.length === 0) return { updated: 0, skipped: 0, remaining: 0 }

    let updated = 0
    let skipped = 0

    for (const row of rows) {
      const tplName = row.template_name || ''
      const recipient = (row.recipient_email || '').toLowerCase()
      const ts = row.created_at
      let data: Record<string, any> | null = null
      let rendered: { html: string; text: string; subject: string } | null = null
      let noteHtml: string | null = null
      let noteText: string | null = null

      try {
        if (tplName === 'contact-message' && recipient) {
          const { data: msgs } = await supabaseAdmin.from('messages')
            .select('from_name, from_email, category, subject, body, created_at')
            .order('created_at', { ascending: false }).limit(100)
          const match = findClosestByTime(msgs || [], ts)
          if (match) data = match
        } else if (tplName === 'course-request' && recipient) {
          const { data: reqs } = await supabaseAdmin.from('course_requests')
            .select('parent_name, parent_email, parent_phone, child_name, child_dob, swimming_level, desired_course, health_info, message, created_at')
            .order('created_at', { ascending: false }).limit(200)
          const match = findClosestByTime(reqs || [], ts)
          if (match) data = match
        } else if (tplName === 'membership-application' && recipient) {
          const { data: apps } = await supabaseAdmin.from('memberships')
            .select('first_name, last_name, email, membership_type, phone, address_city, sepa_iban, created_at')
            .order('created_at', { ascending: false }).limit(200)
          const match = findClosestByTime(apps || [], ts) as any
          if (match) data = {
            full_name: [match.first_name, match.last_name].filter(Boolean).join(' ').trim() || undefined,
            email: match.email, membership_type: match.membership_type,
            phone: match.phone, city: match.address_city, iban: match.sepa_iban, created_at: match.created_at,
          }

        } else if (tplName === 'new-registration') {
          const { data: profs } = await supabaseAdmin.from('profiles')
            .select('first_name, last_name, email, created_at')
            .order('created_at', { ascending: false }).limit(200)
          const match = findClosestByTime(profs || [], ts)
          if (match) data = match
        } else if (tplName === 'cancellation-internal' || tplName === 'cancellation-confirmation') {
          const { data: cancs } = await supabaseAdmin.from('cancellation_requests')
            .select('reference_number, parent_first_name, parent_last_name, email, phone, child_name, course_name, booking_date, notes, revocation_text, ip_address, created_at')
            .order('created_at', { ascending: false }).limit(200)
          const match = findClosestByTime(cancs || [], ts) as any
          if (match) data = { ...match }
        } else if (tplName === 'message-reply' && recipient) {
          const { data: msgs } = await supabaseAdmin.from('messages')
            .select('from_name, from_email, subject, body, created_at')
            .eq('from_email', row.recipient_email)
            .order('created_at', { ascending: false }).limit(20)
          const orig = (msgs || [])[0]
          if (orig) {
            const subject = `Re: ${orig.subject || 'Ihre Nachricht'}`
            noteHtml = `<div style="font-family:Arial,sans-serif;padding:16px;max-width:600px;">
              <div style="background:#fef3c7;border:1px solid #f59e0b;padding:10px;border-radius:6px;margin-bottom:12px;font-size:13px;">
                ⚠️ Ursprünglicher Antworttext nicht mehr verfügbar (nachträgliche Rekonstruktion). Nur die zugehörige Ausgangsnachricht ist erhalten.
              </div>
              <div style="background:#f1f5f9;padding:12px;border-radius:6px;font-size:12px;color:#475569;">
                <div><em>Ursprüngliche Nachricht von ${escapeHtml(orig.from_name || '')} &lt;${escapeHtml(orig.from_email || '')}&gt;</em></div>
                <div style="margin-top:6px;"><em>Betreff:</em> ${escapeHtml(orig.subject || '—')}</div>
                <div style="margin-top:8px;">${escapeHtml(orig.body || '').replace(/\n/g, '<br />')}</div>
              </div>
            </div>`
            noteText = `⚠️ Ursprünglicher Antworttext nicht mehr verfügbar.\n\n--- Ausgangsnachricht ---\nVon: ${orig.from_name || ''} <${orig.from_email || ''}>\nBetreff: ${orig.subject || '—'}\n\n${orig.body || ''}`
            rendered = { html: noteHtml, text: noteText, subject }
          }
        } else if (tplName === 'course-request-reply' && recipient) {
          const { data: reqs } = await supabaseAdmin.from('course_requests')
            .select('parent_name, parent_email, child_name, desired_course, swimming_level, message, created_at')
            .eq('parent_email', row.recipient_email)
            .order('created_at', { ascending: false }).limit(20)
          const orig = (reqs || [])[0]
          if (orig) {
            const subject = `Rückfrage zu Ihrer Kursanfrage${orig.child_name ? ` – ${orig.child_name}` : ''}`
            noteHtml = `<div style="font-family:Arial,sans-serif;padding:16px;max-width:600px;">
              <div style="background:#fef3c7;border:1px solid #f59e0b;padding:10px;border-radius:6px;margin-bottom:12px;font-size:13px;">
                ⚠️ Ursprünglicher Antworttext nicht mehr verfügbar (nachträgliche Rekonstruktion). Nur die ursprüngliche Kursanfrage ist erhalten.
              </div>
              <div style="background:#f1f5f9;padding:12px;border-radius:6px;font-size:12px;color:#475569;">
                <div><em>Anfrage von ${escapeHtml(orig.parent_name || '')} &lt;${escapeHtml(orig.parent_email || '')}&gt;</em></div>
                <div style="margin-top:6px;"><em>Kind:</em> ${escapeHtml(orig.child_name || '—')}</div>
                <div><em>Gewünschter Kurs:</em> ${escapeHtml(orig.desired_course || '—')}</div>
                <div><em>Level:</em> ${escapeHtml(orig.swimming_level || '—')}</div>
                <div style="margin-top:8px;"><em>Nachricht:</em><br />${escapeHtml(orig.message || '—').replace(/\n/g, '<br />')}</div>
              </div>
            </div>`
            noteText = `⚠️ Ursprünglicher Antworttext nicht mehr verfügbar.\n\n--- Kursanfrage ---\n${orig.parent_name || ''} <${orig.parent_email || ''}>\nKind: ${orig.child_name || '—'}\nGewünschter Kurs: ${orig.desired_course || '—'}\nLevel: ${orig.swimming_level || '—'}\n\n${orig.message || ''}`
            rendered = { html: noteHtml, text: noteText, subject }
          }
        } else if (['signup', 'recovery', 'magiclink', 'invite', 'email_change', 'reauthentication'].includes(tplName)) {
          rendered = {
            html: `<div style="font-family:Arial,sans-serif;padding:16px;max-width:600px;color:#475569;font-size:13px;">Auth-E-Mail (${escapeHtml(tplName)}) – Inhalt enthält Einmal-Tokens und wird aus Sicherheitsgründen nicht gespeichert oder rekonstruiert.</div>`,
            text: `Auth-E-Mail (${tplName}) – Inhalt nicht rekonstruierbar (Sicherheits-Tokens).`,
            subject: `Auth-Mail (${tplName})`,
          }
        }

        if (!rendered && data) {
          rendered = await renderTemplate(tplName, data)
        }

        if (!rendered) {
          skipped++
          continue
        }

        const { error: upErr } = await supabaseAdmin.from('email_send_log').update({
          subject: rendered.subject,
          body_html: rendered.html,
          body_text: rendered.text,
        }).eq('id', row.id)
        if (upErr) { skipped++; continue }
        updated++
      } catch {
        skipped++
      }
    }

    const { count: remainingCount } = await supabaseAdmin
      .from('email_send_log')
      .select('id', { count: 'exact', head: true })
      .is('body_html', null)
      .is('body_text', null)

    return { updated, skipped, remaining: (remainingCount ?? 0) }
  })
