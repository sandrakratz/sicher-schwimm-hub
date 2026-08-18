type EmailLogRow = {
  id: string
  message_id: string | null
  created_at: string
  status: string
  subject: string | null
  body_html: string | null
  body_text: string | null
  error_message: string | null
}

type ReplyEntry = {
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

function mergeByMessageId(rows: EmailLogRow[]): ReplyEntry[] {
  const groups = new Map<string, EmailLogRow[]>()

  for (const row of rows) {
    const key = row.message_id || row.id
    const group = groups.get(key)
    if (group) group.push(row)
    else groups.set(key, [row])
  }

  return Array.from(groups.values())
    .map(group => {
      const ordered = [...group].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      const latest = ordered[0]
      if (!latest) return null

      const contentRow = ordered.find(row => row.body_text || row.body_html)
      const subjectRow = ordered.find(row => row.subject)

      return {
        id: latest.id,
        created_at: latest.created_at,
        status: latest.status,
        subject: latest.subject ?? subjectRow?.subject ?? null,
        body_html: latest.body_html ?? contentRow?.body_html ?? null,
        body_text: latest.body_text ?? contentRow?.body_text ?? null,
        error_message: latest.error_message,
      }
    })
    .filter((entry): entry is ReplyEntry => entry !== null)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
}

async function loadReplies(
  templateName: string,
  recipientEmail: string,
  createdAt: string,
): Promise<ReplyEntry[]> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data: rows } = await supabaseAdmin
    .from('email_send_log')
    .select('id, message_id, created_at, status, subject, body_html, body_text, error_message')
    .eq('template_name', templateName)
    .ilike('recipient_email', recipientEmail)
    .gte('created_at', createdAt)
    .order('created_at', { ascending: false })
    .limit(200)

  return mergeByMessageId((rows || []) as EmailLogRow[])
}

export async function getMessageConversationData(supabase: any, userId: string, messageId: string) {
  await assertStaff(supabase, userId)
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data: message, error } = await supabaseAdmin
    .from('messages')
    .select('id, from_email, created_at')
    .eq('id', messageId)
    .single()

  if (error || !message) return { replies: [] as ReplyEntry[] }
  return { replies: await loadReplies('message-reply', message.from_email, message.created_at) }
}

export async function getCourseRequestConversationData(supabase: any, userId: string, requestId: string) {
  await assertStaff(supabase, userId)
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data: request, error } = await supabaseAdmin
    .from('course_requests')
    .select('id, parent_email, created_at')
    .eq('id', requestId)
    .single()

  if (error || !request) return { replies: [] as ReplyEntry[] }
  return { replies: await loadReplies('course-request-reply', request.parent_email, request.created_at) }
}