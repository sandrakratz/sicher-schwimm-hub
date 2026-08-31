import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Img, Link, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { buildConfirmationDoc } from '@/lib/course-confirmation'
import { ORG } from '@/lib/billing-config'

interface Props {
  document_no?: string | null
  issued_at?: string | null
  payer_name?: string | null
  payer_street?: string | null
  payer_zip?: string | null
  payer_city?: string | null
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
  /** 'immediate' | 'overdue' – steuert die Anrede/Dringlichkeit. */
  reminder_kind?: string | null
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

function toDoc(p: Props) {
  return buildConfirmationDoc({
    documentNo: p.document_no ?? null,
    issuedAt: p.issued_at ?? null,
    payerName: p.payer_name ?? null,
    payerStreet: p.payer_street ?? null,
    payerZip: p.payer_zip ?? null,
    payerCity: p.payer_city ?? null,
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
}

const Email = (p: Props) => {
  const d = toDoc(p)
  const immediate = p.reminder_kind === 'immediate' || d.immediatePayment
  return (
    <Html lang="de">
      <Head />
      <Preview>Zahlungserinnerung Schwimmkurs – {d.childName}</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
        <Container style={{ padding: '24px', maxWidth: '600px' }}>
          <Text style={{ ...row, fontWeight: 'bold', fontSize: '16px' }}>{d.org.name}</Text>
          <Text style={{ ...row, fontSize: '12px', color: '#475569' }}>{d.org.street}</Text>
          <Text style={{ ...row, fontSize: '12px', color: '#475569' }}>{d.org.zipCity}</Text>

          <Heading style={{ color: '#0c4a6e', fontSize: '20px', marginTop: '18px' }}>
            Zahlungserinnerung zum Schwimmkurs
          </Heading>

          <Text>Liebe Eltern,</Text>
          {immediate ? (
            <Text>
              für den Kursplatz von <strong>{d.childName}</strong> konnten wir bisher keinen Zahlungseingang
              feststellen. Da die Buchung innerhalb der letzten 10 Tage vor Kursbeginn erfolgt ist, ist die Kursgebühr{' '}
              <strong>sofort per Echtzeit-/Sofortüberweisung</strong> zu zahlen.
            </Text>
          ) : (
            <>
              <Text>
                für den Kursplatz von <strong>{d.childName}</strong> konnten wir bisher weder einen Zahlungseingang
                noch eine Rückmeldung von Ihnen feststellen.
              </Text>
              <Text>
                Die Kursgebühr in Höhe von <strong>{d.priceLabel}</strong> war bereits zum{' '}
                <strong>{d.dueDateLabel}</strong> fällig.
              </Text>
              <Text>
                Wir bitten Sie daher, den offenen Betrag{' '}
                <strong>innerhalb von 3 Werktagen nach Erhalt dieser E-Mail</strong> zu überweisen.
              </Text>
            </>
          )}

          <Hr />
          <Line label="Kurs:" value={d.courseTitle} />
          <Line label="Kurszeitraum:" value={d.periodLabel} />
          <Line label="Kursort:" value={d.locationLabel} />
          <Line label="Dokument-Nr.:" value={d.documentNo} />
          <Text style={{ marginTop: '10px', fontSize: '16px' }}>
            <strong style={labelStyle}>Offener Betrag:</strong>
            <strong style={{ color: '#0c4a6e' }}>{d.priceLabel}</strong>
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
            <Line label="Zahlungsart:" value={<strong>{immediate ? 'Echtzeit-/Sofortüberweisung' : 'Überweisung'}</strong>} />
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
              <Text style={{ margin: '0 0 8px', fontWeight: 'bold', color: '#9a3412' }}>
                QR-Code für die Echtzeit-/Sofortüberweisung
              </Text>
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
              <Text style={{ margin: '6px 0 0', fontSize: '12px' }}>
                <Link href={d.payQrUrl}>QR-Code im Browser öffnen</Link>
              </Text>
            </Section>
          )}

          <Text style={{ marginTop: '16px' }}>
            Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie diese E-Mail bitte als gegenstandslos.
            Bei Fragen erreichen Sie uns unter {ORG.email} oder {ORG.phone}.
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
  displayName: 'Zahlungserinnerung (Eltern)',
  subject: (d: Record<string, any>) =>
    `Zahlungserinnerung Schwimmkurs${d?.child_name ? ` – ${d.child_name}` : ''}`,
  previewData: {
    document_no: 'SK-2026-00001',
    child_name: 'Mia Muster',
    payer_name: 'Sabine Muster',
    course_name: 'Seepferdchen Kurhaus',
    program_name: 'Seepferdchen',
    starts_on: '2026-09-06',
    ends_on: '2026-11-15',
    price_amount: 200,
    payment_due_days: 14,
    reminder_kind: 'immediate',
  },
}

export default template
