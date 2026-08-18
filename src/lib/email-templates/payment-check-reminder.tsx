import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { formatDateBerlin } from '@/lib/format'
import { formatEuro } from '@/lib/course-confirmation'

interface Props {
  child_name?: string
  parent_name?: string
  parent_email?: string
  program_name?: string
  course_name?: string
  course_starts_on?: string | null
  course_ends_on?: string | null
  booked_at?: string | null
  price_amount?: number | null
  document_no?: string | null
  payment_reference?: string | null
}

const row = { margin: '3px 0' } as const
const labelStyle = { display: 'inline-block', minWidth: '180px' } as const

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Text style={row}>
      <strong style={labelStyle}>{label}</strong>
      {value}
    </Text>
  )
}

const Email = (p: Props) => (
  <Html lang="de">
    <Head />
    <Preview>
      Geldeingang prüfen – {p.child_name || 'Teilnehmer/in'} (Kursbeginn{' '}
      {p.course_starts_on ? formatDateBerlin(p.course_starts_on) : 'offen'})
    </Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
      <Container style={{ padding: '24px', maxWidth: '600px' }}>
        <Heading style={{ color: '#0c4a6e', fontSize: '20px' }}>Bitte Geldeingang prüfen</Heading>
        <Text>
          Die verbindliche Buchung liegt 14 Tage zurück und ist im Adminbereich noch nicht als bezahlt markiert.
          Bitte prüfen Sie den Geldeingang auf dem Vereinskonto.
        </Text>
        <Hr />
        <Section style={{ backgroundColor: '#f0f9ff', padding: '14px 16px', borderRadius: '8px' }}>
          <Line label="Kind:" value={p.child_name || '—'} />
          <Line
            label="Kursbeginn:"
            value={p.course_starts_on ? formatDateBerlin(p.course_starts_on) : '—'}
          />
          <Line label="Kursangebot:" value={p.program_name || '—'} />
          <Line label="Kurszeitraum:" value={p.course_name || '—'} />
          <Line label="Gebucht am:" value={p.booked_at ? formatDateBerlin(p.booked_at) : '—'} />
          <Line label="Betrag:" value={formatEuro(p.price_amount ?? null)} />
          <Line label="Dokument-Nr.:" value={p.document_no || '—'} />
          <Line label="Verwendungszweck:" value={p.payment_reference || '—'} />
        </Section>
        <Hr />
        <Section>
          <Line label="Eltern:" value={p.parent_name || '—'} />
          <Line label="E-Mail:" value={p.parent_email || '—'} />
        </Section>
        <Text style={{ fontSize: '12px', color: '#64748b' }}>
          Nach Zahlungseingang bitte im Adminbereich unter „Kurse" → Teilnehmer auf „bezahlt" setzen.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Geldeingang prüfen – ${d.child_name || 'Teilnehmer/in'}${
      d.course_starts_on ? ` (Kursbeginn ${formatDateBerlin(d.course_starts_on)})` : ''
    }`,
  displayName: 'Zahlungsprüfung 14 Tage nach Buchung (Admin)',
  to: 'info@sicher-schwimmen.com',
  previewData: {
    child_name: 'Max Beispiel',
    parent_name: 'Erika Beispiel',
    parent_email: 'erika@example.com',
    program_name: 'Seepferdchen im Kurhaus',
    course_name: 'Seepferdchen Kurhaus Oktober 2026',
    course_starts_on: '2026-10-11',
    booked_at: '2026-08-04',
    price_amount: 200,
    document_no: 'SK-2026-00123',
    payment_reference: 'SK-2026-00123 / Max Beispiel',
  },
} satisfies TemplateEntry
