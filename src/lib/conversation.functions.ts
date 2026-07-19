import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

export type ReplyEntry = {
  id: string
  created_at: string
  status: string
  subject: string | null
  body_html: string | null
  body_text: string | null
  error_message: string | null
}

async function assertStaff(supabase: any, userId: string) {
  const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' })
  const { data: isBoard } = await supabase.rpc('has_role', { _user_id: userId, _role: 'board' })
  if (!isAdmin && !isBoard) throw new Error('Forbidden')
}

// Dedupe email_send_log rows by message_id, keeping latest status per email
function dedupeByMessageId(rows: any[]): ReplyEntry[] {
  const map = new Map<string, any>()
  for (const r of rows) {
    const key = r.message_id || r.id
    const existing = map.get(key)
    if (!existing || new Date(r.created_at).getTime() > new Date(existing.created_at).getTime()) {
      map.set(key, r)
    }
  }
  return Array.from(map.values())
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(r => ({
      id: r.id,
      created_at: r.created_at,
      status: r.status,
      subject: r.subject,
      body_html: r.body_html,
      body_text: r.body_text,
      error_message: r.error_message,
    }))
}

export const getMessageConversation = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messageId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    const { data: msg, error } = await supabaseAdmin
      .from('messages')
      .select('id, from_email, created_at')
      .eq('id', data.messageId)
      .single()
    if (error || !msg) return { replies: [] as ReplyEntry[] }

    const { data: rows } = await supabaseAdmin
      .from('email_send_log')
      .select('id, message_id, created_at, status, subject, body_html, body_text, error_message')
      .eq('template_name', 'message-reply')
      .ilike('recipient_email', msg.from_email)
      .gte('created_at', msg.created_at)
      .order('created_at', { ascending: false })
      .limit(200)

    return { replies: dedupeByMessageId(rows || []) }
  })

export const getCourseRequestConversation = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { requestId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    const { data: req, error } = await supabaseAdmin
      .from('course_requests')
      .select('id, parent_email, created_at')
      .eq('id', data.requestId)
      .single()
    if (error || !req) return { replies: [] as ReplyEntry[] }

    const { data: rows } = await supabaseAdmin
      .from('email_send_log')
      .select('id, message_id, created_at, status, subject, body_html, body_text, error_message')
      .eq('template_name', 'course-request-reply')
      .ilike('recipient_email', req.parent_email)
      .gte('created_at', req.created_at)
      .order('created_at', { ascending: false })
      .limit(200)

    return { replies: dedupeByMessageId(rows || []) }
  })
