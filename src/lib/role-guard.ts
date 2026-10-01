import { supabase } from "@/integrations/supabase/client";
import {
  assertHasAnyRole as assertHasAnyRoleOnServer,
  getMyAdminRoles as getMyAdminRolesOnServer,
} from "@/lib/admin-guard.functions";
import type { Role } from "@/lib/nav-items";

const ADMIN_AREA_ROLES: Role[] = ["admin", "board", "trainer"];

/**
 * Liest die eigenen Rollen direkt aus der Datenbank (gleiche Quelle wie das Seitenmenü).
 * Die Datenbank-Regeln stellen sicher, dass jede Person nur ihre eigenen Rollen sieht.
 */
async function readOwnRoles(): Promise<Role[] | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
  if (error) return null;
  return (data ?? []).map((r) => r.role as Role);
}

/**
 * Zugangsprüfung für Trainer- und Verwaltungsseiten.
 * Zuerst die Prüfung auf dem Server. Scheitert sie aus technischen Gründen (Server nicht erreichbar,
 * Konfiguration unvollständig), zählt die Rollenabfrage in der Datenbank – sonst würde man trotz
 * Berechtigung stillschweigend zurück ins Portal geschickt. Die eigentlichen Daten bleiben in jedem
 * Fall durch die Datenbank-Regeln und die Prüfungen der Server-Funktionen geschützt.
 */
export async function assertHasAnyRole({ data }: { data: { roles: Role[] } }) {
  try {
    return await assertHasAnyRoleOnServer({ data });
  } catch (serverError) {
    const roles = await readOwnRoles();
    if (roles?.some((r) => data.roles.includes(r))) {
      console.warn(
        "Rollenprüfung auf dem Server fehlgeschlagen, Rollen aus der Datenbank verwendet:",
        serverError,
      );
      return { ok: true as const };
    }
    throw serverError;
  }
}

export async function getMyAdminRoles(): Promise<{ roles: Role[] }> {
  try {
    const res = await getMyAdminRolesOnServer();
    return { roles: res.roles as Role[] };
  } catch (serverError) {
    const roles = await readOwnRoles();
    if (roles?.some((r) => ADMIN_AREA_ROLES.includes(r))) {
      console.warn(
        "Rollenabfrage auf dem Server fehlgeschlagen, Rollen aus der Datenbank verwendet:",
        serverError,
      );
      return { roles };
    }
    throw serverError;
  }
}
