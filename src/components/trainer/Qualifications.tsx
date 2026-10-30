import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ShieldCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatDateBerlin, todayBerlinIso } from "@/lib/format";
import {
  MULTI_KINDS,
  QUALIFICATION_KINDS,
  QUALIFICATION_WARN_DAYS,
  daysUntil,
  expiryFrom,
  kindInfo,
  qualificationLabel,
} from "@/lib/trainer-qualifications";

type Row = {
  id: string;
  kind: string;
  issued_on: string | null;
  valid_until: string | null;
  note: string | null;
};

/**
 * Eigene Nachweise erfassen: Erste Hilfe und Führungszeugnis gelten 2 Jahre ab Ausstellung (das Ablaufdatum
 * wird errechnet), bei anderen Nachweisen gibt man ein Ablaufdatum an, falls es eines gibt.
 * Der Vorstand sieht alles in der Übersicht „Trainer-Qualifikationen“ und prüft die Nachweise dort.
 */
export function Qualifications({ me }: { me: string }) {
  const db = supabase as any;
  const today = todayBerlinIso();
  const [rows, setRows] = useState<Row[]>([]);
  const [ready, setReady] = useState(false);
  const [kind, setKind] = useState<string>(QUALIFICATION_KINDS[0].value);
  const [issued, setIssued] = useState("");
  const [until, setUntil] = useState("");
  const [note, setNote] = useState("");

  const info = kindInfo(kind);
  const computed = info?.years ? expiryFrom(kind, issued) : null;

  async function load() {
    const { data, error } = await db
      .from("trainer_qualifications")
      .select("id,kind,issued_on,valid_until,note")
      .eq("trainer_id", me)
      .order("kind");
    if (error) return; // Migration noch nicht eingespielt: Karte bleibt ausgeblendet
    setRows(data ?? []);
    setReady(true);
  }
  useEffect(() => {
    void load();
  }, [me]);

  async function save() {
    if (!issued) return toast.error("Bitte angeben, wann der Nachweis ausgestellt wurde");
    const validUntil = info?.years ? computed : until || null;
    const payload = {
      trainer_id: me,
      kind,
      issued_on: issued,
      valid_until: validUntil,
      note: note.trim() || null,
    };
    // „Sonstiges“ darf mehrfach vorkommen: immer neu anlegen, nie überschreiben.
    // Alle anderen Arten: vorhandenen Eintrag aktualisieren, sonst neu anlegen. Kein upsert(onConflict), denn die
    // Eindeutigkeit ist ein partieller Index (WHERE kind <> 'sonstiges'), den ON CONFLICT nicht verwenden kann.
    let res;
    if (MULTI_KINDS.includes(kind)) {
      res = await db.from("trainer_qualifications").insert(payload);
    } else {
      res = await db
        .from("trainer_qualifications")
        .update(payload)
        .eq("trainer_id", me)
        .eq("kind", kind)
        .select("id");
      if (!res.error && (res.data?.length ?? 0) === 0) {
        res = await db.from("trainer_qualifications").insert(payload);
      }
    }
    if (res.error) return toast.error("Konnte nicht gespeichert werden");
    toast.success("Gespeichert");
    setIssued("");
    setUntil("");
    setNote("");
    void load();
  }

  async function remove(id: string) {
    const res = await db.from("trainer_qualifications").delete().eq("id", id);
    if (res.error) return toast.error("Konnte nicht gelöscht werden");
    void load();
  }

  if (!ready) return null;

  const have = new Set(rows.map((r) => r.kind));
  const missing = QUALIFICATION_KINDS.filter((k) => k.required && !have.has(k.value));
  const due = rows.filter((r) => {
    const d = daysUntil(r.valid_until, today);
    return d !== null && d <= QUALIFICATION_WARN_DAYS;
  }).length;
  const attention = due + missing.length;

  return (
    <CollapsibleCard
      className="border-0 shadow-soft"
      storageKey="trainer-qualifications"
      defaultOpen={attention > 0}
      title="Meine Nachweise"
      subtitle="Erste Hilfe, Führungszeugnis & Co. – wir erinnern dich rechtzeitig"
      meta={
        attention > 0 ? (
          <Badge variant="destructive">{attention} offen</Badge>
        ) : rows.length > 0 ? (
          <Badge variant="secondary">{rows.length}</Badge>
        ) : undefined
      }
    >
      {missing.length > 0 && (
        <p className="mb-3 rounded-md border border-amber-400/60 bg-amber-50/50 p-3 text-sm dark:bg-amber-950/10">
          Bitte noch eintragen: {missing.map((m) => m.label).join(", ")}.
        </p>
      )}
      {rows.length > 0 && (
        <div className="mb-4 divide-y rounded-md border">
          {rows.map((r) => {
            const d = daysUntil(r.valid_until, today);
            const warn = d !== null && d <= QUALIFICATION_WARN_DAYS;
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3 p-3">
                {warn ? (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                ) : (
                  <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {r.kind === "sonstiges" && r.note ? r.note : qualificationLabel(r.kind)}
                  </div>
                  <div className={`text-xs ${warn ? "text-destructive" : "text-muted-foreground"}`}>
                    {r.issued_on ? `ausgestellt ${formatDateBerlin(r.issued_on)}` : ""}
                    {r.issued_on && r.valid_until ? " · " : ""}
                    {r.valid_until
                      ? d! < 0
                        ? `abgelaufen seit ${formatDateBerlin(r.valid_until)}`
                        : `gültig bis ${formatDateBerlin(r.valid_until)}`
                      : r.issued_on
                        ? ""
                        : "ohne Datum"}
                    {r.note && r.kind !== "sonstiges" ? ` · ${r.note}` : ""}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`${qualificationLabel(r.kind)} entfernen`}
                  title="Entfernen"
                  onClick={() => void remove(r.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="qual-kind" className="mb-1 block text-xs text-muted-foreground">
            Nachweis
          </label>
          <select
            id="qual-kind"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {QUALIFICATION_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="qual-issued" className="mb-1 block text-xs text-muted-foreground">
            Ausgestellt am
          </label>
          <Input
            id="qual-issued"
            type="date"
            value={issued}
            onChange={(e) => setIssued(e.target.value)}
          />
        </div>
        {info?.years ? (
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Gilt {info.years} Jahre
            {computed ? ` – läuft ab am ${formatDateBerlin(computed)}.` : " ab Ausstellung."}
          </p>
        ) : (
          <div>
            <label htmlFor="qual-until" className="mb-1 block text-xs text-muted-foreground">
              Gültig bis (falls befristet)
            </label>
            <Input
              id="qual-until"
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </div>
        )}
      </div>
      <Input
        className="mt-3"
        placeholder={
          kind === "sonstiges"
            ? "Bezeichnung, z. B. Fachkraft für Kleinkindpädagogik"
            : "Notiz (optional)"
        }
        aria-label="Notiz zum Nachweis"
        value={note}
        maxLength={120}
        onChange={(e) => setNote(e.target.value)}
      />
      <Button className="mt-3 min-h-11" onClick={() => void save()}>
        Speichern
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">
        Den Nachweis selbst gibst du weiter wie bisher beim Vorstand ab. Der Vorstand sieht hier nur
        die Daten und hakt die Prüfung ab.
      </p>
    </CollapsibleCard>
  );
}
