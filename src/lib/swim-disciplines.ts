// Strecken- und Lagenvorgaben nach DPO für die Abnahme am Beckenrand
// (Stoppuhr + Bahnenzähler im Trainerbereich).

export type SwimStyle = "brust" | "kraul" | "ruecken";

export const STYLE_LABEL: Record<SwimStyle, string> = {
  brust: "Brust/Bauch",
  kraul: "Kraul",
  ruecken: "Rücken",
};

export type Discipline = {
  key: string;
  label: string;
  /** Abzeichen, zu dem der Prüfungsteil gehört (Schlüssel aus swim-exams). */
  examLevel: string;
  /** Prüfungsteil, in den die Zeit übernommen wird. */
  criterionKey: string;
  /** Pflichtstrecke in Metern. */
  meters: number;
  /** Mindestdauer in Sekunden: so lange muss durchgeschwommen werden. */
  minDurationSec?: number;
  /** Höchstzeit in Sekunden (Sprints). */
  maxDurationSec?: number;
  /** Mindeststrecke in Bauchlage (Brust oder Kraul) in Metern. */
  bauchMeters?: number;
  /** Mindeststrecke in Rückenlage in Metern. */
  rueckenMeters?: number;
  /** Nur diese Lagen sind bei dieser Disziplin sinnvoll. */
  styles: SwimStyle[];
};

export const DISCIPLINES: Discipline[] = [
  {
    key: "bronze_200",
    label: "Bronze – 200 m in 15 Minuten",
    examLevel: "bronze",
    criterionKey: "200m",
    meters: 200,
    minDurationSec: 15 * 60,
    bauchMeters: 150,
    rueckenMeters: 50,
    styles: ["brust", "kraul", "ruecken"],
  },
  {
    key: "silber_400",
    label: "Silber – 400 m in 25 Minuten",
    examLevel: "silber",
    criterionKey: "400m",
    meters: 400,
    minDurationSec: 25 * 60,
    bauchMeters: 300,
    rueckenMeters: 100,
    styles: ["brust", "kraul", "ruecken"],
  },
  {
    key: "gold_800",
    label: "Gold – 800 m in 30 Minuten",
    examLevel: "gold",
    criterionKey: "800m",
    meters: 800,
    minDurationSec: 30 * 60,
    bauchMeters: 650,
    rueckenMeters: 150,
    styles: ["brust", "kraul", "ruecken"],
  },
  {
    key: "gold_50_brust",
    label: "Gold – 50 m Brust (max. 1:15)",
    examLevel: "gold",
    criterionKey: "50m_brust",
    meters: 50,
    maxDurationSec: 75,
    styles: ["brust"],
  },
  {
    key: "gold_25_kraul",
    label: "Gold – 25 m Kraul",
    examLevel: "gold",
    criterionKey: "25m_kraul",
    meters: 25,
    styles: ["kraul"],
  },
  {
    key: "gold_50_ruecken",
    label: "Gold – 50 m Rücken",
    examLevel: "gold",
    criterionKey: "50m_ruecken",
    meters: 50,
    styles: ["ruecken"],
  },
  {
    key: "seeraeuber_100",
    label: "Seeräuber – 100 m Brust",
    examLevel: "seeraeuber",
    criterionKey: "100m_brust",
    meters: 100,
    styles: ["brust"],
  },
];

export const POOL_LENGTHS = [12.5, 25, 50] as const;
export type PoolLength = (typeof POOL_LENGTHS)[number];

/** Beckenlänge automatisch am Kursort erkennen (mit sinnvollem Standard). */
export function poolLengthForLocation(location: string | null | undefined): PoolLength {
  const l = (location || "").toLowerCase();
  if (l.includes("kurhaus")) return 12.5;
  if (l.includes("hennef") || l.includes("sportschule")) return 25;
  return 25;
}

export function lapsNeeded(meters: number, pool: PoolLength): number {
  return Math.ceil(meters / pool);
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function formatMeters(m: number): string {
  return Number.isInteger(m) ? `${m} m` : `${m.toFixed(1).replace(".", ",")} m`;
}
