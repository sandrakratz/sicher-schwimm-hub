import * as React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { ORG } from '@/lib/billing-config'

interface Props {
  child_name?: string | null
  old_course?: string | null
  new_course?: string | null
  new_schedule?: string | null
  amount_due?: string | null
  refund?: string | null
  due_date?: string | null
  consent_url?: string | null
}

const row = { margin: '3px 0' } as const

const Reminder = (p: Props) => (
  <Html lang="de">
    <Head />
    <Preview>{`Erinnerung: Bitte bestätigen Sie die Umbuchung in den Kurs ${p.new_course ?? ''}`}</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
      <Container style={{ padding: '24px', maxWidth: '600px' }}>
        <Text style={{ ...row, fontWeight: 'bold', fontSize: '16px' }}>{ORG.name}</Text>
        <Heading style={{ color: '#0c4a6e', fontSize: '20px', marginTop: '18px' }}>
          Erinnerung: Zustimmung zur Kursumbuchung
        </Heading>
        <Text>Liebe Eltern,</Text>
        <Text>
          vor einigen Tagen haben wir Ihnen die Umbuchung von {p.child_name ?? 'Ihrem Kind'} vom Kurs{' '}
          <strong>„{p.old_course}“</strong> in den Kurs <strong>„{p.new_course}“</strong> mitgeteilt. Uns fehlt noch
          Ihre Zustimmung.
        </Text>
        {p.new_schedule ? <Text style={row}>Zeit: {p.new_schedule}</Text> : null}
        {p.amount_due ? (
          <Text style={row}>
            Restbetrag: <strong>{p.amount_due}</strong>{p.due_date ? <> (bis {p.due_date})</> : null}
          </Text>
        ) : p.refund ? (
          <Text style={row}>Guthaben: <strong>{p.refund}</strong></Text>
        ) : null}
        {p.consent_url ? (
          <Section style={{ backgroundColor: '#f0f9ff', padding: '16px', borderRadius: '8px', border: '1px solid #bae6fd', textAlign: 'center' as const, marginTop: '16px' }}>
            <Button
              href={p.consent_url}
              style={{ backgroundColor: '#0c4a6e', color: '#ffffff', padding: '12px 22px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold' }}
            >
              Umbuchung ansehen und zustimmen
            </Button>
            <Text style={{ margin: '12px 0 0', fontSize: '12px', color: '#475569' }}>
              Falls der Button nicht funktioniert: <Link href={p.consent_url}>{p.consent_url}</Link>
            </Text>
          </Section>
        ) : null}
        <Hr />
        <Text style={{ fontSize: '13px', color: '#475569' }}>
          Sind Sie mit der Umbuchung nicht einverstanden oder haben Fragen? Antworten Sie einfach auf diese E-Mail
          oder schreiben Sie an <Link href={`mailto:${ORG.email}`}>{ORG.email}</Link> bzw. rufen Sie uns an: {ORG.phone}.
        </Text>
        <Text style={{ marginTop: '16px' }}>Herzliche Grüße</Text>
        <Text style={row}>{ORG.signatory}</Text>
      </Container>
    </Body>
  </Html>
)

export const template: TemplateEntry = {
  component: Reminder,
  displayName: 'Erinnerung: Zustimmung zur Kursumbuchung (Eltern)',
  subject: (d) => `Erinnerung: Zustimmung zur Kursumbuchung – ${d.child_name ?? ''}`,
  previewData: {
    child_name: 'Mia', old_course: 'Seepferdchen Kurhaus', new_course: 'Aufbaukurs Sportschule',
    new_schedule: 'Sa 12:00–12:45', amount_due: '70,00 €', due_date: '10.11.2026',
    consent_url: 'https://sicher-schwimmen.com/umbuchung?token=0123456789abcdef0123456789abcdef0123456789abcdef',
  },
}
