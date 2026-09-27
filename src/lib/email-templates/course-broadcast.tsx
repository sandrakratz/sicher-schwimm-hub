import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { ORG } from '@/lib/billing-config'

interface Props { subject?: string; message?: string; course_name?: string | null; child_name?: string | null }

const Email = (p: Props) => (
  <Html lang="de">
    <Head />
    <Preview>{p.subject ?? 'Wichtige Information zu Ihrem Schwimmkurs'}</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
      <Container style={{ padding: '24px', maxWidth: '600px' }}>
        <Text style={{ margin: '3px 0', fontWeight: 'bold', fontSize: '16px' }}>{ORG.name}</Text>
        <Heading style={{ color: '#b91c1c', fontSize: '20px', marginTop: '18px' }}>{p.subject ?? 'Wichtige Information'}</Heading>
        <Text style={{ color: '#475569', fontSize: '13px' }}>
          Kurs: {p.course_name ?? 'Schwimmkurs'}{p.child_name ? ` · ${p.child_name}` : ''}
        </Text>
        <Text>Liebe Eltern,</Text>
        <Text style={{ whiteSpace: 'pre-wrap' }}>{p.message ?? ''}</Text>
        <Hr />
        <Text style={{ fontSize: '13px', color: '#475569' }}>
          Fragen? <Link href={`mailto:${ORG.email}`}>{ORG.email}</Link> oder {ORG.phone}
        </Text>
        <Text style={{ marginTop: '16px' }}>Herzliche Grüße</Text>
        <Text style={{ margin: '3px 0' }}>{ORG.signatory}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  displayName: 'Eilnachricht an Kurs',
  subject: (d: Record<string, any>) => d.subject || 'Wichtige Information zu Ihrem Schwimmkurs',
  previewData: { subject: 'Kurstermin heute fällt aus', message: 'Leider fällt der heutige Termin aus. Ein Ersatztermin folgt.', course_name: 'Seepferdchen', child_name: 'Mia' },
} satisfies TemplateEntry
