import { z } from "zod";
import { HandHeart, User, Users } from "lucide-react";
import { MEMBERSHIP_FEES } from "@/lib/billing-config";
import { todayBerlinIso } from "@/lib/format";
import { normalizeIban } from "@/lib/iban";
import { maxMembershipStart } from "@/lib/member-claim";

export type MembershipTier = "children_youth" | "adult" | "family" | "supporting";

export const TIERS: Array<{
  type: MembershipTier;
  icon: typeof User;
  name: string;
  price: string;
  desc: string;
}> = [
  {
    type: "children_youth",
    icon: User,
    name: "Kinder & Jugend",
    price: `${MEMBERSHIP_FEES.children_youth} €/Jahr`,
    desc: "Einzelmitgliedschaft für alle unter 18.",
  },
  {
    type: "adult",
    icon: User,
    name: "Erwachsene",
    price: `${MEMBERSHIP_FEES.adult} €/Jahr`,
    desc: "Einzelmitgliedschaft ab 18 Jahren.",
  },
  {
    type: "family",
    icon: Users,
    name: "Familie",
    price: `${MEMBERSHIP_FEES.family} €/Jahr`,
    desc: "Ab 3 Personen, max. 2 Erwachsene + Kinder unter 18 im selben Haushalt.",
  },
  {
    type: "supporting",
    icon: HandHeart,
    name: "Förderung",
    price: `ab ${MEMBERSHIP_FEES.supporting_min} €/Jahr`,
    desc: "Passive Mitgliedschaft ohne Stimmrecht, Beitrag nach oben frei wählbar.",
  },
];

// Technische Obergrenze im Formular (Missbrauchsschutz); die Satzung kennt keine Begrenzung.
export const MAX_CHILDREN = 20;
/** So viele Kinderzeilen stehen von Anfang an im Formular. */
export const INITIAL_CHILD_ROWS = 4;
/** Ab mehr Kindern ist eine Haushaltsbescheinigung nötig. */
export const CHILDREN_WITHOUT_PROOF = 3;

export type FamilyMember = {
  name: string;
  last_name: string;
  date_of_birth: string;
  email?: string;
  phone?: string;
};

export const emptyFamilyMember = (): FamilyMember => ({
  name: "",
  last_name: "",
  date_of_birth: "",
});

/** Zahl der tatsächlich eingetragenen Personen (Vorname ausgefüllt). */
export const filledCount = (list: FamilyMember[]) => list.filter((c) => c.name.trim()).length;

export function isMinorDob(dob?: string | null) {
  if (!dob) return false;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return false;
  return new Date(d.getFullYear() + 18, d.getMonth(), d.getDate()) > new Date();
}

export const MINOR_CONSENTS = [
  {
    key: "minor_apply",
    text: "Ich beantrage die Mitgliedschaft für das oben genannte minderjährige Kind und stimme dessen Aufnahme in Sicher Schwimmen e.V. zu.",
  },
  {
    key: "minor_continues",
    text: "Ich habe zur Kenntnis genommen, dass die Mitgliedschaft meines Kindes mit Eintritt der Volljährigkeit nicht automatisch endet, sondern grundsätzlich als Mitgliedschaft eines erwachsenen Mitglieds fortgeführt wird, sofern keine wirksame Kündigung erfolgt.",
  },
  {
    key: "minor_inform_child",
    text: "Ich verpflichte mich, mein Kind rechtzeitig vor seinem 18. Geburtstag über die bestehende Mitgliedschaft und den bevorstehenden Statuswechsel zu informieren.",
  },
  {
    key: "minor_data_duty",
    text: "Ich habe zur Kenntnis genommen, dass mein Kind nach Eintritt der Volljährigkeit dem Verein seine aktuellen Kontaktdaten und gegebenenfalls die für die weitere Beitragszahlung erforderlichen Zahlungsinformationen mitteilen muss.",
  },
  {
    key: "minor_contact",
    text: "Ich stimme zu, dass Sicher Schwimmen e.V. mein Kind bereits vor bzw. spätestens mit Erreichen der Volljährigkeit unmittelbar über die bestehende Mitgliedschaft, den Statuswechsel, die Änderung der Beitragszuordnung und die erforderlichen nächsten Schritte informiert.",
  },
] as const;

const accepted = z.boolean().refine((v) => v);

const schema = z.object({
  membership_type: z.enum(["children_youth", "adult", "family", "supporting"]),
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((v) => v >= todayBerlinIso() && v <= maxMembershipStart(todayBerlinIso()), {
      message: "Beginn frühestens heute, höchstens 6 Monate im Voraus",
    }),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(5).max(40),
  address_street: z.string().trim().min(3).max(200),
  address_zip: z.string().trim().min(4).max(20),
  address_city: z.string().trim().min(2).max(100),
  guardian_name: z.string().trim().max(200).optional(),
  guardian_email: z.string().trim().max(255).optional(),
  guardian_phone: z.string().trim().max(40).optional(),
  sepa_account_holder: z.string().trim().min(1, "Kontoinhaber erforderlich").max(200),
  sepa_iban: z
    .string()
    .trim()
    .min(15, "IBAN ungültig")
    .max(42)
    .regex(/^[A-Z]{2}[0-9A-Z ]+$/i, "IBAN ungültig"),
  sepa_bic: z.string().trim().max(11).optional(),
  sepa_bank_name: z.string().trim().min(1, "Bank erforderlich").max(200),
  sepa_signature_place: z.string().trim().min(1, "Ort erforderlich").max(120),
  sepa_signature_date: z.string().min(1, "Datum erforderlich"),
  sepa_mandate_accepted: accepted,
  accepted_statutes: accepted,
  accepted_rules: accepted,
  accepted_privacy: accepted,
});

export type MembershipData = z.infer<typeof schema>;

/** Fehler: betroffene Felder (für die Formular-Statistik), Fehlercode und Hinweistext. */
type Invalid = { ok: false; fields: string[]; code?: string; message: string };
export type ValidMembership = {
  ok: true;
  data: MembershipData;
  /** Leer = Passwort-Link per E-Mail */
  password: string;
  isMinorMember: boolean;
  minorConsents: Record<string, string | boolean | undefined> | null;
  memberEmail: string | null;
  memberPhone: string | null;
  payerRole: string;
};

const text = (fd: FormData, key: string) => String(fd.get(key) || "").trim();

/**
 * Prüft den Antrag in der bisherigen Reihenfolge (Passwort → Pflichtfelder →
 * Erziehungsberechtigte → Mitglieds-E-Mail → Zustimmungen Minderjähriger → Kinder-Geburtsdaten).
 */
export function validateMembership(
  fd: FormData,
  tier: MembershipTier,
  children: FamilyMember[],
): Invalid | ValidMembership {
  const password = text(fd, "account_password");
  const passwordConfirm = text(fd, "account_password_confirm");
  if (password || passwordConfirm) {
    if (password.length < 8)
      return {
        ok: false,
        fields: ["account_password"],
        code: "zu_kurz",
        message: "Passwort muss mindestens 8 Zeichen lang sein.",
      };
    if (password !== passwordConfirm)
      return {
        ok: false,
        fields: ["account_password_confirm"],
        code: "ungleich",
        message: "Passwörter stimmen nicht überein.",
      };
  }

  const on = (key: string) => fd.get(key) === "on";
  const parsed = schema.safeParse({
    membership_type: tier,
    first_name: fd.get("first_name"),
    last_name: fd.get("last_name"),
    date_of_birth: fd.get("date_of_birth") || undefined,
    start_date: fd.get("start_date") || undefined,
    email: fd.get("email"),
    phone: fd.get("phone"),
    address_street: fd.get("address_street"),
    address_zip: fd.get("address_zip"),
    address_city: fd.get("address_city"),
    guardian_name: fd.get("guardian_name"),
    guardian_email: fd.get("guardian_email"),
    guardian_phone: fd.get("guardian_phone"),
    sepa_account_holder: fd.get("sepa_account_holder"),
    sepa_iban: normalizeIban(String(fd.get("sepa_iban") ?? "")),
    sepa_bic: (fd.get("sepa_bic") as string | null)?.toUpperCase() || undefined,
    sepa_bank_name: fd.get("sepa_bank_name"),
    sepa_signature_place: fd.get("sepa_signature_place"),
    sepa_signature_date: fd.get("sepa_signature_date"),
    sepa_mandate_accepted: on("sepa_mandate_accepted"),
    accepted_statutes: on("accepted_statutes"),
    accepted_rules: on("accepted_rules"),
    accepted_privacy: on("accepted_privacy"),
  });
  if (!parsed.success)
    return {
      ok: false,
      fields: parsed.error.issues.map((i) => String(i.path[0] ?? "")),
      message: "Bitte alle Pflichtfelder & Zustimmungen ausfüllen.",
    };
  const data = parsed.data;

  const isMinorMember = isMinorDob(data.date_of_birth) || tier === "children_youth";
  let minorConsents: ValidMembership["minorConsents"] = null;
  if (isMinorMember) {
    if (
      !data.guardian_name ||
      data.guardian_name.split(/\s+/).length < 2 ||
      !data.guardian_email ||
      !data.guardian_phone
    )
      return {
        ok: false,
        fields: ["guardian_name", "guardian_email", "guardian_phone"],
        code: "fehlt",
        message:
          "Bei Minderjährigen bitte Vor- und Nachname, E-Mail und Telefon der Erziehungsberechtigten angeben.",
      };
    if (!z.string().email().safeParse(text(fd, "member_email")).success)
      return {
        ok: false,
        fields: ["member_email"],
        message: "Bitte die E-Mail-Adresse des minderjährigen Mitglieds angeben.",
      };
    const keys = MINOR_CONSENTS.map((c) => c.key);
    const missing = keys.filter((k) => !on(k));
    if (missing.length)
      return {
        ok: false,
        fields: missing,
        code: "fehlt",
        message: "Bitte alle Zustimmungen für minderjährige Mitglieder bestätigen.",
      };
    minorConsents = {
      ...Object.fromEntries(keys.map((k) => [k, true])),
      accepted_at: new Date().toISOString(),
      accepted_by: data.guardian_name,
    };
  }

  if (tier === "family" && children.some((c) => c.name.trim() && !c.date_of_birth))
    return {
      ok: false,
      fields: ["child_date_of_birth"],
      code: "fehlt",
      message: "Bitte bei jedem Kind das Geburtsdatum angeben.",
    };

  return {
    ok: true,
    data,
    password,
    isMinorMember,
    minorConsents,
    memberEmail: isMinorMember ? text(fd, "member_email") : null,
    memberPhone: isMinorMember ? text(fd, "member_phone") || null : null,
    payerRole: String(fd.get("payer_role") || "member"),
  };
}

/** Familienangehörige für `memberships.family_members`; leerer Nachname = Nachname des Antrags. */
export function familyMembersPayload(
  partner: FamilyMember,
  children: FamilyMember[],
  fallbackLastName: string,
) {
  const entry = (m: FamilyMember) => ({
    name: `${m.name.trim()} ${m.last_name.trim() || fallbackLastName}`.trim(),
    date_of_birth: m.date_of_birth || null,
    email: m.email?.trim() || null,
    phone: m.phone?.trim() || null,
  });
  return {
    partner: partner.name.trim() ? entry(partner) : null,
    children: children.filter((c) => c.name.trim()).map(entry),
  };
}
