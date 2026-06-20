import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  reference_number?: string
  parent_first_name?: string
  parent_last_name?: string
  child_name?: string
  course_name?: string
}

const Email = (p: Props) => (
  <Html lang="de">
    <Head />
    <Preview>Eingangsbestätigung Ihres Widerrufs ({p.reference_number || ''})</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
      <Container style={{ padding: '24px', maxWidth: '600px' }}>
        <Heading style={{ color: '#0c4a6e' }}>Eingangsbestätigung Ihres Widerrufs</Heading>
        <Text>
          Guten Tag {p.parent_first_name || ''} {p.parent_last_name || ''},
        </Text>
        <Text>
          vielen Dank. Wir bestätigen den Eingang Ihres Widerrufs des
          Schwimmkursvertrages{p.course_name ? ` „${p.course_name}"` : ''}
          {p.child_name ? ` für ${p.child_name}` : ''}.
        </Text>
        <Hr />
        <Section>
          <Text><strong>Referenznummer:</strong> {p.reference_number || '—'}</Text>
        </Section>
        <Hr />
        <Text>
          Wir werden Ihren Vorgang zeitnah bearbeiten und melden uns bei
          Rückfragen unter der von Ihnen angegebenen E-Mail-Adresse.
        </Text>
        <Text>
          Bitte bewahren Sie die Referenznummer für eventuelle Rückfragen auf.
        </Text>
        <Text style={{ marginTop: '24px' }}>
          Mit freundlichen Grüßen<br />
          Sicher Schwimmen e.V.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Eingangsbestätigung Ihres Widerrufs',
  displayName: 'Widerruf – Eingangsbestätigung an Eltern',
  previewData: {
    reference_number: 'SW-WID-20260620-12345',
    parent_first_name: 'Erika',
    parent_last_name: 'Beispiel',
    child_name: 'Mia',
    course_name: 'Seepferdchen Frühjahr',
  },
} satisfies TemplateEntry
