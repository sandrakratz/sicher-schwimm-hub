import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { formatDateBerlin, formatDateTimeBerlin } from '@/lib/format'

interface Props {
  parent_name?: string
  parent_email?: string
  parent_phone?: string
  child_name?: string
  child_dob?: string
  swimming_level?: string
  desired_course?: string
  /** Nur zur Erkennung, ob Gesundheitsangaben vorliegen – der Text selbst wird nie in die E-Mail geschrieben. */
  health_info?: string
  has_health_info?: boolean
  /** Zustimmungen aus dem Formular (nur anzeigen, wenn bekannt). */
  terms_accepted?: boolean
  privacy_accepted?: boolean
  health_consent?: boolean
  message?: string
  created_at?: string
  program_name?: string
  course_name?: string
  course_starts_on?: string | null
  course_ends_on?: string | null
  course_schedule?: string | null
  course_location?: string | null
  booking_status?: string
}

function periodLabel(p: Props) {
  if (!p.course_starts_on && !p.course_ends_on) return '—'
  const from = p.course_starts_on ? formatDateBerlin(p.course_starts_on) : '—'
  const to = p.course_ends_on ? formatDateBerlin(p.course_ends_on) : '—'
  return `${from} – ${to}`
}

const REQUIRED_FIELDS: Array<[keyof Props, string]> = [
  ['parent_name', 'Name der Eltern'],
  ['parent_email', 'E-Mail'],
  ['parent_phone', 'Telefon'],
  ['child_name', 'Name des Kindes'],
  ['child_dob', 'Geburtsdatum des Kindes'],
]

const okStyle = { margin: '2px 0', color: '#166534' }
const warnStyle = { margin: '2px 0', color: '#b45309', fontWeight: 'bold' as const }

const Email = (p: Props) => {
  const hasCourse = Boolean(p.course_name || p.course_starts_on)
  const hasHealth = p.has_health_info ?? Boolean(p.health_info?.trim())
  const missing = REQUIRED_FIELDS.filter(([key]) => !String(p[key] ?? '').trim()).map(([, label]) => label)
  return (
    <Html lang="de">
      <Head />
      <Preview>
        {hasCourse
          ? `Buchung: ${p.program_name || p.course_name} (${p.course_starts_on ? formatDateBerlin(p.course_starts_on) : ''})`
          : `Neue Kursanfrage von ${p.parent_name || 'unbekannt'}`}
      </Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
        <Container style={{ padding: '24px', maxWidth: '600px' }}>
          <Heading style={{ color: '#0c4a6e' }}>Neue Kursanfrage</Heading>
          <Text>Es ist eine neue Kursanfrage / Wartelisten-Eintragung eingegangen.</Text>
          <Hr />
          <Section>
            <Text><strong>Eltern:</strong> {p.parent_name || '—'}</Text>
            <Text><strong>E-Mail:</strong> {p.parent_email || '—'}</Text>
            <Text><strong>Telefon:</strong> {p.parent_phone || '—'}</Text>
            <Text><strong>Kind:</strong> {p.child_name || '—'}</Text>
            <Text><strong>Geburtsdatum:</strong> {p.child_dob || '—'}</Text>
            <Text><strong>Schwimmlevel:</strong> {p.swimming_level || '—'}</Text>
            <Text><strong>Gewünschter Kurs:</strong> {p.desired_course || '—'}</Text>
            <Text><strong>Nachricht:</strong> {p.message || '—'}</Text>
            <Text><strong>Eingegangen am:</strong> {formatDateTimeBerlin(p.created_at)}</Text>
          </Section>
          <Hr />
          <Section style={{ backgroundColor: hasHealth ? '#fffbeb' : '#f8fafc', padding: '12px 16px', borderRadius: '8px' }}>
            <Text style={{ margin: 0 }}>
              <strong>Gesundheitsangaben:</strong>{' '}
              {hasHealth
                ? 'JA – es wurden Gesundheitsangaben vermerkt. Aus Datenschutzgründen stehen sie nicht in dieser E-Mail, sondern nur im Admin-Bereich unter „Kursanfragen".'
                : 'keine Angaben gemacht'}
            </Text>
          </Section>
          <Section style={{ marginTop: '12px', backgroundColor: missing.length ? '#fffbeb' : '#f0fdf4', padding: '12px 16px', borderRadius: '8px' }}>
            <Text style={{ margin: '0 0 4px' }}><strong>Prüfung der Pflichtangaben</strong></Text>
            {missing.length === 0 ? (
              <Text style={okStyle}>✓ Alle Pflichtfelder sind ausgefüllt (Eltern, E-Mail, Telefon, Kind, Geburtsdatum).</Text>
            ) : (
              <Text style={warnStyle}>⚠ Es fehlen Pflichtangaben: {missing.join(', ')}</Text>
            )}
            {p.terms_accepted === true && <Text style={okStyle}>✓ Kursteilnahmebedingungen akzeptiert.</Text>}
            {p.terms_accepted === false && <Text style={warnStyle}>⚠ Kursteilnahmebedingungen nicht bestätigt.</Text>}
            {p.privacy_accepted === true && <Text style={okStyle}>✓ Datenschutzhinweise bestätigt.</Text>}
            {p.privacy_accepted === false && <Text style={warnStyle}>⚠ Datenschutzhinweise nicht bestätigt.</Text>}
            {hasHealth && p.health_consent === true && (
              <Text style={okStyle}>✓ Einwilligung zur Verarbeitung der Gesundheitsangaben (Art. 9 DSGVO) erteilt.</Text>
            )}
            {hasHealth && p.health_consent === false && (
              <Text style={warnStyle}>⚠ Gesundheitsangaben ohne dokumentierte Einwilligung.</Text>
            )}
          </Section>
          {hasCourse && (
            <>
              <Hr />
              <Heading as="h2" style={{ color: '#0c4a6e', fontSize: '17px' }}>Gebuchter Kurszeitraum</Heading>
              <Section style={{ backgroundColor: '#f0f9ff', padding: '12px 16px', borderRadius: '8px' }}>
                <Text><strong>Kursangebot:</strong> {p.program_name || '—'}</Text>
                <Text><strong>Kurszeitraum:</strong> {p.course_name || '—'}</Text>
                <Text><strong>Zeitraum:</strong> {periodLabel(p)}</Text>
                <Text><strong>Kurstage:</strong> {p.course_schedule || '—'}</Text>
                <Text><strong>Kursort:</strong> {p.course_location || '—'}</Text>
                <Text><strong>Status:</strong> {p.booking_status || '—'}</Text>
              </Section>
            </>
          )}
          <Hr />
          <Text style={{ fontSize: '12px', color: '#64748b' }}>
            Verwaltung im Admin-Bereich unter „Kursanfragen".
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => {
    const course = d.program_name || d.course_name
    if (course) {
      const start = d.course_starts_on ? ` ab ${formatDateBerlin(d.course_starts_on)}` : ''
      return `Neue Kursbuchung – ${course}${start} (${d.parent_name || 'Unbekannt'})`
    }
    return `Neue Kursanfrage – ${d.parent_name || 'Unbekannt'}`
  },
  displayName: 'Kursanfrage (Admin-Benachrichtigung)',
  to: 'info@sicher-schwimmen.com',
  previewData: { parent_name: 'Erika Beispiel', parent_email: 'erika@example.com', desired_course: 'Seepferdchen', created_at: new Date().toISOString() },
} satisfies TemplateEntry
