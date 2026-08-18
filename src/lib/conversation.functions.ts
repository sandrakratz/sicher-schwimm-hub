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

export const getMessageConversation = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messageId: string }) => d)
  .handler(async ({ data, context }) => {
    const { getMessageConversationData } = await import('@/lib/conversation.server')
    return getMessageConversationData(context.supabase, context.userId, data.messageId)
  })

export const getCourseRequestConversation = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { requestId: string }) => d)
  .handler(async ({ data, context }) => {
    const { getCourseRequestConversationData } = await import('@/lib/conversation.server')
    return getCourseRequestConversationData(context.supabase, context.userId, data.requestId)
  })
