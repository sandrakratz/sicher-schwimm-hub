import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Pencil, Send } from "lucide-react";
import { ConversationTimeline } from "@/components/admin/ConversationTimeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateBerlin, formatDateTimeBerlin } from "@/lib/format";
import { replyToWaitlistEntry } from "@/lib/waitlist-reply.functions";
import type { WaitlistEntry } from "./logic";
import type { EntryPatch } from "./useWaitlistMutations";

function Row({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined || value === "") return null;
  const text = typeof value === "boolean" ? (value ? "Ja" : "Nein") : String(value);
  return (
    <div className="grid grid-cols-[11rem_1fr] gap-2 border-b py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="whitespace-pre-wrap">{text}</span>
    </div>
  );
}

type Form = {
  childName: string;
  childDob: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  isMember: "" | "yes" | "no";
  notes: string;
  availableFrom: string;
};

const formOf = (e: WaitlistEntry | null): Form => ({
  childName: e?.child_name ?? "",
  childDob: e?.child_dob ?? "",
  parentName: e?.parent_name ?? "",
  parentEmail: e?.parent_email ?? "",
  parentPhone: e?.parent_phone ?? "",
  isMember: e?.is_member === true ? "yes" : e?.is_member === false ? "no" : "",
  notes: e?.notes ?? "",
  availableFrom: e?.available_from ?? "",
});

/**
 * Originalanfrage eines Eintrags mit Bearbeiten, Verlauf und Rückfrage per E-Mail.
 * Beim Wechsel des Eintrags mit neuem `key` rendern, dann starten Formular und Entwurf leer.
 */
export function OriginalRequestDialog({
  entry,
  onClose,
  onSave,
  saving,
}: {
  entry: WaitlistEntry | null;
  onClose: () => void;
  onSave: (patch: EntryPatch) => void;
  saving: boolean;
}) {
  const r = entry?.request ?? null;
  const g = (k: string) => (r ? r[k] : (entry as Record<string, unknown> | null)?.[k]) ?? null;

  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(() => formOf(entry));
  const [note, setNote] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const replyFn = useServerFn(replyToWaitlistEntry);
  const reply = useMutation({
    mutationFn: (entryId: string) =>
      replyFn({ data: { entryId, body: replyBody, subject: replySubject } }),
    onSuccess: () => {
      toast.success("E-Mail gesendet");
      setReplyBody("");
      setReplySubject("");
      setReloadKey((k) => k + 1);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Senden fehlgeschlagen"),
  });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const field = (k: keyof Form, label: string, type?: string) => (
    <label className="text-sm">
      {label}
      <Input type={type} value={form[k]} onChange={(e) => set(k, e.target.value)} />
    </label>
  );

  const missing: string[] = [];
  if (!form.childDob) missing.push("Geburtsdatum");
  if (!form.parentPhone) missing.push("Telefon");

  function save() {
    if (!entry) return;
    onSave({
      entryId: entry.id,
      childName: form.childName.trim() || undefined,
      childDob: form.childDob || null,
      parentName: form.parentName.trim() || undefined,
      parentEmail: form.parentEmail.trim() || undefined,
      parentPhone: form.parentPhone.trim() || null,
      isMember: form.isMember === "yes" ? true : form.isMember === "no" ? false : null,
      notes: form.notes.trim() || null,
      availableFrom: form.availableFrom || null,
      ...(note.trim() ? { appendNote: note.trim() } : {}),
    });
  }

  return (
    <Dialog open={!!entry} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Anfrage – {entry?.child_name ?? ""}</DialogTitle>
          <DialogDescription>
            {r
              ? "Ursprüngliche Kursanfrage über das Anfrageformular."
              : "Direkte Anmeldung über das Wartelisten-Formular."}
          </DialogDescription>
        </DialogHeader>
        {entry && (
          <div className="space-y-3">
            {!!entry.blocked_reason && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Auf der Sperrliste: {entry.blocked_reason}</span>
              </div>
            )}
            {missing.length > 0 && (
              <div className="flex items-start gap-2 rounded-md bg-amber-100 p-2 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Unvollständig – es fehlen: {missing.join(", ")}</span>
              </div>
            )}

            {edit ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {field("childName", "Kind")}
                {field("childDob", "Geburtsdatum", "date")}
                {field("parentName", "Eltern")}
                {field("parentEmail", "E-Mail", "email")}
                {field("parentPhone", "Telefon")}
                <label className="text-sm">
                  Mitglied
                  <NativeSelect
                    className="mt-1 w-full"
                    value={form.isMember}
                    onChange={(e) => set("isMember", e.target.value as Form["isMember"])}
                  >
                    <option value="">Unbekannt</option>
                    <option value="yes">Ja</option>
                    <option value="no">Nein</option>
                  </NativeSelect>
                </label>
                <label className="text-sm">
                  Erst zuteilen ab (Zurückstellung)
                  <Input
                    type="date"
                    value={form.availableFrom}
                    onChange={(e) => set("availableFrom", e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">
                    Leer = sofort. Nur Kurse ab diesem Datum werden angeboten.
                  </span>
                </label>
                <label className="text-sm sm:col-span-2">
                  Angaben der Eltern / Gesundheitshinweise
                  <Textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => set("notes", e.target.value)}
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  Neue interne Notiz (wird mit Datum ergänzt)
                  <Textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="z. B. Eltern telefonisch erreicht…"
                  />
                </label>
                <div className="flex gap-2 sm:col-span-2">
                  <Button size="sm" onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Speichern
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEdit(false)}>
                    Abbrechen
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <Row label="Eingang" value={formatDateTimeBerlin(entry.created_at)} />
                  <Row label="Kind" value={entry.child_name} />
                  <Row
                    label="Geburtsdatum"
                    value={entry.child_dob ? formatDateBerlin(entry.child_dob) : null}
                  />
                  <Row label="Eltern" value={entry.parent_name} />
                  <Row label="E-Mail" value={entry.parent_email} />
                  <Row label="Telefon" value={entry.parent_phone} />
                  <Row label="Kurswunsch" value={g("desired_course")} />
                  <Row label="Schwimmniveau" value={g("swimming_level")} />
                  <Row label="Gesundheitliche Hinweise" value={g("health_info")} />
                  <Row label="Angaben der Eltern" value={entry.notes ?? g("message")} />
                  <Row
                    label="Mitglied"
                    value={
                      entry.is_member ??
                      (entry.member_claimed ? "angegeben, nicht bestätigt – bitte prüfen" : null)
                    }
                  />
                  <Row
                    label="Erst zuteilen ab"
                    value={entry.available_from ? formatDateBerlin(entry.available_from) : null}
                  />
                  <Row
                    label="Datenschutz zugestimmt"
                    value={entry.gdpr_consent ?? g("gdpr_consent")}
                  />
                  <Row label="Kontaktaufnahme erlaubt" value={g("contact_permission")} />
                  <Row label="Interne Notizen" value={entry.admin_notes} />
                  {r && <Row label="Anfrage-ID" value={r["id"]} />}
                </div>
                <Button size="sm" variant="outline" onClick={() => setEdit(true)}>
                  <Pencil className="mr-2 h-4 w-4" /> Daten ergänzen / Notiz hinzufügen
                </Button>
              </>
            )}

            <ConversationTimeline
              kind="waitlist"
              id={entry.id}
              reloadKey={reloadKey}
              original={{
                title: `Wartelisten-Eintrag${entry.child_name ? ` – ${entry.child_name}` : ""}`,
                when: entry.created_at ?? "",
                from: `${entry.parent_name ?? ""} <${entry.parent_email ?? ""}>`,
                body: String(entry.notes ?? g("message") ?? "—"),
              }}
            />

            <div className="space-y-2 rounded-md border p-3">
              <h3 className="font-semibold">Rückfrage an die Familie senden</h3>
              <p className="text-xs text-muted-foreground">
                Die E-Mail geht an {entry.parent_email} und erscheint anschließend im Verlauf.
              </p>
              <label className="block text-sm">
                Betreff (optional)
                <Input
                  value={replySubject}
                  maxLength={300}
                  onChange={(e) => setReplySubject(e.target.value)}
                  placeholder={`Rückfrage zu Ihrem Wartelisten-Eintrag – ${entry.child_name ?? ""}`}
                />
              </label>
              <label className="block text-sm">
                Nachricht
                <Textarea
                  rows={5}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Ihre Rückfrage an die Eltern …"
                />
              </label>
              <Button
                size="sm"
                disabled={reply.isPending || replyBody.trim().length < 2 || !entry.parent_email}
                onClick={() => reply.mutate(entry.id)}
              >
                {reply.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                E-Mail senden
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
