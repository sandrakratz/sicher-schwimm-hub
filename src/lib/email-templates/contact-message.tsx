import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  from_name?: string
  from_email?: string
  category?: string
  subject?: string
  body?: string
  created_at?: string
}

const Email = (p: Props) => (
  <Html lang="de">
    <Head />
    <Preview>Neue Kontaktnachricht von {p.from_name || 'unbekannt'}</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
      <Container style={{ padding: '24px', maxWidth: '600px' }}>
        <Heading style={{ color: '#0c4a6e' }}>Neue Kontaktnachricht</Heading>
        <Text>Es ist eine neue Nachricht über das Kontaktformular eingegangen.</Text>
        <Hr />
        <Section>
          <Text><strong>Name:</strong> {p.from_name || '—'}</Text>
          <Text><strong>E-Mail:</strong> {p.from_email || '—'}</Text>
          <Text><strong>Kategorie:</strong> {p.category || '—'}</Text>
          <Text><strong>Betreff:</strong> {p.subject || '—'}</Text>
          <Text><strong>Nachricht:</strong></Text>
          <Text style={{ whiteSpace: 'pre-wrap' }}>{p.body || '—'}</Text>
          <Text><strong>Eingegangen am:</strong> {p.created_at ? new Date(p.created_at).toLocaleString('de-DE') : '—'}</Text>
        </Section>
        <Hr />
        <Text style={{ fontSize: '12px', color: '#64748b' }}>
          Verwaltung im Admin-Bereich unter „Nachrichten".
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Neue Kontaktnachricht – ${d.from_name || 'Unbekannt'}`,
  displayName: 'Kontaktnachricht (Admin-Benachrichtigung)',
  to: 'info@sicher-schwimmen.com',
  previewData: { from_name: 'Erika Beispiel', from_email: 'erika@example.com', category: 'other', subject: 'Frage', body: 'Hallo…', created_at: new Date().toISOString() },
} satisfies TemplateEntry
