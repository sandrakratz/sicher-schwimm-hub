import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { buildConfirmationDoc } from '@/lib/course-confirmation'

interface Props {
  parent_name?: string
  child_name?: string
  course_name?: string
  program_name?: string
  course_location?: string
  course_schedule?: string
  course_starts_on?: string
  course_ends_on?: string
  course_description?: string
  unit_count?: number | null
  waitlist?: boolean
  is_member?: boolean | null
  price_amount?: number | null
  payment_due_days?: number | null
  document_no?: string
  issued_at?: string
  payer_street?: string
  payer_zip?: string
  payer_city?: string
  site_base_url?: string
}

const row = { margin: '3px 0' as const }
const labelStyle = { display: 'inline-block', minWidth: '170px' } as const

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Text style={row}>
      <strong style={labelStyle}>{label}</strong>
      {value}
    </Text>
  )
}

const Email = (p: Props) => {
  const base = p.site_base_url || 'https://sicher-schwimmen.com'
  const waitlist = Boolean(p.waitlist)

  const d = buildConfirmationDoc({
    documentNo: p.document_no,
    issuedAt: p.issued_at,
    payerName: p.parent_name,
    payerStreet: p.payer_street,
    payerZip: p.payer_zip,
    payerCity: p.payer_city,
    childName: p.child_name,
    courseName: p.course_name,
    programName: p.program_name,
    startsOn: p.course_starts_on,
    endsOn: p.course_ends_on,
    schedule: p.course_schedule,
    location: p.course_location,
    unitCount: p.unit_count ?? null,
    priceAmount: p.price_amount ?? null,
    paymentDueDays: p.payment_due_days ?? null,
  })

  if (waitlist) {
    return (
      <Html lang="de">
        <Head />
        <Preview>Wartelisten-Bestätigung: {d.courseTitle}</Preview>
        <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
          <Container style={{ padding: '24px', maxWidth: '640px' }}>
            <Heading style={{ color: '#0c4a6e' }}>Ihre Anmeldung auf der Warteliste</Heading>
            <Text>Hallo {p.parent_name || ''},</Text>
            <Text>
              vielen Dank für Ihre Anmeldung. Der gewünschte Kurszeitraum ist aktuell ausgebucht – wir haben{' '}
              {p.child_name ? <strong>{p.child_name}</strong> : 'die Anmeldung'} auf die Warteliste gesetzt und melden
              uns, sobald ein Platz frei wird. Eine Zahlung ist zum jetzigen Zeitpunkt nicht erforderlich.
            </Text>
            <Section style={{ backgroundColor: '#f0f9ff', padding: '16px', borderRadius: '8px' }}>
              <Line label="Kurs:" value={d.courseTitle} />
              <Line label="Kurszeitraum:" value={d.periodLabel} />
              <Line label="Kurstage:" value={d.scheduleLabel} />
              <Line label="Kursort:" value={d.locationLabel} />
            </Section>
            <Hr />
            <Text>Bei Fragen antworten Sie einfach auf diese E-Mail.</Text>
            <Text>Mit besten Grüßen,<br />Ihr Team von Sicher-Schwimmen</Text>
          </Container>
        </Body>
      </Html>
    )
  }

  return (
    <Html lang="de">
      <Head />
      <Preview>Kursbestätigung und Zahlungsaufforderung – {d.documentNo}</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
        <Container style={{ padding: '24px', maxWidth: '640px' }}>
          <Section style={{ paddingBottom: '8px', borderBottom: '1px solid #e2e8f0' }}>
            <Text style={{ ...row, fontWeight: 'bold', fontSize: '16px' }}>{d.org.name}</Text>
            <Text style={{ ...row, fontSize: '12px', color: '#475569' }}>{d.org.street}</Text>
            <Text style={{ ...row, fontSize: '12px', color: '#475569' }}>{d.org.zipCity}</Text>
            <Text style={{ ...row, fontSize: '12px', color: '#475569' }}>{d.org.register}</Text>
          </Section>

          <Heading style={{ color: '#0c4a6e', fontSize: '20px', marginTop: '20px' }}>
            Kursbestätigung und Zahlungsaufforderung
          </Heading>
          <Line label="Dokument-Nr.:" value={d.documentNo} />
          <Line label="Ausstellungsdatum:" value={d.issuedAtLabel} />

          <Text style={{ marginTop: '18px', marginBottom: '2px' }}><strong>Zahlungspflichtige/r:</strong></Text>
          <Text style={row}>{d.payerName}</Text>
          {d.payerLines.map((l) => (
            <Text key={l} style={row}>{l}</Text>
          ))}

          <Text style={{ marginTop: '12px' }}>
            <strong style={labelStyle}>Teilnehmer/in:</strong>
            {d.childName}
          </Text>

          <Hr />
          <Heading as="h2" style={{ color: '#0c4a6e', fontSize: '17px', margin: '8px 0' }}>
            Gebuchter Schwimmkurs
          </Heading>
          <Line label="Kurs:" value={d.courseTitle} />
          <Line label="Kurszeitraum:" value={d.periodLabel} />
          <Line label="Kurstage:" value={d.scheduleLabel} />
          <Line label="Kursort:" value={d.locationLabel} />
          <Line label="Anzahl der Einheiten:" value={d.unitLabel} />

          <Text style={{ marginTop: '12px', fontSize: '16px' }}>
            <strong style={labelStyle}>Kursgebühr:</strong>
            <strong style={{ color: '#0c4a6e' }}>{d.priceLabel}</strong>
          </Text>

          <Text style={{ marginTop: '16px' }}>
            Bitte überweisen Sie die Kursgebühr bis zum <strong>{d.dueDateLabel}</strong> unter Angabe der
            Dokument-Nr. {d.documentNo} auf folgendes Vereinskonto:
          </Text>
          <Section style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <Line label="Kontoinhaber:" value={d.bank.recipient} />
            <Line label="IBAN:" value={d.bank.iban} />
            <Line label="BIC:" value={d.bank.bic} />
            <Line label="Verwendungszweck:" value={d.paymentReference} />
          </Section>

          <Text style={{ marginTop: '16px' }}><strong>Hinweis zur Umsatzsteuer:</strong></Text>
          <Text style={row}>{d.org.vatNote}</Text>

          {p.course_description && (
            <>
              <Hr />
              <Text>{p.course_description}</Text>
            </>
          )}

          <Text style={{ marginTop: '16px' }}>
            Vielen Dank für Ihre Anmeldung. Wir freuen uns auf die Teilnahme am Schwimmkurs.
          </Text>

          <Text style={{ marginTop: '18px' }}>{d.org.city}, {d.issuedAtLabel}</Text>
          <Text style={row}>{d.org.signatory}</Text>
          <Text style={{ ...row, fontSize: '12px', color: '#475569' }}>{d.org.email} · {d.org.phone}</Text>

          <Hr />
          <Text style={{ ...row, fontSize: '12px', color: '#475569' }}>
            Es gelten unsere <Link href={`${base}/kursbedingungen`} style={{ color: '#0c4a6e' }}>Kursteilnahmebedingungen</Link>{' '}
            sowie unsere <Link href={`${base}/datenschutz`} style={{ color: '#0c4a6e' }}>Datenschutzerklärung</Link>.
            Widerrufsrecht: Sie können den Vertrag innerhalb von 14 Tagen ohne Angabe von Gründen widerrufen.{' '}
            <Link href={`${base}/widerruf`} style={{ color: '#0c4a6e' }}>Zum Widerrufsformular</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const previewData = {
  parent_name: 'Erika Beispiel',
  payer_street: 'Musterweg 5',
  payer_zip: '53773',
  payer_city: 'Hennef',
  child_name: 'Max Beispiel',
  program_name: 'Seepferdchen im Kurhaus',
  course_name: 'Seepferdchen Kurhaus Oktober 2026',
  course_starts_on: '2026-10-11',
  course_ends_on: '2026-11-08',
  course_schedule: 'montags, 16:00–17:00 Uhr',
  course_location: 'Kurshausstr. 27, 53773 Hennef',
  unit_count: 12,
  is_member: false,
  price_amount: 200,
  payment_due_days: 14,
  document_no: 'SK-2026-00123',
  issued_at: '2026-08-09',
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Kursbestätigung ${d.document_no ? `${d.document_no} ` : ''}– ${d.program_name || d.course_name || 'Schwimmkurs'}`,
  displayName: 'Kursbuchung – Bestätigung & Zahlungsaufforderung',
  previewData,
} satisfies TemplateEntry

export const waitlistTemplate = {
  component: Email,
  subject: (d: Record<string, any>) => `Warteliste: ${d.program_name || d.course_name || 'Schwimmkurs'}`,
  displayName: 'Kursbuchung – Wartelisten-Bestätigung',
  previewData: { ...previewData, waitlist: true },
} satisfies TemplateEntry
