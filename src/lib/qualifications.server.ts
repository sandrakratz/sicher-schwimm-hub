/* eslint-disable @typescript-eslint/no-explicit-any -- neue Tabellen sind noch nicht in den generierten Typen */
// Nachweise aller Trainer:innen laden – genutzt von der Seite „Qualifikationen“ und vom Excel-Export.
// Nur serverseitig; die Berechtigung prüft der Aufrufer.
import { fetchIn } from "@/lib/fetch-all";
import { checkKeyOf } from "@/lib/trainer-qualifications";
import { fullName } from "@/lib/format";
import type { QualificationOverviewRow } from "@/lib/trainer-extras.functions";

export async function loadQualificationOverview(): Promise<QualificationOverviewRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { fetchAll } = await import("@/lib/fetch-all");

  const { data: roleRows, error: roleErr } = await db
    .from("user_roles")
    .select("user_id")
    .eq("role", "trainer");
  if (roleErr) throw new Error(roleErr.message);
  const ids = [...new Set<string>((roleRows ?? []).map((r: any) => r.user_id as string))];

  const profiles = await fetchIn<any>(ids, (chunk, f, t) =>
    db
      .from("profiles")
      .select("id,first_name,last_name,email")
      .in("id", chunk)
      .order("id")
      .range(f, t),
  );
  const quals = await fetchAll<any>((f, t) =>
    db
      .from("trainer_qualifications")
      .select("id,trainer_id,kind,issued_on,valid_until,note")
      .order("trainer_id")
      .order("kind")
      .order("id")
      .range(f, t),
  );
  const checks = await fetchAll<any>((f, t) =>
    db
      .from("trainer_qualification_checks")
      .select("trainer_id,kind,stamp")
      .order("trainer_id")
      .order("kind")
      .range(f, t),
  ).catch(() => [] as any[]);
  const stampOf = new Map(checks.map((c) => [`${c.trainer_id}|${c.kind}`, c.stamp as string]));

  return profiles
    .map((p) => ({
      trainerId: p.id as string,
      name: fullName(p.first_name, p.last_name) || (p.email as string) || "?",
      email: (p.email as string) ?? "",
      qualifications: quals
        .filter((q) => q.trainer_id === p.id)
        .map((q) => ({
          id: q.id as string,
          kind: q.kind as string,
          issued_on: (q.issued_on as string) ?? null,
          valid_until: (q.valid_until as string) ?? null,
          note: (q.note as string) ?? null,
          checked:
            stampOf.get(`${p.id}|${checkKeyOf(q.kind, q.id)}`) ===
            `${q.issued_on ?? ""}|${q.valid_until ?? ""}`,
        })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}
