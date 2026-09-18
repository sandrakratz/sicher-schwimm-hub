import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText } from "lucide-react";

export function useMediaUrl(path?: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!path) { setUrl(null); return; }
    supabase.storage.from("media").createSignedUrl(path, 60 * 60).then(({ data }) => {
      if (active) setUrl(data?.signedUrl ?? null);
    });
    return () => { active = false; };
  }, [path]);
  return url;
}

type Props = {
  path?: string | null;
  alt?: string | null;
  mime?: string | null;
  className?: string;
};

/** Zeigt ein hochgeladenes Bild oder eine PDF-Kachel zu News/Terminen. */
export function MediaAttachment({ path, alt, mime, className }: Props) {
  const url = useMediaUrl(path);
  if (!path) return null;

  const isPdf = (mime || "").includes("pdf") || path.toLowerCase().endsWith(".pdf");
  const name = path.split("/").pop() || "Datei";

  if (isPdf) {
    return (
      <a
        href={url || undefined}
        target="_blank"
        rel="noreferrer"
        className={`mt-3 inline-flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm font-medium hover:bg-muted transition-colors ${className || ""}`}
      >
        <FileText className="h-5 w-5 text-primary" />
        <span className="truncate max-w-[18rem]">{alt || name}</span>
      </a>
    );
  }

  if (!url) return null;

  return (
    <a href={url} target="_blank" rel="noreferrer" className={`block mt-3 ${className || ""}`}>
      <img
        src={url}
        alt={alt || ""}
        loading="lazy"
        className="w-full rounded-lg border object-contain max-h-[36rem] bg-muted/30"
      />
    </a>
  );
}
