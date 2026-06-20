import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { formatDateTimeBerlin } from '@/lib/format'

interface Props {
  reference_number?: string
  parent_first_name?: string
  parent_last_name?: string
  email?: string
  phone?: string
  child_name?: string
  course_name?: string
  booking_date?: string
  notes?: string
  revocation_text?: string
  ip_address?: string
  created_at?: string
}

const Email = (p: Props) => (
  <Html lang="de">
    <Head />
    <Preview>Neuer Widerruf {p.reference_number || ''}</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
      <Container style={{ padding: '24px', maxWidth: '600px' }}>
        <Heading style={{ color: '#0c4a6e' }}>Neuer Vertragswiderruf</Heading>
        <Text>Es wurde ein neuer Widerruf eines Schwimmkursvertrages eingereicht.</Text>
        <Hr />
        <Section>
          <Text><strong>Referenznummer:</strong> {p.reference_number || '—'}</Text>
          <Text><strong>Eingegangen am:</strong> {formatDateTimeBerlin(p.created_at)}</Text>
          <Text><strong>IP-Adresse:</strong> {p.ip_address || '—'}</Text>
        </Section>
        <Hr />
        <Section>
          <Text><strong>Vorname:</strong> {p.parent_first_name || '—'}</Text>
          <Text><strong>Nachname:</strong> {p.parent_last_name || '—'}</Text>
          <Text><strong>E-Mail:</strong> {p.email || '—'}</Text>
          <Text><strong>Telefon:</strong> {p.phone || '—'}</Text>
          <Text><strong>Name des Kindes:</strong> {p.child_name || '—'}</Text>
          <Text><strong>Schwimmkurs:</strong> {p.course_name || '—'}</Text>
          <Text><strong>Buchungs-/Zuteilungsdatum:</strong> {p.booking_date || '—'}</Text>
          <Text><strong>Bemerkungen:</strong></Text>
          <Text style={{ whiteSpace: 'pre-wrap' }}>{p.notes || '—'}</Text>
          <Text><strong>Widerrufserklärung:</strong></Text>
          <Text style={{ whiteSpace: 'pre-wrap' }}>{p.revocation_text || '—'}</Text>
        </Section>
        <Hr />
        <Text style={{ fontSize: '12px', color: '#64748b' }}>
          Verwaltung im Admin-Bereich unter „Widerrufe".
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Widerruf Schwimmkurs – ${d.child_name || 'unbekannt'}`,
  displayName: 'Widerruf (Admin-Benachrichtigung)',
  to: 'widerruf@sicher-schwimmen.com',
  previewData: {
    reference_number: 'SW-WID-20260620-12345',
    parent_first_name: 'Erika',
    parent_last_name: 'Beispiel',
    email: 'erika@example.com',
    phone: '0151 1234567',
    child_name: 'Mia Beispiel',
    course_name: 'Seepferdchen Frühjahr',
    booking_date: '2026-05-10',
    notes: '—',
    revocation_text: 'Hiermit widerrufe ich den von mir abgeschlossenen Vertrag über den oben genannten Schwimmkurs.',
    ip_address: '203.0.113.10',
    created_at: new Date().toISOString(),
  },
} satisfies TemplateEntry
