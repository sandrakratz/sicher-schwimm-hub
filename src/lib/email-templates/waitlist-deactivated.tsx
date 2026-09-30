import * as React from 'react'
import { Body, Container, Head, Heading, Html, Link, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { ORG } from '@/lib/billing-config'

interface Props {
  parent_name?: string | null
  child_name?: string | null
  count?: number
}

const row = { margin: '3px 0' } as const

const Email = (p: Props) => (
  <Html lang="de">
    <Head />
    <Preview>Ihr Wartelistenplatz wurde deaktiviert</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
      <Container style={{ padding: '24px', maxWidth: '600px' }}>
        <Text style={{ ...row, fontWeight: 'bold', fontSize: '16px' }}>{ORG.name}</Text>
        <Heading style={{ color: '#0c4a6e', fontSize: '20px', marginTop: '18px' }}>Wartelistenplatz deaktiviert</Heading>
        <Text>{p.parent_name ? `Liebe Familie ${p.parent_name},` : 'Liebe Eltern,'}</Text>
        <Text>
          Sie haben ein Platzangebot für {p.child_name ?? 'Ihr Kind'} nun zum {p.count ?? 3}. Mal abgesagt oder nicht
          beantwortet. Um allen wartenden Familien eine faire Chance auf einen Kursplatz zu geben, wurde Ihr
          Wartelistenplatz deaktiviert.
        </Text>
        <Text>
          Eine erneute Berücksichtigung oder Kursbuchung ist nur nach Rücksprache mit unserem Vorstand möglich. Schreiben
          Sie uns dazu gern an <Link href={`mailto:${ORG.email}`}>{ORG.email}</Link>.
        </Text>
        <Text style={{ marginTop: '16px' }}>Herzliche Grüße</Text>
        <Text style={row}>{ORG.signatory}</Text>
      </Container>
    </Body>
  </Html>
)

export const template: TemplateEntry = {
  component: Email,
  displayName: 'Warteliste – Platz deaktiviert (3 Absagen)',
  subject: 'Ihr Wartelistenplatz wurde deaktiviert',
  previewData: { parent_name: 'Muster', child_name: 'Mia Muster', count: 3 },
}
export default template
