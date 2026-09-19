import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { MediaAttachment } from "@/components/MediaAttachment";

const ALLOWED = ["image/jpeg", "image/png", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024;

type Props = {
  folder: "news" | "events";
  value?: string | null;
  mime?: string | null;
  alt?: string | null;
  onChange: (v: { image_url: string | null; image_mime: string | null }) => void;
  onAltChange: (alt: string) => void;
};

export function MediaUploadField({ folder, value, mime, alt, onChange, onAltChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!f) return;
    if (!ALLOWED.includes(f.type)) return toast.error("Nur JPG, PNG oder PDF möglich");
    if (f.size > MAX_BYTES) return toast.error("Datei darf höchstens 10 MB groß sein");

    setBusy(true);
    const path = `${folder}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const { error } = await supabase.storage.from("media").upload(path, f, { upsert: false, contentType: f.type });
    if (error) { setBusy(false); return toast.error(error.message); }
    // Alte Datei bleibt bestehen, bis gespeichert wird – sonst wäre sie beim Abbrechen verloren.
    onChange({ image_url: path, image_mime: f.type });
    setBusy(false);
    toast.success("Datei hochgeladen");
  }

  function removeFile() {
    if (!value) return;
    // Nur aus dem Formular entfernen; endgültig gelöscht wird erst beim Speichern.
    onChange({ image_url: null, image_mime: null });
  }

  return (
    <div className="space-y-2">
      <Label>Bild oder PDF (JPG, PNG, PDF – max. 10 MB)</Label>
      <div className="flex items-center gap-2">
        <Input ref={fileRef} type="file" accept="image/jpeg,image/png,application/pdf" onChange={onPick} disabled={busy} />
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={removeFile} disabled={busy}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
      {value && (
        <>
          <MediaAttachment path={value} mime={mime} alt={alt} className="max-w-sm" />
          <div>
            <Label>Bildtext (optional)</Label>
            <Input value={alt || ""} onChange={e => onAltChange(e.target.value)} placeholder="Kurze Beschreibung des Bildes" />
          </div>
        </>
      )}
    </div>
  );
}
