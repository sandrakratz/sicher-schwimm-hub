import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

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
}

const Email = (p: Props) => (
  <Html lang="de">
    <Head />
    <Preview>Neue Kursanfrage von {p.parent_name || 'unbekannt'}</Preview>
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
          <Text><strong>Eingegangen am:</strong> {p.created_at ? new Date(p.created_at).toLocaleString('de-DE') : '—'}</Text>
        </Section>
        <Hr />
        <Text style={{ fontSize: '12px', color: '#64748b' }}>
          Verwaltung im Admin-Bereich unter „Kursanfragen".
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Neue Kursanfrage – ${d.parent_name || 'Unbekannt'}`,
  displayName: 'Kursanfrage (Admin-Benachrichtigung)',
  to: 'info@sicher-schwimmen.com',
  previewData: { parent_name: 'Erika Beispiel', parent_email: 'erika@example.com', desired_course: 'Seepferdchen', created_at: new Date().toISOString() },
} satisfies TemplateEntry
