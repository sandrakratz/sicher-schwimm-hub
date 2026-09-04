import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { ORG } from '@/lib/billing-config'

interface Props {
  parent_name?: string | null
  child_name?: string | null
  course_name?: string | null
  note?: string | null
}

const row = { margin: '3px 0' } as const

const Email = (p: Props) => (
  <Html lang="de">
    <Head />
    <Preview>Kursplatz wurde wieder freigegeben</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
      <Container style={{ padding: '24px', maxWidth: '600px' }}>
        <Text style={{ ...row, fontWeight: 'bold', fontSize: '16px' }}>{ORG.name}</Text>
        <Heading style={{ color: '#0c4a6e', fontSize: '20px', marginTop: '18px' }}>
          Der Kursplatz wurde wieder freigegeben
        </Heading>

        <Text>{p.parent_name ? `Liebe Familie ${p.parent_name},` : 'Liebe Eltern,'}</Text>
        <Text>
          leider haben wir zu dem Kursplatz von <strong>{p.child_name ?? 'Ihrem Kind'}</strong>
          {p.course_name ? ` für „${p.course_name}“` : ''} keine Rückmeldung bzw. keinen Zahlungseingang erhalten.
          Der Platz wurde daher wieder freigegeben und an eine andere Familie vergeben.
        </Text>

        <Hr />
        <Text>
          Eine Online-Buchung weiterer Kurse ist für Sie künftig nicht mehr möglich. Wenn Sie erneut an einem
          Kurs teilnehmen möchten, wenden Sie sich bitte direkt an den Vorstand.
        </Text>
        {p.note ? <Text style={{ whiteSpace: 'pre-wrap' }}>{p.note}</Text> : null}

        <Text style={{ fontSize: '13px', color: '#475569' }}>
          Kontakt: <Link href={`mailto:${ORG.email}`}>{ORG.email}</Link> oder {ORG.phone}
        </Text>

        <Text style={{ marginTop: '16px' }}>Freundliche Grüße</Text>
        <Text style={row}>{ORG.signatory}</Text>
        <Text style={{ ...row, fontSize: '12px', color: '#475569' }}>{ORG.name}</Text>
      </Container>
    </Body>
  </Html>
)

export const template: TemplateEntry = {
  component: Email,
  displayName: 'Kursplatz freigegeben (keine Rückmeldung/Zahlung)',
  subject: 'Ihr Kursplatz wurde wieder freigegeben',
  previewData: {
    parent_name: 'Muster',
    child_name: 'Mia Muster',
    course_name: 'Seepferdchen Oktober',
  },
}

export default template
