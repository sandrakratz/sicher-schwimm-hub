import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProgramFitFields } from "@/components/admin/ProgramFitFields";
import { Hint, type ProgramRow } from "@/components/admin/kurse/shared";

type Editing = Partial<ProgramRow>;
type TextKey =
  | "name"
  | "slug"
  | "location"
  | "target_group"
  | "age_range"
  | "duration"
  | "description"
  | "requirements"
  | "course_info";
type NumKey =
  | "min_age_years"
  | "max_age_years"
  | "price_member"
  | "price_non_member"
  | "payment_due_days"
  | "sort_order";
type CheckKey = "is_public" | "bookable" | "waitlist_open";

/** Beschriftung und Standard-Hinweis je Feld (Dialog und Reiter „Kursangaben“ gleich). */
const FIELDS: Record<TextKey | NumKey, { label: string; hint?: string }> = {
  name: { label: "Name *" },
  slug: { label: "Slug (URL)" },
  location: {
    label: "Ort",
    hint: "Ortszeile auf Kurskarte und Detailseite. Einzelne Zeiträume können einen abweichenden Ort haben.",
  },
  description: {
    label: "Beschreibung",
    hint: "Erster Absatz = Kurztext in der Kursübersicht /kurse und Einleitung oben auf der Detailseite. Weitere Absätze (durch Leerzeile trennen) erscheinen nur auf der Detailseite.",
  },
  requirements: {
    label: "Voraussetzungen",
    hint: 'Kursübersicht: kurz unter „Voraussetzungen" bzw. bei geplanten Angeboten als „Rahmen". Detailseite: eigener Abschnitt. Jede Zeile wird zu einem Aufzählungspunkt.',
  },
  course_info: {
    label: "Ablauf & Wichtiges für den Kurstag",
    hint: "Standardtext für neue Zeiträume dieses Angebots. Wird auf der Detailseite, in der Buchungsbestätigung und in der Erinnerungs-E-Mail gezeigt.",
  },
  target_group: {
    label: "Zielgruppe",
    hint: "Badge oben auf der Kurskarte und in der Infobox der Detailseite.",
  },
  age_range: {
    label: "Altersangabe",
    hint: "Blaue Zeile unter dem Kursnamen (Kursübersicht) und Infobox (Detailseite).",
  },
  duration: {
    label: "Dauer",
    hint: 'Uhr-Zeile auf Kurskarte und Detailseite (z. B. „8 Termine · ca. 40 Minuten").',
  },
  min_age_years: {
    label: "Mindestalter (Jahre)",
    hint: "Nur Detailseite (Hinweis bei den Voraussetzungen) und Prüfung bei Buchung und Warteliste.",
  },
  max_age_years: {
    label: "Höchstalter (Jahre)",
    hint: "Bis einschließlich (z. B. 5 = am 6. Geburtstag nicht mehr). Leer = keine Obergrenze. Prüfung bei Buchung und Warteliste.",
  },
  price_non_member: {
    label: "Preis Nicht-Mitglied (€)",
    hint: "Preiszeile auf Kurskarte und Detailseite.",
  },
  price_member: { label: "Preis Mitglied (€)", hint: "Preiszeile auf Kurskarte und Detailseite." },
  payment_due_days: {
    label: "Zahlungsziel (Tage)",
    hint: "Nicht öffentlich sichtbar – wird in Buchungsbestätigung und Rechnungstext genutzt.",
  },
  sort_order: {
    label: "Sortierung",
    hint: "Reihenfolge der Karten in der Kursübersicht (kleine Zahl zuerst).",
  },
};

/** Leere Zahlenfelder: Zahlungsziel/Sortierung haben einen Standardwert, alle übrigen bedeuten „keine Angabe“. */
const NUM_FALLBACK: Partial<Record<NumKey, number>> = { payment_due_days: 14, sort_order: 0 };

/**
 * Eingabefelder eines Kursangebots, gemeinsam genutzt vom Dialog „Neues Kursangebot“ und vom
 * Reiter „Kursangaben“. Die Aufrufer bestimmen die Anordnung und weichen bei Bedarf im Hinweis ab.
 */
export function programFields(editing: Editing, setEditing: Dispatch<SetStateAction<Editing>>) {
  const set = (patch: Editing) => setEditing((p) => ({ ...p, ...patch }));
  const wrap = (key: TextKey | NumKey, control: ReactNode, hint?: ReactNode) => {
    const h = hint ?? FIELDS[key].hint;
    return (
      <div>
        <Label>{FIELDS[key].label}</Label>
        {control}
        {h && <Hint>{h}</Hint>}
      </div>
    );
  };

  return {
    text: (key: TextKey, hint?: ReactNode, onChange?: (v: string) => void) =>
      wrap(
        key,
        <Input
          value={editing[key] || ""}
          onChange={(e) => (onChange ? onChange(e.target.value) : set({ [key]: e.target.value }))}
        />,
        hint,
      ),
    slug: () =>
      wrap(
        "slug",
        <Input value={editing.slug || ""} onChange={(e) => set({ slug: e.target.value })} />,
        <>
          Adresse der Detailseite: /kurse/{editing.slug || "…"} – nachträgliches Ändern verändert
          bestehende Links.
        </>,
      ),
    area: (key: TextKey, rows: number, placeholder?: string) =>
      wrap(
        key,
        <Textarea
          rows={rows}
          value={editing[key] || ""}
          onChange={(e) => set({ [key]: e.target.value })}
          placeholder={placeholder}
        />,
      ),
    num: (key: NumKey, hint?: ReactNode) => {
      const fallback = NUM_FALLBACK[key];
      return wrap(
        key,
        <Input
          type="number"
          value={editing[key] ?? fallback ?? ""}
          onChange={(e) =>
            set({
              [key]:
                fallback === undefined && e.target.value === "" ? null : Number(e.target.value),
            })
          }
        />,
        hint,
      );
    },
    check: (key: CheckKey, label: string, note: string) => (
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={editing[key] ?? true}
          onCheckedChange={(v) => set({ [key]: Boolean(v) })}
        />
        {label}
        <span className="text-[11px] text-muted-foreground">{note}</span>
      </label>
    ),
    fit: () => <ProgramFitFields minSwimLevel={editing.min_swim_level} onChange={(v) => set(v)} />,
  };
}
