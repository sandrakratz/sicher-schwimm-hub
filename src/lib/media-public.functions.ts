import { createServerFn } from "@tanstack/react-start";

/**
 * Liefert einen kurzlebigen Link zu einem Bild/PDF, aber nur wenn die Datei
 * zu einer veröffentlichten, öffentlichen News oder einem öffentlichen Termin gehört.
 */
export const getPublicMediaUrl = createServerFn({ method: "POST" })
  .inputValidator((input: { path: string }) => {
    const path = String(input?.path ?? "");
    if (!path || path.length > 300 || path.includes("..")) throw new Error("Ungültiger Pfad.");
    return { path };
  })
  .handler(async ({ data }): Promise<{ url: string | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: news }, { data: events }] = await Promise.all([
      supabaseAdmin.from("news").select("id").eq("image_url", data.path).eq("visibility", "public").eq("published", true).limit(1),
      supabaseAdmin.from("events").select("id").eq("image_url", data.path).eq("visibility", "public").limit(1),
    ]);
    if (!news?.length && !events?.length) return { url: null };
    const { data: signed } = await supabaseAdmin.storage.from("media").createSignedUrl(data.path, 60 * 60);
    return { url: signed?.signedUrl ?? null };
  });
