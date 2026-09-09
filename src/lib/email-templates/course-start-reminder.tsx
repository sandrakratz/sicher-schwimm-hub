import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { formatDateBerlin } from '@/lib/format'

interface Props {
  parent_name?: string
  child_name?: string
  course_name?: string
  program_name?: string
  course_location?: string | null
  course_schedule?: string | null
  first_session_date?: string | null
  first_session_time?: string | null
  course_info?: string | null
}

const Email = (p: Props) => {
  const title = p.program_name || p.course_name || 'Schwimmkurs'
  return (
    <Html lang="de">
      <Head />
      <Preview>Bald geht&apos;s los: {title}</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
        <Container style={{ padding: '24px', maxWidth: '600px' }}>
          <Heading style={{ color: '#0c4a6e' }}>Bald geht&apos;s los!</Heading>
          <Text>{p.parent_name ? `Hallo ${p.parent_name},` : 'Hallo,'}</Text>
          <Text>
            in wenigen Tagen startet der Kurs{p.child_name ? <> für <strong>{p.child_name}</strong></> : null}. Hier
            noch einmal die wichtigsten Informationen für den Kurstag.
          </Text>

          <Section style={{ backgroundColor: '#f0f9ff', padding: '16px', borderRadius: '8px' }}>
            <Heading as="h2" style={{ color: '#0c4a6e', fontSize: '18px', margin: '0 0 8px 0' }}>{title}</Heading>
            {p.first_session_date && (
              <Text style={{ margin: '4px 0' }}>
                <strong>Erster Termin:</strong> {formatDateBerlin(p.first_session_date)}
                {p.first_session_time ? `, ${p.first_session_time} Uhr` : ''}
              </Text>
            )}
            {p.course_schedule && (
              <Text style={{ margin: '4px 0' }}><strong>Zeiten:</strong> {p.course_schedule}</Text>
            )}
            {p.course_location && (
              <Text style={{ margin: '4px 0' }}><strong>Ort:</strong> {p.course_location}</Text>
            )}
          </Section>

          {p.course_info && (
            <>
              <Hr />
              <Text style={{ marginTop: '16px' }}><strong>Ablauf &amp; Wichtiges für den Kurstag</strong></Text>
              <Text style={{ whiteSpace: 'pre-line' }}>{p.course_info}</Text>
            </>
          )}

          <Hr />
          <Text>Bei Fragen antworten Sie einfach auf diese E-Mail.</Text>
          <Text>Wir freuen uns auf Sie!<br />Ihr Team von Sicher Schwimmen e.V.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Bald geht's los: ${d.program_name || d.course_name || 'Schwimmkurs'}`,
  displayName: 'Erinnerung vor Kursstart',
  previewData: {
    parent_name: 'Erika Beispiel',
    child_name: 'Max Beispiel',
    program_name: 'Seepferdchen im Kurhaus',
    course_name: 'Seepferdchenkurs im Kurhaus',
    course_location: 'Kurhaus Hennef',
    first_session_date: '2026-09-06',
    first_session_time: '12:00–14:00',
    course_info: 'Bitte 15 Minuten vorher da sein.\nTreffpunkt: Eingang Schwimmbad.\nMitbringen: Badesachen, Handtuch, Badekappe.',
  },
} satisfies TemplateEntry
