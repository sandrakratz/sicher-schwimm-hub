import { createFileRoute } from '@tanstack/react-router'

/**
 * Höchstzahl Mails pro Aufruf. Cloudflare erlaubt im kostenlosen Tarif nur ca. 50 Abfragen nach außen
 * pro Aufruf. Fest gebraucht werden 5 (Kurse, Termine, Teilnehmer, Protokoll, Sperrliste), je Mail 2
 * (Resend + Protokolleintrag), am Ende 1 für die Tageslimit-Prüfung. 18 Mails bleiben sicher darunter.
 * Was nicht mehr hineinpasst, holen die Nachlauf-Aufrufe in den folgenden Stunden nach (Dedupe über das Protokoll).
 */
const MAX_MAILS_PER_RUN = 18
/** Nach so vielen fehlgeschlagenen Versuchen für dieselbe Person wird nicht weiter versucht. */
const MAX_FAILED_ATTEMPTS = 20

function berlinTodayPlus(days: number): string {
  const now = new Date()
  const berlin = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }))
  berlin.setDate(berlin.getDate() + days)
  const y = berlin.getFullYear()
  const m = String(berlin.getMonth() + 1).padStart(2, '0')
  const d = String(berlin.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export const Route = createFileRoute('/api/public/hooks/course-start-reminder')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronUnauthorized, isCronAuthorized } = await import('@/lib/cron-auth.server')
        if (!isCronAuthorized(request)) return cronUnauthorized()

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { queueTemplateEmail, checkDailyLimitWarning } = await import('@/lib/email-send.server')

        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

        // Regulär 3 Tage vor Kursstart. Das Fenster reicht bis 1 Tag davor, damit Mails, die am Stichtag nicht
        // rausgingen (Abfragegrenze, Tageslimit des Anbieters, Ausfall), in den Nachlauf-Aufrufen nachgeholt werden.
        const targetDate = berlinTodayPlus(3)
        const earliestDate = berlinTodayPlus(1)

        const { data: courses, error } = await supabaseAdmin
          .from('courses')
          .select('id,name,location,schedule,starts_on,course_info,course_programs(name,location,course_info)')
          .gte('starts_on', earliestDate)
          .lte('starts_on', targetDate)
          .is('archived_at', null)
          .order('starts_on', { ascending: true })

        if (error) return json({ error: error.message }, 500)
        if (!courses || courses.length === 0) {
          return json({ success: true, date: targetDate, courses: 0, candidates: 0, queued: 0, remaining: 0 })
        }

        const courseIds = courses.map((c) => c.id)

        const [{ data: sessions }, { data: participants }] = await Promise.all([
          supabaseAdmin
            .from('course_sessions')
            .select('course_id,session_date')
            .in('course_id', courseIds)
            .order('session_date', { ascending: true }),
          supabaseAdmin
            .from('course_participants')
            .select('id,course_id,participant_name,participant_email,created_at,course_requests(parent_name)')
            .in('course_id', courseIds)
            .eq('status', 'confirmed')
            .order('created_at', { ascending: true }),
        ])

        const firstSessionByCourse = new Map<string, string>()
        for (const s of sessions ?? []) {
          if (!firstSessionByCourse.has(s.course_id)) firstSessionByCourse.set(s.course_id, s.session_date)
        }

        const startsOnByCourse = new Map(courses.map((c) => [c.id, c.starts_on as string]))
        // Nachholen gilt nur für Personen, die schon zum Stichtag angemeldet waren – wer später kommt,
        // bekommt wie bisher keine „3 Tage vorher“-Erinnerung mehr.
        const eligible = (participants ?? []).filter((p) => {
          if (!p.participant_email) return false
          const startsOn = startsOnByCourse.get(p.course_id)
          if (!startsOn || startsOn >= targetDate) return true
          const dueAt = `${addDays(startsOn, -3)}T06:00:00Z`
          return (p.created_at as string) <= dueAt
        })

        // Was schon gesendet wurde (oder bewusst unterdrückt ist), in einer Abfrage statt einer pro Person.
        const keyOf = (id: string) => `course-start-${id}`
        const keys = eligible.map((p) => keyOf(p.id))
        const doneKeys = new Set<string>()
        const failedCount = new Map<string, number>()
        if (keys.length > 0) {
          const { data: logRows } = await supabaseAdmin
            .from('email_send_log')
            .select('status,metadata')
            .eq('template_name', 'course-start-reminder')
            .in('metadata->>idempotency_key', keys)
          for (const row of logRows ?? []) {
            const key = (row.metadata as { idempotency_key?: string } | null)?.idempotency_key
            if (!key) continue
            if (row.status === 'failed') failedCount.set(key, (failedCount.get(key) ?? 0) + 1)
            else doneKeys.add(key)
          }
        }

        const open = eligible.filter((p) => {
          const key = keyOf(p.id)
          return !doneKeys.has(key) && (failedCount.get(key) ?? 0) < MAX_FAILED_ATTEMPTS
        })

        const knownSuppressed = new Set<string>()
        if (open.length > 0) {
          const { data: suppressedRows } = await supabaseAdmin
            .from('suppressed_emails')
            .select('email')
            .in('email', [...new Set(open.map((p) => p.participant_email!.trim().toLowerCase()))])
          for (const r of suppressedRows ?? []) knownSuppressed.add((r.email as string).toLowerCase())
        }

        const courseById = new Map(courses.map((c) => [c.id, c]))
        let queued = 0
        let failed = 0
        let handled = 0
        let providerDown = false

        for (const p of open) {
          if (handled >= MAX_MAILS_PER_RUN || providerDown) break
          handled += 1

          const c = courseById.get(p.course_id)!
          const program = (c as any).course_programs as
            | { name?: string; location?: string | null; course_info?: string | null }
            | null
          const firstDate = firstSessionByCourse.get(c.id) ?? c.starts_on

          const result = await queueTemplateEmail({
            templateName: 'course-start-reminder',
            recipientEmail: p.participant_email,
            idempotencyKey: keyOf(p.id),
            metadata: { participant_id: p.id, course_id: c.id },
            knownSuppressed,
            skipLimitWarning: true,
            templateData: {
              parent_name: ((p as any).course_requests?.parent_name as string | null) ?? null,
              child_name: p.participant_name,
              course_name: c.name,
              program_name: program?.name ?? null,
              course_location: c.location ?? program?.location ?? null,
              course_schedule: c.schedule ?? null,
              first_session_date: firstDate,
              // Elternzeiten kommen bewusst aus dem Zeitplan des Kurses,
              // die Terminzeiten sind die internen Trainer-Zeiten.
              first_session_time: null,
              course_info: (c as any).course_info ?? program?.course_info ?? null,
            },
          })
          if (result.queued) queued += 1
          else if (result.reason === 'send_failed') {
            failed += 1
            // Tageslimit oder Ausfall beim Anbieter: sofort aufhören, der nächste Nachlauf versucht es wieder.
            if (result.retryable) providerDown = true
          }
        }

        if (queued > 0) await checkDailyLimitWarning()

        // „remaining“ = noch offen (nicht gesendet), wird vom nächsten Nachlauf-Aufruf erneut versucht.
        return json({
          success: true,
          date: targetDate,
          courses: courses.length,
          candidates: eligible.length,
          queued,
          failed,
          remaining: open.length - queued,
          ...(providerDown ? { providerDown: true } : {}),
        })
      },
    },
  },
})
