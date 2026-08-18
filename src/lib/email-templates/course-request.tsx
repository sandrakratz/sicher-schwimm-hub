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
  health_info?: string
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

const Email = (p: Props) => {
  const hasCourse = Boolean(p.course_name || p.course_starts_on)
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
            <Text><strong>Gesundheit:</strong> {p.health_info || '—'}</Text>
            <Text><strong>Nachricht:</strong> {p.message || '—'}</Text>
            <Text><strong>Eingegangen am:</strong> {formatDateTimeBerlin(p.created_at)}</Text>
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
