import { ORG } from "@/lib/billing-config";
import { formatDateBerlin, formatDateTimeBerlin } from "@/lib/format";
import { formatIban } from "@/lib/iban";
import { formatEuro } from "@/lib/trainer-billing";
import type { Certificate, PayoutReceipt } from "@/lib/trainer-billing.functions";

function esc(v: string) {
  return v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const STYLE = `
  body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:40px;font-size:13px;line-height:1.45}
  h1{font-size:20px;margin:28px 0 4px}
  .org{color:#444;font-size:12px}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  td,th{padding:5px 6px;vertical-align:top;text-align:left}
  th{border-bottom:1px solid #999;font-size:12px}
  .r{text-align:right;white-space:nowrap}
  .payout td{border-top:1px solid #999;font-weight:bold;padding-top:9px}
  .item td{color:#333;font-size:12px}
  .sum{margin-top:18px;font-size:15px;font-weight:bold;border-top:2px solid #111;padding-top:8px;display:flex;justify-content:space-between}
  .note{margin-top:22px;font-size:12px;color:#333}
  .meta{margin-top:18px;font-size:12px;color:#333}
  .signs{margin-top:8px;display:flex;gap:48px;font-size:12px}
  .signs section{flex:1}
  .signs .sig{height:60px;display:flex;align-items:flex-end}
  .signs .sig img{max-height:56px;max-width:220px}
  .signs .line{border-top:1px solid #111;padding-top:4px}
  @media print{body{margin:18mm}}
`;

const header = () =>
  `<div class="org"><strong>${esc(ORG.name)}</strong> · ${esc(ORG.street)}, ${esc(ORG.zipCity)}<br>${esc(ORG.register)}</div>`;

// Hinterlegte Unterschrift steht über der Linie; ohne Bild bleibt Platz zum Unterschreiben von Hand.
const signLines = (signers: { name: string; role: string; signatureUrl?: string }[]) =>
  `<p style="margin-top:40px;font-size:12px">${esc(ORG.city)}, ${esc(formatDateBerlin(new Date()))}</p>
<div class="signs">${signers
    .map(
      (s) =>
        `<section><div class="sig">${
          s.signatureUrl?.startsWith("data:image/png;base64,")
            ? `<img src="${s.signatureUrl}" alt="Unterschrift ${esc(s.name)}">`
            : ""
        }</div><div class="line">${esc(s.name)}<br>${esc(s.role)}</div></section>`,
    )
    .join("")}</div>`;

const printScript = `<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},300)})</script>`;

/** Druckfertige Jahresbescheinigung als HTML (im neuen Fenster öffnen und drucken / als PDF speichern). */
export function certificateHtml(c: Certificate): string {
  const payoutRows = c.payouts
    .map((p) => {
      const items = p.items
        .map(
          (i) =>
            `<tr class="item"><td>${esc(formatDateBerlin(i.sessionDate))}</td><td>${esc(i.courseName)}</td><td class="r">${i.hours} Std.</td><td class="r">${esc(formatEuro(i.rate))}</td><td class="r">${esc(formatEuro(i.amount))}</td></tr>`,
        )
        .join("");
      return `<tr class="payout"><td colspan="4">Ausgezahlt am ${esc(formatDateBerlin(p.paidOn))}${p.items.length === 0 && p.note ? ` – ${esc(p.note)}` : ""}</td><td class="r">${esc(formatEuro(p.total))}</td></tr>${items}`;
    })
    .join("");
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Bescheinigung Übungsleiterpauschale ${c.year} – ${esc(c.trainerName)}</title>
<style>${STYLE}</style></head><body>
${header()}
<h1>Bescheinigung über Einnahmen aus nebenberuflicher Übungsleitertätigkeit ${c.year}</h1>
<p>Der ${esc(ORG.name)} bescheinigt, dass <strong>${esc(c.trainerName)}</strong> im Kalenderjahr ${c.year}
für die nebenberufliche Tätigkeit als Übungsleiter:in (Schwimmunterricht) die folgenden Beträge erhalten hat.
Die Vergütung ist im Rahmen des Freibetrags nach <strong>§ 3 Nr. 26 EStG</strong> (Übungsleiterpauschale) steuerfrei.</p>
${c.payouts.length === 0 ? "<p>Für dieses Jahr wurden keine freigegebenen Auszahlungen erfasst.</p>" : `<table>${payoutRows}</table>`}
<div class="sum"><span>Gesamtsumme ${c.year}</span><span>${esc(formatEuro(c.total))}</span></div>
<p class="note">Die Einhaltung der satzungsmäßigen Voraussetzungen nach den §§ 51, 59, 60 und 61 AO wurde vom
${esc(ORG.taxOffice)} mit Bescheid vom ${esc(formatDateBerlin(ORG.taxNoticeDate))} nach § 60a AO gesondert festgestellt.
Der Betrag ist in der Einkommensteuererklärung anzugeben. Ob der Freibetrag insgesamt – auch durch andere
Auftraggeber – bereits ausgeschöpft ist, prüft die Empfängerin bzw. der Empfänger selbst.</p>
${signLines(c.signers)}
${printScript}
</body></html>`;
}

/**
 * Auszahlungskonto: bei der Freigabe festgehalten. Ältere freigegebene Auszahlungen ohne festgehaltenes Konto
 * zeigen die aktuelle Bankverbindung mit Hinweis, weil sie nicht sicher die damals genutzte ist.
 */
function bankLine(r: PayoutReceipt): string {
  const b = r.bank;
  if (!b) return `<p><strong>Auszahlungskonto:</strong> keine Bankverbindung hinterlegt</p>`;
  const hint =
    r.status === "approved" && !b.fixedAtApproval
      ? `<br><em>Hinweis: Bei der Freigabe nicht festgehalten. Das ist die aktuelle Bankverbindung${
          b.updatedAt ? ` (zuletzt geändert am ${esc(formatDateBerlin(b.updatedAt))})` : ""
        }. Bitte mit dem Kontoauszug abgleichen.</em>`
      : "";
  return `<p><strong>Auszahlungskonto:</strong> ${esc(b.holder)} · IBAN ${esc(formatIban(b.iban))}${hint}</p>`;
}

/** Beleg einer einzelnen Auszahlung für die Buchhaltung und Kassenprüfung. */
export function receiptHtml(r: PayoutReceipt): string {
  const rows = r.items
    .map(
      (i) =>
        `<tr><td>${esc(formatDateBerlin(i.sessionDate))}</td><td>${esc(i.courseName)}</td><td class="r">${i.hours} Std.</td><td class="r">${esc(formatEuro(i.rate))}</td><td class="r">${esc(formatEuro(i.amount))}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Abrechnungsbeleg ${esc(r.trainerName)} ${esc(formatDateBerlin(r.paidOn))}</title>
<style>${STYLE}</style></head><body>
${header()}
<h1>Abrechnungsbeleg Übungsleitervergütung</h1>
<p><strong>${esc(r.trainerName)}</strong> · Auszahlung am ${esc(formatDateBerlin(r.paidOn))}${r.note ? ` · ${esc(r.note)}` : ""}</p>
${bankLine(r)}
${
  r.items.length
    ? `<table><tr><th>Datum</th><th>Kurs</th><th class="r">Stunden</th><th class="r">Satz</th><th class="r">Betrag</th></tr>${rows}</table>`
    : "<p>Nachträglich erfasster Betrag ohne einzelne Termine.</p>"
}
<div class="sum"><span>Summe</span><span>${esc(formatEuro(r.total))}</span></div>
<div class="meta">
  Angelegt: ${esc(r.createdByName ?? "–")}${r.createdAt ? `, ${esc(formatDateTimeBerlin(r.createdAt))}` : ""}<br>
  ${
    r.status === "approved"
      ? `Freigegeben: ${esc(r.approvedByName ?? "–")}${r.approvedAt ? `, ${esc(formatDateTimeBerlin(r.approvedAt))}` : ""}`
      : "<strong>Noch nicht freigegeben</strong>"
  }
  ${r.overrideReason ? `<br>Hinweis: ${esc(r.overrideReason)}` : ""}
</div>
<p class="note">Steuerfrei im Rahmen der Übungsleiterpauschale (§ 3 Nr. 26 EStG).</p>
${printScript}
</body></html>`;
}

function openHtml(html: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

export const openCertificate = (c: Certificate) => openHtml(certificateHtml(c));
export const openReceipt = (r: PayoutReceipt) => openHtml(receiptHtml(r));
