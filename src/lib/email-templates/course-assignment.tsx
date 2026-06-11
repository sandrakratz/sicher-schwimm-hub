import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

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
}

function fmtDate(d?: string) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('de-DE') } catch { return d }
}

const Email = (p: Props) => (
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
          {p.course_duration && <Text style={{ margin: '4px 0' }}><strong>Dauer:</strong> {p.course_duration}</Text>}
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
        {p.admin_notes && (
          <>
            <Hr />
            <Text><strong>Persönliche Nachricht:</strong></Text>
            <Text>{p.admin_notes}</Text>
          </>
        )}
        <Hr />
        <Text>Sollten Sie Fragen haben oder den Platz nicht wahrnehmen können, antworten Sie bitte einfach auf diese E-Mail.</Text>
        <Text>Mit besten Grüßen,<br />Ihr Team von Sicher-Schwimmen</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Ihre Kurszuteilung: ${d.course_name || 'Schwimmkurs'}`,
  displayName: 'Kurszuteilung (Eltern-Benachrichtigung)',
  previewData: {
    parent_name: 'Erika Beispiel',
    child_name: 'Max Beispiel',
    course_name: 'Seepferdchen Frühjahr',
    course_schedule: 'Mo & Mi 17:00–18:00',
    course_location: 'Hallenbad Hennef',
    course_starts_on: '2026-03-01',
    course_ends_on: '2026-05-15',
    status_label: 'Bestätigt',
  },
} satisfies TemplateEntry
