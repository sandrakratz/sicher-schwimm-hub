import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { ORG } from '@/lib/billing-config'

interface Props {
  parent_name?: string | null
  child_name?: string | null
  program_name?: string | null
  course_name?: string | null
  notes?: string | null
}

const row = { margin: '3px 0' } as const

const Email = (p: Props) => (
  <Html lang="de">
    <Head />
    <Preview>Eintrag auf der Warteliste bestätigt</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
      <Container style={{ padding: '24px', maxWidth: '600px' }}>
        <Text style={{ ...row, fontWeight: 'bold', fontSize: '16px' }}>{ORG.name}</Text>
        <Heading style={{ color: '#0c4a6e', fontSize: '20px', marginTop: '18px' }}>
          Sie stehen auf der Warteliste
        </Heading>

        <Text>{p.parent_name ? `Liebe Familie ${p.parent_name},` : 'Liebe Eltern,'}</Text>
        <Text>
          wir haben <strong>{p.child_name ?? 'Ihr Kind'}</strong> auf die Warteliste für{' '}
          <strong>{p.course_name || p.program_name || 'unsere Schwimmkurse'}</strong> aufgenommen.
        </Text>

        <Hr />
        <Text>
          Sobald ein Platz frei wird, erhalten Sie automatisch ein Platzangebot per E-Mail mit einem Link zur Zusage.
          Aktive Vereinsmitglieder werden dabei bevorzugt, ansonsten gilt die Reihenfolge des Eingangs.
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

export const template: TemplateEntry = {
  component: Email,
  displayName: 'Warteliste – Eingangsbestätigung',
  subject: 'Ihr Eintrag auf der Warteliste',
  previewData: {
    parent_name: 'Muster',
    child_name: 'Mia Muster',
    program_name: 'Seepferdchen',
  },
}

export default template
