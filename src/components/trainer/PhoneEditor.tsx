import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { updateParticipantPhone } from "@/lib/trainer-courses.functions";
import { toast } from "sonner";

/**
 * Telefonnummer der Eltern anzeigen und (falls nötig) nacherfassen.
 * Die Nummer wird auch in die zugehörige Kursanfrage übernommen.
 */
export function PhoneEditor({
  participantId,
  phone,
  onSaved,
}: {
  participantId: string;
  phone: string | null;
  onSaved?: (phone: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(phone ?? "");
  const [saving, setSaving] = useState(false);
  const save = useServerFn(updateParticipantPhone);

  const submit = async () => {
    setSaving(true);
    try {
      const res = await save({ data: { participantId, phone: value } });
      onSaved?.(res.phone);
      setEditing(false);
      toast.success("Telefonnummer gespeichert");
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="tel"
          inputMode="tel"
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="z. B. 0170 1234567"
          className="h-10 w-48"
        />
        <Button size="sm" onClick={submit} disabled={saving}>
          {saving ? "Speichert…" : "Speichern"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setValue(phone ?? "");
            setEditing(false);
          }}
          disabled={saving}
        >
          Abbrechen
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {phone ? (
        <a href={`tel:${phone}`} className="flex items-center gap-2 text-primary">
          <Phone className="h-4 w-4" /> {phone}
        </a>
      ) : (
        <span className="text-xs text-muted-foreground">Keine Telefonnummer hinterlegt</span>
      )}
      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
        {phone ? "Ändern" : "Nachtragen"}
      </Button>
    </div>
  );
}

export default PhoneEditor;
