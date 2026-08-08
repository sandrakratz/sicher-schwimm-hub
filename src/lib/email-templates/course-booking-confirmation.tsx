import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { formatDateBerlin } from '@/lib/format'

interface Props {
  parent_name?: string
  child_name?: string
  course_name?: string
  program_name?: string
  course_target_group?: string
  course_age_range?: string
  course_duration?: string
  course_location?: string
  course_schedule?: string
  course_starts_on?: string
  course_ends_on?: string
  course_description?: string
  waitlist?: boolean
  is_member?: boolean | null
  price_amount?: number | null
  payment_due_days?: number | null
  bank_recipient?: string
  bank_iban?: string
  bank_bic?: string
  bank_name?: string
  payment_reference?: string
  site_base_url?: string
}

function fmtPrice(p?: number | null) {
  if (p == null) return '—'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(p))
}
function fmtDuration(d?: string) {
  if (!d) return undefined
  const t = String(d).trim()
  return /^\d+(\.\d+)?$/.test(t) ? `${t} Wochen` : t
}

const Email = (p: Props) => {
  const base = p.site_base_url || 'https://sicher-schwimmen.com'
  const waitlist = Boolean(p.waitlist)
  const title = waitlist ? 'Ihre Anmeldung auf der Warteliste' : 'Ihre verbindliche Kursbuchung'
  const memberLabel = p.is_member === true ? 'Mitglied' : p.is_member === false ? 'Nicht-Mitglied' : null
  const hasBank = Boolean(p.bank_iban && p.bank_recipient)
  const courseTitle = p.program_name || p.course_name || 'Schwimmkurs'

  return (
    <Html lang="de">
      <Head />
      <Preview>{waitlist ? 'Wartelisten-Bestätigung' : 'Buchungsbestätigung'}: {courseTitle}</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
        <Container style={{ padding: '24px', maxWidth: '600px' }}>
          <Heading style={{ color: '#0c4a6e' }}>{title}</Heading>
          <Text>Hallo {p.parent_name || ''},</Text>
          <Text>
            {waitlist ? (
              <>
                vielen Dank für Ihre Anmeldung. Der gewünschte Kurszeitraum ist aktuell ausgebucht – wir haben{' '}
                {p.child_name ? <strong>{p.child_name}</strong> : 'die Anmeldung'} auf die Warteliste gesetzt und melden
                uns, sobald ein Platz frei wird.
              </>
            ) : (
              <>
                vielen Dank für Ihre Buchung. {p.child_name ? <strong>{p.child_name}</strong> : 'Die Anmeldung'} ist
                verbindlich für den folgenden Kurs angemeldet – eine weitere Bestätigung durch uns ist nicht nötig.
              </>
            )}
          </Text>

          <Hr />
          <Section style={{ backgroundColor: '#f0f9ff', padding: '16px', borderRadius: '8px' }}>
            <Heading as="h2" style={{ color: '#0c4a6e', fontSize: '18px', margin: '0 0 8px 0' }}>{courseTitle}</Heading>
            {p.course_name && p.program_name && p.course_name !== p.program_name && (
              <Text style={{ margin: '4px 0' }}><strong>Kurs:</strong> {p.course_name}</Text>
            )}
            {(p.course_starts_on || p.course_ends_on) && (
              <Text style={{ margin: '4px 0' }}>
                <strong>Zeitraum:</strong> {formatDateBerlin(p.course_starts_on)} – {formatDateBerlin(p.course_ends_on)}
              </Text>
            )}
            {p.course_schedule && <Text style={{ margin: '4px 0' }}><strong>Zeiten:</strong> {p.course_schedule}</Text>}
            {p.course_duration && <Text style={{ margin: '4px 0' }}><strong>Dauer:</strong> {fmtDuration(p.course_duration)}</Text>}
            {p.course_location && <Text style={{ margin: '4px 0' }}><strong>Ort:</strong> {p.course_location}</Text>}
            {p.course_age_range && <Text style={{ margin: '4px 0' }}><strong>Altersgruppe:</strong> {p.course_age_range}</Text>}
            <Text style={{ margin: '4px 0' }}><strong>Status:</strong> {waitlist ? 'Warteliste' : 'Verbindlich gebucht'}</Text>
          </Section>

          {p.course_description && (
            <>
              <Text style={{ marginTop: '16px' }}><strong>Beschreibung</strong></Text>
              <Text>{p.course_description}</Text>
            </>
          )}

          {!waitlist && (
            <>
              <Hr />
              <Heading as="h2" style={{ color: '#0c4a6e', fontSize: '18px', margin: '16px 0 8px 0' }}>Zahlungsinformationen</Heading>
              {memberLabel && <Text style={{ margin: '4px 0' }}><strong>Mitgliedsstatus:</strong> {memberLabel}</Text>}
              {p.price_amount != null && (
                <Text style={{ margin: '4px 0', fontSize: '16px' }}>
                  <strong>Kursgebühr:</strong> <strong style={{ color: '#0c4a6e' }}>{fmtPrice(p.price_amount)}</strong>
                </Text>
              )}
              <Text style={{ margin: '4px 0' }}>
                Bitte überweisen Sie den Betrag innerhalb von <strong>{p.payment_due_days ?? 14} Tagen</strong> nach
                Erhalt dieser E-Mail, spätestens jedoch einen Tag vor Kursbeginn.
              </Text>
              <Section style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', marginTop: '8px', border: '1px solid #e2e8f0' }}>
                {hasBank ? (
                  <>
                    <Text style={{ margin: '2px 0' }}><strong>Empfänger:</strong> {p.bank_recipient}</Text>
                    <Text style={{ margin: '2px 0' }}><strong>IBAN:</strong> {p.bank_iban}</Text>
                    {p.bank_bic && <Text style={{ margin: '2px 0' }}><strong>BIC:</strong> {p.bank_bic}</Text>}
                    {p.bank_name && <Text style={{ margin: '2px 0' }}><strong>Bank:</strong> {p.bank_name}</Text>}
                    {p.payment_reference && (
                      <Text style={{ margin: '2px 0' }}><strong>Verwendungszweck:</strong> {p.payment_reference}</Text>
                    )}
                  </>
                ) : (
                  <Text style={{ margin: '2px 0', fontStyle: 'italic', color: '#64748b' }}>
                    Unsere Bankverbindung wird Ihnen in Kürze separat mitgeteilt.
                  </Text>
                )}
              </Section>
            </>
          )}

          <Hr />
          <Text style={{ margin: '4px 0' }}>
            Es gelten unsere <Link href={`${base}/kursbedingungen`} style={{ color: '#0c4a6e' }}>Kursteilnahmebedingungen</Link>{' '}
            sowie unsere <Link href={`${base}/datenschutz`} style={{ color: '#0c4a6e' }}>Datenschutzerklärung</Link>.
          </Text>
          <Text style={{ margin: '4px 0' }}>
            Widerrufsrecht: Sie können den Vertrag innerhalb von 14 Tagen ohne Angabe von Gründen widerrufen.{' '}
            <Link href={`${base}/widerruf`} style={{ color: '#0c4a6e' }}>Zum Widerrufsformular</Link>
          </Text>

          <Hr />
          <Text>Bei Fragen antworten Sie einfach auf diese E-Mail.</Text>
          <Text>Mit besten Grüßen,<br />Ihr Team von Sicher-Schwimmen</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Buchungsbestätigung: ${d.program_name || d.course_name || 'Schwimmkurs'}`,
  displayName: 'Kursbuchung – Bestätigung mit Zahlungsinfos',
  previewData: {
    parent_name: 'Erika Beispiel',
    child_name: 'Max Beispiel',
    program_name: 'Seepferdchen im Kurhaus',
    course_name: 'Seepferdchen Kurhaus Oktober 2026',
    course_starts_on: '2026-10-11',
    course_ends_on: '2026-11-08',
    course_location: 'Kurshausstr. 27, 53773 Hennef',
    is_member: false,
    price_amount: 200,
    payment_due_days: 14,
    bank_recipient: 'Sicher-Schwimmen e.V.',
    bank_iban: 'DE85 3806 0186 5081 0160 13',
    bank_bic: 'GENODED1BRS',
    bank_name: 'VR Bank Hennef',
    payment_reference: 'Seepferdchen Kurhaus Oktober 2026 – Max Beispiel',
  },
} satisfies TemplateEntry

export const waitlistTemplate = {
  component: Email,
  subject: (d: Record<string, any>) => `Warteliste: ${d.program_name || d.course_name || 'Schwimmkurs'}`,
  displayName: 'Kursbuchung – Wartelisten-Bestätigung',
  previewData: { ...template.previewData, waitlist: true },
} satisfies TemplateEntry
