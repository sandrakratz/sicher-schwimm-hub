import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Passwort zurücksetzen für {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Passwort zurücksetzen</Heading>
        <Text style={text}>
          Wir haben eine Anfrage erhalten, dein Passwort für {siteName} zurückzusetzen.
          Klicke auf den Button, um ein neues Passwort zu vergeben.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Passwort zurücksetzen
        </Button>
        <Text style={footer}>
          Falls du das nicht angefordert hast, kannst du diese E-Mail ignorieren –
          dein Passwort bleibt unverändert.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

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
  margin: '0 0 25px',
}
const button = {
  backgroundColor: '#0c4a6e',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '8px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#64748b', margin: '30px 0 0' }
