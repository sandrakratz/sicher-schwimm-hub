import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { formatDateBerlin } from '@/lib/format'

interface Props {
  parent_name?: string
  child_name?: string
  course_name?: string
  course_target_group?: string
  course_age_range?: string
  course_duration?: string
  course_location?: string
  course_schedule?: string
  course_starts_on?: string
  course_ends_on?: string
  course_description?: string
  status_label?: string
  admin_notes?: string
  // Zahlung
  is_member?: boolean | null
  price_amount?: number | null
  payment_due_days?: number | null
  bank_recipient?: string
  bank_iban?: string
  bank_bic?: string
  bank_name?: string
  payment_reference?: string
  // Links
  site_base_url?: string
}

function fmtDate(d?: string) {
  return formatDateBerlin(d)
}
function fmtDuration(d?: string) {
  if (!d) return undefined
  const trimmed = String(d).trim()
  // Wenn nur eine Zahl angegeben ist, automatisch "Wochen" anhängen
  if (/^\d+(\.\d+)?$/.test(trimmed)) return `${trimmed} Wochen`
  return trimmed
}
function fmtPrice(p?: number | null) {
  if (p == null) return '—'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(p))
}

const Email = (p: Props) => {
  const base = p.site_base_url || 'https://sicher-schwimmen.com'
  const showPayment = p.status_label !== 'Warteliste'
  const memberLabel = p.is_member === true ? 'Mitglied' : p.is_member === false ? 'Nicht-Mitglied' : null
  const hasBank = Boolean(p.bank_iban && p.bank_recipient)
  return (
  <Html lang="de">
    <Head />
    <Preview>Ihre Kurszuteilung: {p.course_name || 'Schwimmkurs'}</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
      <Container style={{ padding: '24px', maxWidth: '600px' }}>
        <Heading style={{ color: '#0c4a6e' }}>Ihre Kurszuteilung</Heading>
        <Text>Hallo {p.parent_name || ''},</Text>
        <Text>
          wir freuen uns, Ihnen mitteilen zu können, dass {p.child_name ? <strong>{p.child_name}</strong> : 'Ihre Anmeldung'} {p.status_label === 'Warteliste' ? 'auf die Warteliste für den folgenden Kurs gesetzt wurde' : 'für den folgenden Kurs eingebucht wurde'}:
        </Text>
        <Hr />
        <Section style={{ backgroundColor: '#f0f9ff', padding: '16px', borderRadius: '8px' }}>
          <Heading as="h2" style={{ color: '#0c4a6e', fontSize: '18px', margin: '0 0 8px 0' }}>{p.course_name || '—'}</Heading>
          {p.course_target_group && <Text style={{ margin: '4px 0' }}><strong>Zielgruppe:</strong> {p.course_target_group}</Text>}
          {p.course_age_range && <Text style={{ margin: '4px 0' }}><strong>Altersgruppe:</strong> {p.course_age_range}</Text>}
          {p.course_duration && <Text style={{ margin: '4px 0' }}><strong>Dauer:</strong> {fmtDuration(p.course_duration)}</Text>}
          {p.course_schedule && <Text style={{ margin: '4px 0' }}><strong>Zeiten:</strong> {p.course_schedule}</Text>}
          {(p.course_starts_on || p.course_ends_on) && (
            <Text style={{ margin: '4px 0' }}><strong>Zeitraum:</strong> {fmtDate(p.course_starts_on)} – {fmtDate(p.course_ends_on)}</Text>
          )}
          {p.course_location && <Text style={{ margin: '4px 0' }}><strong>Ort:</strong> {p.course_location}</Text>}
          {p.status_label && <Text style={{ margin: '4px 0' }}><strong>Status:</strong> {p.status_label}</Text>}
        </Section>

        {p.course_description && (
          <>
            <Text style={{ marginTop: '16px' }}><strong>Beschreibung</strong></Text>
            <Text>{p.course_description}</Text>
          </>
        )}

        {showPayment && (
          <>
            <Hr />
            <Heading as="h2" style={{ color: '#0c4a6e', fontSize: '18px', margin: '16px 0 8px 0' }}>Zahlungsinformationen</Heading>
            {memberLabel && (
              <Text style={{ margin: '4px 0' }}><strong>Mitgliedsstatus:</strong> {memberLabel}</Text>
            )}
            {p.price_amount != null && (
              <Text style={{ margin: '4px 0', fontSize: '16px' }}>
                <strong>Kursgebühr:</strong> <strong style={{ color: '#0c4a6e' }}>{fmtPrice(p.price_amount)}</strong>
              </Text>
            )}
            <Text style={{ margin: '4px 0' }}>
              Bitte überweisen Sie den Betrag innerhalb von <strong>{p.payment_due_days ?? 14} Tagen</strong> nach Erhalt dieser E-Mail.
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
                <>
                  <Text style={{ margin: '2px 0', fontStyle: 'italic', color: '#64748b' }}>
                    Unsere Bankverbindung wird Ihnen in Kürze separat mitgeteilt.
                  </Text>
                  {p.payment_reference && (
                    <Text style={{ margin: '2px 0' }}><strong>Verwendungszweck:</strong> {p.payment_reference}</Text>
                  )}
                </>
              )}
            </Section>
          </>
        )}

        {p.admin_notes && (
          <>
            <Hr />
            <Text><strong>Persönliche Nachricht:</strong></Text>
            <Text>{p.admin_notes}</Text>
          </>
        )}

        <Hr />
        <Heading as="h3" style={{ color: '#0c4a6e', fontSize: '15px', margin: '12px 0 6px 0' }}>Wichtige Hinweise</Heading>
        <Text style={{ margin: '4px 0' }}>
          Bitte beachten Sie unsere <Link href={`${base}/kursbedingungen`} style={{ color: '#0c4a6e' }}>Kursordnung &amp; AGB</Link> sowie unsere <Link href={`${base}/datenschutz`} style={{ color: '#0c4a6e' }}>Datenschutzerklärung</Link>. Mit der verbindlichen Buchung gelten diese als akzeptiert.
        </Text>
        <Text style={{ margin: '4px 0' }}>
          Widerrufsrecht: Sie können den Vertrag innerhalb von 14 Tagen ohne Angabe von Gründen widerrufen.{' '}
          <Link href={`${base}/widerruf`} style={{ color: '#0c4a6e' }}>Zum Widerrufsformular</Link>
        </Text>

        <Hr />
        <Text>Sollten Sie Fragen haben oder den Platz nicht wahrnehmen können, antworten Sie bitte einfach auf diese E-Mail.</Text>
        <Text>Mit besten Grüßen,<br />Ihr Team von Sicher-Schwimmen</Text>
      </Container>
    </Body>
  </Html>
)}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Ihre Kurszuteilung: ${d.course_name || 'Schwimmkurs'}`,
  displayName: 'Kurszuteilung (Eltern-Benachrichtigung)',
  previewData: {
    parent_name: 'Erika Beispiel',
    child_name: 'Max Beispiel',
    course_name: 'Seepferdchen Frühjahr',
    course_duration: '10',
    course_schedule: 'Mo & Mi 17:00–18:00',
    course_location: 'Hallenbad Hennef',
    course_starts_on: '2026-03-01',
    course_ends_on: '2026-05-15',
    status_label: 'Bestätigt',
    is_member: true,
    price_amount: 150,
    payment_due_days: 14,
    payment_reference: 'Seepferdchen Frühjahr – Max Beispiel',
  },
} satisfies TemplateEntry
