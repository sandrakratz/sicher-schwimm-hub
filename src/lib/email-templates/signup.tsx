import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
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
          Vielen Dank für deinen Mitgliedsantrag bei{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          !
        </Text>
        <Text style={text}>
          Bitte bestätige deine E-Mail-Adresse (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) mit einem Klick auf den folgenden Button:
        </Text>
        <Button style={button} href={confirmationUrl}>
          E-Mail bestätigen
        </Button>
        <Text style={text}>
          <strong>Wichtig:</strong> Nach der Bestätigung wird dein Konto vom Vereinsvorstand
          geprüft und freigeschaltet. Du erhältst eine separate Benachrichtigung,
          sobald du dich anmelden kannst.
        </Text>
        <Text style={footer}>
          Falls du keinen Mitgliedsantrag gestellt hast, kannst du diese E-Mail ignorieren.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#0c4a6e',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#0f172a',
  lineHeight: '1.5',
  margin: '0 0 20px',
}
const link = { color: '#0c4a6e', textDecoration: 'underline' }
const button = {
  backgroundColor: '#0c4a6e',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '8px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#64748b', margin: '30px 0 0' }
