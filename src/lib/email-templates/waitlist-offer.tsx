import * as React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { ORG } from '@/lib/billing-config'
import { formatDateBerlin } from '@/lib/format'

interface Props {
  parent_name?: string | null
  child_name?: string | null
  program_name?: string | null
  course_name?: string | null
  course_starts_on?: string | null
  course_ends_on?: string | null
  course_schedule?: string | null
  course_location?: string | null
  price_amount?: number | null
  expires_label?: string | null
  accept_url?: string | null
  decline_url?: string | null
}

const row = { margin: '3px 0' } as const
const labelStyle = { display: 'inline-block', minWidth: '150px' } as const

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <Text style={row}>
      <strong style={labelStyle}>{label}</strong>
      {value}
    </Text>
  )
}

const Email = (p: Props) => {
  const period = [p.course_starts_on, p.course_ends_on].filter(Boolean).map((d) => formatDateBerlin(d as string))
  const priceLabel =
    p.price_amount != null
      ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(p.price_amount))
      : null
  return (
    <Html lang="de">
      <Head />
      <Preview>Ein Kursplatz ist frei geworden – {p.child_name ?? 'Ihr Kind'}</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
        <Container style={{ padding: '24px', maxWidth: '600px' }}>
          <Text style={{ ...row, fontWeight: 'bold', fontSize: '16px' }}>{ORG.name}</Text>
          <Heading style={{ color: '#0c4a6e', fontSize: '20px', marginTop: '18px' }}>
            Ein Kursplatz ist frei geworden
          </Heading>

          <Text>{p.parent_name ? `Liebe Familie ${p.parent_name},` : 'Liebe Eltern,'}</Text>
          <Text>
            für <strong>{p.child_name ?? 'Ihr Kind'}</strong> können wir einen Platz im folgenden Kurs anbieten:
          </Text>

          <Hr />
          <Line label="Angebot:" value={p.program_name} />
          <Line label="Kurs:" value={p.course_name} />
          <Line label="Kurszeitraum:" value={period.length ? period.join(' bis ') : null} />
          <Line label="Zeiten:" value={p.course_schedule} />
          <Line label="Kursort:" value={p.course_location} />
          <Line label="Kursgebühr:" value={priceLabel} />
          <Hr />

          <Text>
            Bitte geben Sie uns bis <strong>{p.expires_label}</strong> Bescheid. Danach vergeben wir den Platz an die
            nächste Familie auf der Warteliste.
          </Text>

          <Section style={{ marginTop: '18px' }}>
            {p.accept_url && (
              <Button
                href={p.accept_url}
                style={{
                  backgroundColor: '#0c4a6e',
                  color: '#ffffff',
                  padding: '12px 20px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  textDecoration: 'none',
                }}
              >
                Platz verbindlich annehmen
              </Button>
            )}
            {p.decline_url && (
              <Text style={{ marginTop: '12px', fontSize: '13px' }}>
                Kein Interesse? <Link href={p.decline_url}>Platz absagen</Link>
              </Text>
            )}
          </Section>

          <Text style={{ marginTop: '16px' }}>
            Mit der Zusage wird die Buchung verbindlich; Sie erhalten anschließend die Buchungsbestätigung mit allen
            Zahlungsinformationen.
          </Text>
          <Text style={{ fontSize: '13px', color: '#475569' }}>
            Fragen? <Link href={`mailto:${ORG.email}`}>{ORG.email}</Link> oder {ORG.phone}
          </Text>

          <Text style={{ marginTop: '16px' }}>Herzliche Grüße</Text>
          <Text style={row}>{ORG.signatory}</Text>
          <Text style={{ ...row, fontSize: '12px', color: '#475569' }}>{ORG.name}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template: TemplateEntry = {
  component: Email,
  displayName: 'Warteliste – Platzangebot',
  subject: (d: Record<string, any>) =>
    `Kursplatz frei${d?.child_name ? ` für ${d.child_name}` : ''} – bitte bis ${d?.expires_label ?? 'zur Frist'} antworten`,
  previewData: {
    parent_name: 'Muster',
    child_name: 'Mia Muster',
    program_name: 'Seepferdchen',
    course_name: 'Seepferdchen im Kurhaus',
    course_starts_on: '2026-10-11',
    course_ends_on: '2026-11-08',
    course_location: 'Kurhausstr. 27, 53773 Hennef',
    price_amount: 200,
    expires_label: '05.09.2026',
    accept_url: 'https://sicher-schwimmen.com/warteliste/antwort?token=demo&aktion=zusage',
    decline_url: 'https://sicher-schwimmen.com/warteliste/antwort?token=demo&aktion=absage',
  },
}

export default template
