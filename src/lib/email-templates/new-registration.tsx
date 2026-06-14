import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { formatDateTimeBerlin } from '@/lib/format'

interface Props {
  first_name?: string
  last_name?: string
  email?: string
  created_at?: string
}

const Email = (p: Props) => (
  <Html lang="de">
    <Head />
    <Preview>Neue Registrierung: {p.first_name || ''} {p.last_name || ''}</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
      <Container style={{ padding: '24px', maxWidth: '600px' }}>
        <Heading style={{ color: '#0c4a6e' }}>Neue Registrierung</Heading>
        <Text>Ein neues Konto wurde im Mitgliederbereich angelegt und wartet auf Freischaltung.</Text>
        <Hr />
        <Section>
          <Text><strong>Name:</strong> {[p.first_name, p.last_name].filter(Boolean).join(' ') || '—'}</Text>
          <Text><strong>E-Mail:</strong> {p.email || '—'}</Text>
          <Text><strong>Registriert am:</strong> {formatDateTimeBerlin(p.created_at)}</Text>
        </Section>
        <Hr />
        <Text style={{ fontSize: '12px', color: '#64748b' }}>
          Freischaltung im Admin-Bereich unter „Benutzer".
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Neue Registrierung – ${[d.first_name, d.last_name].filter(Boolean).join(' ') || d.email || 'Unbekannt'}`,
  displayName: 'Neue Registrierung (Admin-Benachrichtigung)',
  to: 'info@sicher-schwimmen.com',
  previewData: { first_name: 'Erika', last_name: 'Beispiel', email: 'erika@example.com', created_at: new Date().toISOString() },
} satisfies TemplateEntry
