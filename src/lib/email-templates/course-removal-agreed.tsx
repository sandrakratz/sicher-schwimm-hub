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
    <Preview>Abmeldung vom Kurs bestätigt</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
      <Container style={{ padding: '24px', maxWidth: '600px' }}>
        <Text style={{ ...row, fontWeight: 'bold', fontSize: '16px' }}>{ORG.name}</Text>
        <Heading style={{ color: '#0c4a6e', fontSize: '20px', marginTop: '18px' }}>
          Abmeldung bestätigt
        </Heading>

        <Text>{p.parent_name ? `Liebe Familie ${p.parent_name},` : 'Liebe Eltern,'}</Text>
        <Text>
          wie besprochen haben wir die Teilnahme von <strong>{p.child_name ?? 'Ihrem Kind'}</strong>
          {p.course_name ? ` am Kurs „${p.course_name}“` : ' am Kurs'} storniert.
        </Text>
        {p.note ? <Text style={{ whiteSpace: 'pre-wrap' }}>{p.note}</Text> : null}

        <Hr />
        <Text>
          Für einen späteren Kurs können Sie sich jederzeit wieder bei uns melden oder sich auf die Warteliste
          eintragen. Wir freuen uns, wenn wir Ihr Kind bald wieder im Wasser begrüßen dürfen.
        </Text>
        <Text style={{ fontSize: '13px', color: '#475569' }}>
          Kontakt: <Link href={`mailto:${ORG.email}`}>{ORG.email}</Link> oder {ORG.phone}
        </Text>

        <Text style={{ marginTop: '16px' }}>Herzliche Grüße</Text>
        <Text style={row}>{ORG.signatory}</Text>
        <Text style={{ ...row, fontSize: '12px', color: '#475569' }}>{ORG.name}</Text>
      </Container>
    </Body>
  </Html>
)

export const template: TemplateEntry = {
  component: Email,
  displayName: 'Kursabmeldung wie besprochen',
  subject: 'Abmeldung vom Schwimmkurs',
  previewData: {
    parent_name: 'Muster',
    child_name: 'Mia Muster',
    course_name: 'Seepferdchen Oktober',
  },
}

export default template
