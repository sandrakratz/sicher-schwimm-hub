import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

/** Vorlagen, die beim Testversand geprüft werden (mit Beispieldaten). */
export const TEST_TEMPLATES = [
  'signup',
  'course-booking-confirmation',
  'course-request-reply',
  'cancellation-confirmation',
  'course-request',
  'payment-check-reminder',
] as const

export type TestTemplate = (typeof TEST_TEMPLATES)[number]

export const sendTestEmails = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        recipients: z.array(z.string().email()).min(1).max(5),
        templates: z.array(z.enum(TEST_TEMPLATES)).min(1),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' })
    const { data: isBoard } = await supabase.rpc('has_role', { _user_id: userId, _role: 'board' })
    if (!isAdmin && !isBoard) throw new Error('Forbidden')

    const { runTestSend } = await import('@/lib/email-test.server')
    return runTestSend(data.recipients, [...data.templates], userId)
  })
