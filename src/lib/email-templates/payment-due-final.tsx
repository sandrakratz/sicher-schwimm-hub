import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Img, Link, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { buildConfirmationDoc } from '@/lib/course-confirmation'
import { ORG } from '@/lib/billing-config'
import { formatDateBerlin } from '@/lib/format'

interface Props {
  document_no?: string | null
  issued_at?: string | null
  payer_name?: string | null
  child_name?: string | null
  course_name?: string | null
  program_name?: string | null
  starts_on?: string | null
  ends_on?: string | null
  schedule?: string | null
  location?: string | null
  unit_count?: number | null
  price_amount?: number | null
  payment_due_days?: number | null
  payment_due_date?: string | null
}

const row = { margin: '3px 0' } as const
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
  const d = buildConfirmationDoc({
    documentNo: p.document_no ?? null,
    issuedAt: p.issued_at ?? null,
    payerName: p.payer_name ?? null,
    childName: p.child_name ?? null,
    courseName: p.course_name ?? null,
    programName: p.program_name ?? null,
    startsOn: p.starts_on ?? null,
    endsOn: p.ends_on ?? null,
    schedule: p.schedule ?? null,
    location: p.location ?? null,
    unitCount: p.unit_count ?? null,
    priceAmount: p.price_amount ?? null,
    paymentDueDays: p.payment_due_days ?? null,
  })
  const dueLabel = p.payment_due_date ? formatDateBerlin(p.payment_due_date) : d.dueDateLabel

  return (
    <Html lang="de">
      <Head />
      <Preview>
        Letzte Erinnerung: Kursgebühr für {d.childName} – Frist endet morgen ({dueLabel})
      </Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
        <Container style={{ padding: '24px', maxWidth: '600px' }}>
          <Text style={{ ...row, fontWeight: 'bold', fontSize: '16px' }}>{d.org.name}</Text>
          <Text style={{ ...row, fontSize: '12px', color: '#475569' }}>{d.org.street}</Text>
          <Text style={{ ...row, fontSize: '12px', color: '#475569' }}>{d.org.zipCity}</Text>

          <Heading style={{ color: '#b91c1c', fontSize: '20px', marginTop: '18px' }}>
            Letzte Erinnerung – Zahlungsfrist endet morgen
          </Heading>

          <Text>Liebe Eltern,</Text>
          <Text>
            für den Kursplatz von <strong>{d.childName}</strong> konnten wir bis heute keinen Zahlungseingang
            feststellen. Die Zahlungsfrist endet am <strong>{dueLabel}</strong>.
          </Text>

          <Section
            style={{
              backgroundColor: '#fef2f2',
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid #fecaca',
              marginTop: '12px',
            }}
          >
            <Text style={{ margin: 0 }}>
              Geht die Kursgebühr <strong>nicht bis zum Ende der Frist</strong> bei uns ein, geben wir den Kursplatz
              ohne weitere Ankündigung frei und vergeben ihn an ein Kind von der Warteliste. Zusätzlich können wir
              Familien, die weder zahlen noch sich zurückmelden, <strong>für weitere Kursbuchungen sperren</strong>.
            </Text>
          </Section>

          <Hr />
          <Line label="Kurs:" value={d.courseTitle} />
          <Line label="Kurszeitraum:" value={d.periodLabel} />
          <Line label="Kursort:" value={d.locationLabel} />
          <Line label="Dokument-Nr.:" value={d.documentNo} />
          <Line label="Zahlungsfrist:" value={<strong>{dueLabel}</strong>} />
          <Text style={{ marginTop: '10px', fontSize: '16px' }}>
            <strong style={labelStyle}>Offener Betrag:</strong>
            <strong style={{ color: '#b91c1c' }}>{d.priceLabel}</strong>
          </Text>

          <Section
            style={{
              backgroundColor: '#f8fafc',
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              marginTop: '14px',
            }}
          >
            <Line label="Kontoinhaber:" value={d.bank.recipient} />
            <Line label="IBAN:" value={d.bank.iban} />
            <Line label="BIC:" value={d.bank.bic} />
            <Line label="Verwendungszweck:" value={d.paymentReference} />
            <Line label="Zahlungsart:" value={<strong>Echtzeit-/Sofortüberweisung</strong>} />
          </Section>

          {d.payQrUrl && (
            <Section
              style={{
                backgroundColor: '#fff7ed',
                padding: '14px 16px',
                borderRadius: '8px',
                border: '1px solid #fed7aa',
                marginTop: '14px',
                textAlign: 'center' as const,
              }}
            >
              <Img
                src={d.payQrUrl}
                alt="QR-Code für die Überweisung"
                width="180"
                height="180"
                style={{ margin: '0 auto', display: 'block' }}
              />
              <Text style={{ margin: '8px 0 0', fontSize: '12px', color: '#7c2d12' }}>
                Einfach mit Ihrer Banking-App scannen – Empfänger, IBAN, Betrag und Verwendungszweck werden
                automatisch übernommen.
              </Text>
            </Section>
          )}

          <Text style={{ marginTop: '16px' }}>
            Haben Sie bereits überwiesen oder ist etwas dazwischengekommen? Dann melden Sie sich bitte{' '}
            <strong>heute noch</strong> kurz bei uns unter <Link href={`mailto:${ORG.email}`}>{ORG.email}</Link> oder{' '}
            <strong>{ORG.phone}</strong> – dann halten wir den Platz frei.
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
  displayName: 'Letzte Zahlungserinnerung 1 Tag vor Fristende (Eltern)',
  subject: (d: Record<string, any>) =>
    `Letzte Erinnerung: Kursgebühr${d?.child_name ? ` für ${d.child_name}` : ''} – Frist endet morgen`,
  previewData: {
    document_no: 'SK-2026-00001',
    child_name: 'Mia Muster',
    payer_name: 'Sabine Muster',
    course_name: 'Seepferdchen Kurhaus',
    program_name: 'Seepferdchen',
    starts_on: '2026-10-06',
    ends_on: '2026-12-15',
    price_amount: 200,
    payment_due_days: 14,
    payment_due_date: '2026-09-20',
  },
}

export default template
