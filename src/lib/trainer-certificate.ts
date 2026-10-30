import { ORG } from "@/lib/billing-config";
import { formatDateBerlin } from "@/lib/format";
import { formatEuro } from "@/lib/trainer-billing";
import type { Certificate } from "@/lib/trainer-billing.functions";

function esc(v: string) {
  return v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

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
      return `<tr class="payout"><td colspan="4">Überwiesen am ${esc(formatDateBerlin(p.paidOn))}${p.items.length === 0 && p.note ? ` – ${esc(p.note)}` : ""}</td><td class="r">${esc(formatEuro(p.total))}</td></tr>${items}`;
    })
    .join("");
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Jahresbescheinigung ${c.year} – ${esc(c.trainerName)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:40px;font-size:13px;line-height:1.45}
  h1{font-size:20px;margin:28px 0 4px}
  .org{color:#444;font-size:12px}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  td{padding:5px 6px;vertical-align:top}
  .r{text-align:right;white-space:nowrap}
  .payout td{border-top:1px solid #999;font-weight:bold;padding-top:9px}
  .item td{color:#333;font-size:12px}
  .sum{margin-top:18px;font-size:15px;font-weight:bold;border-top:2px solid #111;padding-top:8px;display:flex;justify-content:space-between}
  .note{margin-top:22px;font-size:12px;color:#333}
  .sign{margin-top:60px;font-size:12px}
  @media print{body{margin:18mm}}
</style></head><body>
<div class="org"><strong>${esc(ORG.name)}</strong> · ${esc(ORG.street)}, ${esc(ORG.zipCity)}<br>${esc(ORG.register)}</div>
<h1>Bescheinigung über gezahlte Übungsleitervergütung ${c.year}</h1>
<p>Der ${esc(ORG.name)} bescheinigt, dass <strong>${esc(c.trainerName)}</strong> im Kalenderjahr ${c.year} für die Tätigkeit als Trainer:in
(Schwimmunterricht) die folgenden Beträge überwiesen wurden.</p>
${
  c.payouts.length === 0
    ? "<p>Für dieses Jahr wurden keine Auszahlungen erfasst.</p>"
    : `<table>${payoutRows}</table>`
}
<div class="sum"><span>Gesamtsumme ${c.year}</span><span>${esc(formatEuro(c.total))}</span></div>
<p class="note">Die Vergütung erfolgte im Rahmen der Übungsleiterpauschale (§ 3 Nr. 26 EStG). Der Betrag ist
gegebenenfalls in der Einkommensteuererklärung anzugeben; die Prüfung, ob der Freibetrag von
Ihnen insgesamt (auch bei anderen Auftraggebern) bereits ausgeschöpft ist, liegt bei Ihnen.</p>
<p class="sign">${esc(ORG.city)}, ${esc(formatDateBerlin(new Date()))}<br><br>______________________________<br>${esc(ORG.signatory)}</p>
<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},300)})</script>
</body></html>`;
}

export function openCertificate(c: Certificate): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(certificateHtml(c));
  w.document.close();
  return true;
}
