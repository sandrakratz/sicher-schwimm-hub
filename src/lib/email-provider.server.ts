// Server-only: Versand über Resend (https://resend.com) und Prüfung signierter Webhooks.
// Die Werte kommen aus den Cloudflare-Umgebungsvariablen – siehe docs/migration/neue-einrichtung.md.

export const SITE_NAME = 'Sicher Schwimmen e.V.'
export const SITE_URL = 'https://sicher-schwimmen.com'
export const FROM_DOMAIN = 'notify.sicher-schwimmen.com'
export const FROM_ADDRESS = `${SITE_NAME} <noreply@${FROM_DOMAIN}>`

export class EmailSendError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export interface ProviderEmail {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
  idempotencyKey?: string
}

/** Sendet eine E-Mail über Resend. Wirft `EmailSendError`, wenn Resend sie ablehnt. */
export async function sendWithResend(mail: ProviderEmail): Promise<{ id: string | null }> {
  const apiKey = process.env['RESEND_API_KEY']
  if (!apiKey) throw new EmailSendError('RESEND_API_KEY is not configured', 'not_configured', 500)

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
  if (mail.idempotencyKey) headers['Idempotency-Key'] = mail.idempotencyKey.slice(0, 250)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [mail.to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
    }),
  })

  const body = (await res.json().catch(() => ({}))) as { id?: string; name?: string; message?: string }
  if (!res.ok) {
    throw new EmailSendError(
      body.message || `Resend antwortete mit Status ${res.status}`,
      body.name || 'send_failed',
      res.status,
    )
  }
  return { id: body.id ?? null }
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Prüft die Signatur eines Webhooks nach dem „Standard Webhooks“-Verfahren.
 * Wird von Supabase (Send-Email-Hook, Kopfzeilen `webhook-*`) und von Resend
 * (Kopfzeilen `svix-*`) genutzt. Das Geheimnis sieht aus wie `v1,whsec_…` bzw. `whsec_…`.
 */
export async function verifyWebhookSignature(
  headers: Headers,
  rawBody: string,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  const id = headers.get('webhook-id') ?? headers.get('svix-id')
  const timestamp = headers.get('webhook-timestamp') ?? headers.get('svix-timestamp')
  const signatureHeader = headers.get('webhook-signature') ?? headers.get('svix-signature')
  if (!id || !timestamp || !signatureHeader) return false

  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > toleranceSeconds) return false

  let keyBytes: Uint8Array<ArrayBuffer>
  try {
    keyBytes = base64ToBytes(secret.replace(/^v1,/, '').replace(/^whsec_/, ''))
  } catch {
    return false
  }

  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`))
  let expected = ''
  for (const b of new Uint8Array(signed)) expected += String.fromCharCode(b)
  expected = btoa(expected)

  return signatureHeader
    .split(' ')
    .map((part) => part.split(',')[1] ?? '')
    .some((sig) => timingSafeEqual(sig, expected))
}
