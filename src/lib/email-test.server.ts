import * as React from 'react'
import { render } from '@react-email/components'
import { TEMPLATES } from '@/lib/email-templates/registry'
import { SignupEmail } from '@/lib/email-templates/signup'
import { sendRawEmail } from '@/lib/email-send.server'
import { templateLabel } from '@/lib/email-template-labels'

const SITE_NAME = 'Sicher Schwimmen e.V.'
const SITE_URL = 'https://sicher-schwimmen.com'

function replyHtml(recipient: string): { subject: string; html: string; text: string } {
  const subject = '[TEST] Antwort auf deine Kursanfrage'
  const text = `Hallo,

dies ist ein Testversand von ${SITE_NAME}. So sieht eine persönliche Antwort auf eine Kursanfrage oder Nachricht aus.

Empfänger: ${recipient}

Sportliche Grüße
${SITE_NAME}`
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;line-height:1.6">${text
    .split('\n')
    .map(l => `<p style="margin:0 0 10px">${l || '&nbsp;'}</p>`)
    .join('')}</div>`
  return { subject, html, text }
}

export type TestSendResult = {
  recipient: string
  template: string
  label: string
  sent: boolean
  reason?: string | undefined
  error?: string | undefined
}

/** Versendet je Vorlage eine echte Test-E-Mail an jeden Empfänger. */
export async function runTestSend(
  recipients: string[],
  templates: string[],
  senderUserId: string,
): Promise<{ results: TestSendResult[]; sent: number; failed: number }> {
  const stamp = Date.now()
  const results: TestSendResult[] = []

  for (const recipient of recipients) {
    for (const name of templates) {
      const label = templateLabel(name)
      try {
        let subject: string
        let html: string
        let text: string

        if (name === 'signup') {
          const element = React.createElement(SignupEmail, {
            siteName: SITE_NAME,
            siteUrl: SITE_URL,
            recipient,
            confirmationUrl: `${SITE_URL}/auth`,
          })
          html = await render(element)
          text = await render(element, { plainText: true })
          subject = 'E-Mail-Adresse bestätigen'
        } else if (name === 'course-request-reply') {
          const raw = replyHtml(recipient)
          subject = raw.subject
          html = raw.html
          text = raw.text
        } else {
          const tpl = TEMPLATES[name]
          if (!tpl) {
            results.push({ recipient, template: name, label, sent: false, reason: 'unknown_template' })
            continue
          }
          const data = { ...(tpl.previewData ?? {}) }
          const element = React.createElement(tpl.component, data)
          html = await render(element)
          text = await render(element, { plainText: true })
          subject = typeof tpl.subject === 'function' ? tpl.subject(data) : tpl.subject
        }

        const testSubject = subject.startsWith('[TEST]') ? subject : `[TEST] ${subject}`
        const result = await sendRawEmail({
          templateName: name,
          recipientEmail: recipient,
          subject: testSubject,
          html,
          text,
          idempotencyKey: `test-${name}-${recipient}-${stamp}`,
          senderUserId,
          metadata: { test_send: true, template: name },
        })
        results.push({ recipient, template: name, label, sent: result.sent, reason: result.reason })
      } catch (e) {
        results.push({
          recipient,
          template: name,
          label,
          sent: false,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }

  return {
    results,
    sent: results.filter(r => r.sent).length,
    failed: results.filter(r => !r.sent).length,
  }
}
