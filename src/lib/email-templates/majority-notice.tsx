import * as React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  audience?: 'member' | 'parent'
  member_first_name?: string
  family_name?: string
  birthday?: string
  is_family?: boolean
  adult_fee?: number
  confirm_url?: string
}

const p = { fontSize: '15px', lineHeight: '1.55' }
const h = { color: '#0c4a6e', fontSize: '16px', margin: '20px 0 6px' }

const Email = ({ audience = 'member', member_first_name, family_name, birthday, is_family, adult_fee = 60, confirm_url }: Props) => {
  const name = member_first_name || 'Dein Kind'
  const fee = `${adult_fee.toFixed(2).replace('.', ',')} €`
  const url = confirm_url || 'https://sicher-schwimmen.com/portal/profil'
  if (audience === 'parent') {
    return (
      <Html lang="de">
        <Head />
        <Preview>{`Bevorstehende Volljährigkeit von ${name}`}</Preview>
        <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
          <Container style={{ padding: '24px', maxWidth: '600px' }}>
            <Text style={p}>{family_name ? `Guten Tag Familie ${family_name},` : 'Guten Tag,'}</Text>
            <Text style={p}>
              in etwa sechs Wochen{birthday ? ` (am ${birthday})` : ''} feiert Ihr Kind <strong>{name}</strong> den 18. Geburtstag. Dazu gratulieren wir schon heute herzlich!
            </Text>
            <Text style={h}>1. Die Mitgliedschaft bleibt bestehen</Text>
            <Text style={p}>Die Mitgliedschaft von {name} endet mit dem 18. Geburtstag nicht automatisch. Es ist kein neuer Aufnahmeantrag erforderlich; die Mitgliedschaft wird als volljähriges Mitglied eigenständig fortgeführt.</Text>
            <Text style={h}>2. Beitrag</Text>
            <Text style={p}>
              {is_family
                ? `Gemäß Beitragsordnung gilt der Familienbeitrag für Kinder bis zum vollendeten 18. Lebensjahr. Ab dem 18. Geburtstag fällt ${name} aus der Familienbeitragsregelung heraus und wird mit dem Beitrag für erwachsene Mitglieder (aktuell ${fee} pro Jahr) geführt. Ihre übrige Familienmitgliedschaft bleibt davon unberührt.`
                : `Ab dem 18. Geburtstag wird ${name} als erwachsenes Mitglied geführt (Beitrag aktuell ${fee} pro Jahr).`}
            </Text>
            <Text style={h}>3. Beitragszahlung</Text>
            <Text style={p}>Die Beiträge können weiterhin über Ihr Konto laufen. Soll künftig ein eigenes Konto von {name} genutzt werden, kann dafür ein neues SEPA-Lastschriftmandat erforderlich sein – teilen Sie uns das einfach mit.</Text>
            <Text style={h}>4. Information Ihres Kindes</Text>
            <Text style={p}>Wir haben {name} ebenfalls informiert und um eine kurze Datenbestätigung gebeten. Danach erhält {name} automatisch einen eigenen Mitgliederzugang. Falls {name} keine eigene E-Mail-Adresse bei uns hinterlegt hat, geben Sie den folgenden Link bitte weiter:</Text>
            <Button href={url} style={{ backgroundColor: '#0c4a6e', color: '#ffffff', padding: '12px 20px', borderRadius: '8px', textDecoration: 'none' }}>Zur Datenbestätigung</Button>
            <Hr />
            <Text style={{ fontSize: '13px', color: '#475569' }}>
              Fragen? Antworten Sie einfach an info@sicher-schwimmen.com.<br />Mit freundlichen Grüßen<br />Der Vorstand von Sicher Schwimmen e.V.
            </Text>
          </Container>
        </Body>
      </Html>
    )
  }
  return (
    <Html lang="de">
      <Head />
      <Preview>Bald 18! Infos zu Deiner Mitgliedschaft</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
        <Container style={{ padding: '24px', maxWidth: '600px' }}>
          <Heading style={{ color: '#0c4a6e' }}>Bald 18!</Heading>
          <Text style={p}>{member_first_name ? `Hallo ${member_first_name},` : 'Hallo,'}</Text>
          <Text style={p}>
            in rund sechs Wochen{birthday ? ` (am ${birthday})` : ''} feierst Du Deinen <strong>18. Geburtstag</strong>. Dazu gratulieren wir Dir schon jetzt von Herzen!
          </Text>
          <Text style={h}>Deine Mitgliedschaft bleibt bestehen</Text>
          <Text style={p}>Deine Vereinsmitgliedschaft endet mit Deinem 18. Geburtstag nicht. Du musst keinen neuen Mitgliedsantrag stellen – Du bist ab dann einfach volljähriges Mitglied.</Text>
          <Text style={h}>Was sich beim Beitrag ändert</Text>
          <Text style={p}>
            {is_family
              ? `Bisher warst Du über die Familienmitgliedschaft dabei. Diese gilt für Kinder bis 18. Ab Deinem Geburtstag gilt für Dich der Beitrag für erwachsene Mitglieder (aktuell ${fee} pro Jahr).`
              : `Ab Deinem Geburtstag wirst Du als erwachsenes Mitglied geführt (Beitrag aktuell ${fee} pro Jahr).`}
          </Text>
          <Text style={h}>Datenbestätigung zur Volljährigkeit</Text>
          <Text style={p}>Bitte prüfe kurz Deine E-Mail-Adresse, Telefonnummer, Anschrift und die Zahlungsart. Falls die Beiträge künftig von Deinem eigenen Konto kommen sollen, kann ein neues SEPA-Lastschriftmandat nötig sein.</Text>
          <Button href={url} style={{ backgroundColor: '#0c4a6e', color: '#ffffff', padding: '12px 20px', borderRadius: '8px', textDecoration: 'none' }}>
            Daten bestätigen
          </Button>
          <Text style={p}>Danach bekommst Du automatisch einen eigenen Zugang zu unserem Mitgliederbereich.</Text>
          <Text style={h}>Du möchtest nicht weitermachen?</Text>
          <Text style={p}>Wir würden uns freuen, wenn Du dabei bleibst! Du kannst die Mitgliedschaft aber jederzeit nach den Regeln unserer Satzung kündigen.</Text>
          <Hr />
          <Text style={{ fontSize: '13px', color: '#475569' }}>
            Fragen? Schreib an info@sicher-schwimmen.com.<br />Herzliche Grüße, Dein Team von Sicher Schwimmen e.V.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    d.audience === 'parent'
      ? `Sicher Schwimmen e.V. – Bevorstehende Volljährigkeit von ${d.member_first_name ?? 'Ihrem Kind'}`
      : 'Bald 18! Wichtige Informationen zu Deiner Mitgliedschaft bei Sicher Schwimmen e.V.',
  displayName: 'Hinweis 6 Wochen vor Volljährigkeit',
  previewData: { audience: 'member', member_first_name: 'Sophia', family_name: 'Kratz', birthday: '21.10.2030', is_family: true, adult_fee: 60 },
} satisfies TemplateEntry
