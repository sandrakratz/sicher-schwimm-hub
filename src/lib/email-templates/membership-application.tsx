import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  full_name?: string
  email?: string
  membership_type?: string
  phone?: string
  city?: string
  iban?: string
  created_at?: string
}

const Email = ({ full_name, email, membership_type, phone, city, iban, created_at }: Props) => (
  <Html lang="de">
    <Head />
    <Preview>Neuer Mitgliedsantrag von {full_name || 'unbekannt'}</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
      <Container style={{ padding: '24px', maxWidth: '600px' }}>
        <Heading style={{ color: '#0c4a6e' }}>Neuer Mitgliedsantrag</Heading>
        <Text>Es ist ein neuer Mitgliedsantrag eingegangen.</Text>
        <Hr />
        <Section>
          <Text><strong>Name:</strong> {full_name || '—'}</Text>
          <Text><strong>E-Mail:</strong> {email || '—'}</Text>
          <Text><strong>Telefon:</strong> {phone || '—'}</Text>
          <Text><strong>Ort:</strong> {city || '—'}</Text>
          <Text><strong>Mitgliedschaftsart:</strong> {membership_type || '—'}</Text>
          <Text><strong>IBAN:</strong> {iban || '—'}</Text>
          <Text><strong>Eingegangen am:</strong> {created_at ? new Date(created_at).toLocaleString('de-DE') : '—'}</Text>
        </Section>
        <Hr />
        <Text style={{ fontSize: '12px', color: '#64748b' }}>
          Vollständige Daten und SEPA-Mandat im Admin-Bereich unter „Mitgliedschaften".
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Neuer Mitgliedsantrag – ${d.full_name || 'Unbekannt'}`,
  displayName: 'Mitgliedsantrag (Admin-Benachrichtigung)',
  to: 'info@sicher-schwimmen.com',
  previewData: { full_name: 'Max Mustermann', email: 'max@example.com', membership_type: 'aktiv', created_at: new Date().toISOString() },
} satisfies TemplateEntry
