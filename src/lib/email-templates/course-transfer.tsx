import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { BILLING, ORG } from '@/lib/billing-config'

interface Props {
  child_name?: string | null
  old_course?: string | null
  new_course?: string | null
  new_schedule?: string | null
  new_location?: string | null
  new_start?: string | null
  sessions?: string[] | null
  reason?: string | null
  amount_due?: string | null
  refund?: string | null
  due_date?: string | null
  reference?: string | null
}

const row = { margin: '3px 0' } as const

const Transfer = (p: Props) => (
  <Html lang="de">
    <Head />
    <Preview>{`Umbuchung in den Kurs ${p.new_course ?? ''}`}</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
      <Container style={{ padding: '24px', maxWidth: '600px' }}>
        <Text style={{ ...row, fontWeight: 'bold', fontSize: '16px' }}>{ORG.name}</Text>
        <Heading style={{ color: '#0c4a6e', fontSize: '20px', marginTop: '18px' }}>Kurswechsel bestätigt</Heading>
        <Text>Liebe Eltern,</Text>
        <Text>
          {p.child_name ?? 'Ihr Kind'} wechselt vom Kurs <strong>„{p.old_course}“</strong> in den Kurs{' '}
          <strong>„{p.new_course}“</strong>.
        </Text>
        {p.reason ? <Text style={{ whiteSpace: 'pre-wrap' }}>Grund: {p.reason}</Text> : null}
        <Text style={row}>{p.new_schedule ? `Zeit: ${p.new_schedule}` : null}</Text>
        <Text style={row}>{p.new_location ? `Ort: ${p.new_location}` : null}</Text>
        {p.sessions && p.sessions.length > 0 ? (
          <>
            <Text style={{ ...row, marginTop: '12px', fontWeight: 'bold' }}>Ihre nächsten Termine:</Text>
            {p.sessions.map((s, i) => <Text key={i} style={row}>{s}</Text>)}
          </>
        ) : null}
        <Hr />
        {p.amount_due ? (
          <>
            <Text>
              Die bereits bezahlten, noch nicht genutzten Stunden haben wir angerechnet. Es bleibt ein
              Restbetrag von <strong>{p.amount_due}</strong>
              {p.due_date ? <> – bitte bis <strong>{p.due_date}</strong> überweisen</> : null}.
            </Text>
            <Text style={row}>Empfänger: {BILLING.recipient}</Text>
            <Text style={row}>IBAN: {BILLING.iban}</Text>
            {p.reference ? <Text style={row}>Verwendungszweck: {p.reference}</Text> : null}
          </>
        ) : p.refund ? (
          <Text>
            Aus dem bisherigen Kurs bleibt ein Guthaben von <strong>{p.refund}</strong>. Wir melden uns wegen der
            Erstattung bzw. Verrechnung.
          </Text>
        ) : (
          <Text>Die Kursgebühr ist vollständig beglichen – Sie müssen nichts weiter tun.</Text>
        )}
        <Hr />
        <Text style={{ fontSize: '13px', color: '#475569' }}>
          Fragen? <Link href={`mailto:${ORG.email}`}>{ORG.email}</Link> oder {ORG.phone}
        </Text>
        <Text style={{ marginTop: '16px' }}>Herzliche Grüße</Text>
        <Text style={row}>{ORG.signatory}</Text>
      </Container>
    </Body>
  </Html>
)

export const template: TemplateEntry = {
  component: Transfer,
  displayName: 'Kurswechsel / Umbuchung',
  subject: (d) => `Kurswechsel: ${d.child_name ?? ''} – ${d.new_course ?? 'neuer Kurs'}`,
  previewData: {
    child_name: 'Mia', old_course: 'Seepferdchen Kurhaus', new_course: 'Aufbaukurs Sportschule',
    new_schedule: 'Sa 12:00–12:45', reason: 'Trainer-Empfehlung', amount_due: '70,00 €', due_date: '10.11.2026',
  },
}
