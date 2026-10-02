// Server-only: Prüft, ob ein Aufruf der Cron-Endpunkte (/api/public/hooks/*) von unserem Datenbank-Cron kommt.
//
// Neu: eigenes Geheimnis `CRON_SECRET` (Cloudflare-Secret), das der Cron im Header `x-cron-secret` mitschickt.
// Bisher diente der öffentliche Supabase-Publishable-Key (steht im Browser-Code) als „Schlüssel“ – den kann jeder
// lesen. Solange `CRON_SECRET` nicht gesetzt ist, gilt übergangsweise noch die alte Prüfung (mit Warnung im Log),
// damit die Umstellung ohne Ausfall möglich ist (Anleitung: docs/migration/cron-jobs.md).

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const x = enc.encode(a)
  const y = enc.encode(b)
  // Längenunterschied wird mit einbezogen, ohne vorzeitig abzubrechen
  let diff = x.length ^ y.length
  const n = Math.max(x.length, y.length)
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

export function isCronAuthorized(request: Request): boolean {
  const secret = process.env['CRON_SECRET'] ?? ''
  if (secret) {
    const given = request.headers.get('x-cron-secret') ?? ''
    return given !== '' && timingSafeEqual(given, secret)
  }

  console.warn('[cron] CRON_SECRET ist nicht gesetzt – es gilt noch die alte Prüfung mit dem öffentlichen Supabase-Schlüssel.')
  const apiKey = request.headers.get('apikey') ?? ''
  const accepted = [process.env['SUPABASE_ANON_KEY'], process.env['SUPABASE_PUBLISHABLE_KEY']].filter(Boolean) as string[]
  return apiKey !== '' && accepted.includes(apiKey)
}

export function cronUnauthorized(): Response {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}
