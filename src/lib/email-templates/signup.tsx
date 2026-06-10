import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Bitte bestätige deine E-Mail-Adresse für {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>E-Mail-Adresse bestätigen</Heading>
        <Text style={text}>
          Vielen Dank für deine Registrierung bei{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          .
        </Text>
        <Text style={text}>
          Bitte bestätige zunächst deine E-Mail-Adresse (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) über den folgenden Button:
        </Text>
        <Button style={button} href={confirmationUrl}>
          E-Mail-Adresse bestätigen
        </Button>

        <Hr style={hr} />

        <Section style={noticeBox}>
          <Text style={noticeTitle}>Wichtiger Hinweis</Text>
          <Text style={noticeText}>
            Nach der Bestätigung deiner E-Mail-Adresse ist dein Konto noch{' '}
            <strong>nicht sofort nutzbar</strong>. Dein Zugang muss zuerst durch
            den <strong>Vorstand</strong> freigeschaltet werden. Du erhältst
            Zugriff auf den internen Bereich, sobald die Freigabe erfolgt ist.
          </Text>
        </Section>

        <Text style={footer}>
          Falls du dich nicht registriert hast, kannst du diese E-Mail ignorieren.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '560px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#0b3d66',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#33373d',
  lineHeight: '1.6',
  margin: '0 0 18px',
}
const link = { color: '#0b6cb7', textDecoration: 'underline' }
const button = {
  backgroundColor: '#0b6cb7',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '8px',
  padding: '12px 22px',
  textDecoration: 'none',
}
const hr = {
  borderColor: '#e6e8eb',
  margin: '28px 0',
}
const noticeBox = {
  backgroundColor: '#fff8e6',
  border: '1px solid #f5d893',
  borderRadius: '8px',
  padding: '14px 18px',
  margin: '0 0 20px',
}
const noticeTitle = {
  fontSize: '14px',
  fontWeight: 'bold' as const,
  color: '#7a5300',
  margin: '0 0 6px',
}
const noticeText = {
  fontSize: '13px',
  color: '#5b4200',
  lineHeight: '1.6',
  margin: 0,
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
