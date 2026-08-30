// Zentrale Kalender-/ICS-Logik (Europe/Berlin) für Kurstermine.
// Wird von der Trainer-Verfügbarkeit genutzt und kann von weiteren Ansichten
// wiederverwendet werden.

export const CALENDAR_TZ = "Europe/Berlin";

export function icsEscape(s: string): string {
  return (s || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** YYYYMMDD (optional um Tage verschoben) – für ganztägige Fallback-Termine. */
export function icsDate(dateStr: string, addDays = 0): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + addDays);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/** Liest "Mo 16:00-17:00", "16.00 bis 17.15" usw. aus dem Zeitplan. */
export function parseTimeRange(
  schedule?: string | null,
  duration?: string | null,
): { start: string; end: string } | null {
  const text = schedule || "";
  const range = text.match(/(\d{1,2})[:.](\d{2})\s*(?:-|–|—|bis)\s*(\d{1,2})[:.](\d{2})/);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (range) {
    return { start: `${pad(+range[1])}:${range[2]}`, end: `${pad(+range[3])}:${range[4]}` };
  }
  const single = text.match(/(\d{1,2})[:.](\d{2})/);
  if (!single) return null;
  const minutes = Number((duration || "").match(/(\d{1,3})\s*(?:min|Minuten)/i)?.[1] ?? 45);
  const startMin = +single[1] * 60 + +single[2];
  const endMin = Math.min(startMin + (isNaN(minutes) ? 45 : minutes), 23 * 60 + 59);
  return {
    start: `${pad(Math.floor(startMin / 60))}:${pad(startMin % 60)}`,
    end: `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`,
  };
}

export function icsLocal(dateStr: string, time: string): string {
  return `${dateStr.replace(/-/g, "")}T${time.replace(":", "")}00`;
}

/** Lokale Berliner Zeit -> UTC-Stempel (für Google-Kalender-Links). */
export function berlinToUtcStamp(dateStr: string, time: string): string {
  const naive = Date.parse(`${dateStr}T${time}:00Z`);
  const probe = new Date(naive);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CALENDAR_TZ,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })
    .formatToParts(probe)
    .reduce<Record<string, string>>((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  const asUtc = Date.parse(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}:${parts.second}Z`,
  );
  const offset = asUtc - naive;
  return new Date(naive - offset).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${CALENDAR_TZ}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

export type CalendarItem = {
  id: string;
  date: string;
  title: string;
  location: string;
  description: string;
  start?: string | null;
  end?: string | null;
};

export function buildIcs(items: CalendarItem[], calendarName = "Sicher Schwimmen – meine Kurstermine"): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sicher Schwimmen e.V.//Kurstermine//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
    `X-WR-TIMEZONE:${CALENDAR_TZ}`,
    ...VTIMEZONE,
  ];
  for (const it of items) {
    const timed = it.start && it.end;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${it.id}@sicher-schwimmen.com`,
      `DTSTAMP:${stamp}`,
      timed
        ? `DTSTART;TZID=${CALENDAR_TZ}:${icsLocal(it.date, it.start!)}`
        : `DTSTART;VALUE=DATE:${icsDate(it.date)}`,
      timed
        ? `DTEND;TZID=${CALENDAR_TZ}:${icsLocal(it.date, it.end!)}`
        : `DTEND;VALUE=DATE:${icsDate(it.date, 1)}`,
      `SUMMARY:${icsEscape(it.title)}`,
      it.location ? `LOCATION:${icsEscape(it.location)}` : "",
      it.description ? `DESCRIPTION:${icsEscape(it.description)}` : "",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.filter(Boolean).join("\r\n");
}

/** Link zum Anlegen eines Google-Kalender-Termins. */
export function googleCalendarUrl(item: CalendarItem): string {
  const dates = item.start && item.end
    ? `${berlinToUtcStamp(item.date, item.start)}/${berlinToUtcStamp(item.date, item.end)}`
    : `${icsDate(item.date)}/${icsDate(item.date, 1)}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: item.title,
    dates,
    details: item.description || "",
    location: item.location || "",
    ctz: CALENDAR_TZ,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Löst einen Download der übergebenen Termine als .ics-Datei aus. */
export function downloadIcs(items: CalendarItem[], filename = "sicher-schwimmen-termine.ics"): void {
  const blob = new Blob([buildIcs(items)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
