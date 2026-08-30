import { createFileRoute } from '@tanstack/react-router'
import { buildEpcPayload } from '@/lib/epc-qr'

// Öffentlicher QR-Code (GiroCode) für Überweisungen auf das Vereinskonto.
// Empfänger/IBAN sind fest aus der Vereinskonfiguration – nur Betrag und
// Verwendungszweck sind Parameter.
export const Route = createFileRoute('/api/public/pay-qr')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const amountRaw = url.searchParams.get('amount')
        const amount = amountRaw && /^\d{1,6}(\.\d{1,2})?$/.test(amountRaw) ? Number(amountRaw) : null
        const reference = (url.searchParams.get('reference') || '').slice(0, 140)

        const payload = buildEpcPayload({ amount, reference })
        if (!payload) return new Response('Not configured', { status: 404 })

        const QRCode = await import('qrcode')
        const png = await QRCode.toBuffer(payload, {
          type: 'png',
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 360,
        })

        return new Response(new Uint8Array(png), {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=86400',
          },
        })
      },
    },
  },
})
