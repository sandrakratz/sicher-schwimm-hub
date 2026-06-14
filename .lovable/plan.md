## Ziel

1. Jede Admin-Route bekommt einen serverseitigen Auth-Guard, der nur die wirklich nötigen Rollen zulässt (Minimalprinzip).
2. Trainer dürfen einen reduzierten Adminbereich sehen: nur die Mitgliederliste (read-only) und die Kursverwaltung.
3. Mitglieder und Eltern haben keinerlei Zugriff auf `/admin/*` – auch nicht via direkter URL.
4. Audit-Log: nur Admin. Wird ab jetzt bei relevanten Aktionen automatisch gefüllt.

## Rollenmatrix


| Route                     | admin    | board    | trainer                         | member/parent |
| ------------------------- | -------- | -------- | ------------------------------- | ------------- |
| `/admin` (Übersicht)      | ✓        | ✓        | – (Redirect auf `/admin/kurse`) | ✗             |
| `/admin/benutzer`         | ✓ (voll) | ✓ (voll) | ✗                               | ✗             |
| `/admin/mitgliedschaften` | ✓        | ✓        | ✗                               | ✗             |
| `/admin/kurse`            | ✓        | ✓        | ✓                               | ✗             |
| `/admin/anfragen`         | ✓        | ✓        | ✗                               | ✗             |
| `/admin/news`             | ✓        | ✓        | ✓                               | ✗             |
| `/admin/dokumente`        | ✓        | ✓        | ✓                               | ✗             |
| `/admin/events`           | ✓        | ✓        | ✗                               | ✗             |
| `/admin/nachrichten`      | ✓        | ✓        | ✗                               | ✗             |
| `/admin/audit`            | ✓        | ✗        | ✗                               | ✗             |


Nicht autorisierte Aufrufe → Redirect auf `/portal`.

## Umsetzung

### 1. Server-Guards (`src/lib/admin-guard.functions.ts`)

Neben `assertIsStaff` ergänzen:

- `assertHasAnyRole(roles: app_role[])` – generischer Guard, wirft 403 wenn der eingeloggte Nutzer keine der Rollen hat.
- `getAdminRoles()` – gibt dem Client die Rollenmenge des aktuellen Users zurück (für Sidebar-Filter und Read-only-UI in `benutzer.tsx`).
- `assertIsAdmin()` – Convenience für reine Admin-Routen (Audit).

Jede Admin-Route ruft im `beforeLoad` den passenden Guard auf. Die Layout-Route `_authenticated/admin/route.tsx` öffnet sich für `admin | board | trainer`; feinere Differenzierung passiert in den Kind-Routen.

### 2. RLS-Migration

- `audit_logs`: `INSERT` für `authenticated` erlauben (Logger schreibt im Auth-Kontext), SELECT bleibt auf Staff – zusätzlich auf **nur Admin** verschärfen via `has_role(auth.uid(),'admin')`.
- `courses` und `course_participants`: `is_staff` reicht für Trainer nicht. Neue Policies: Trainer dürfen lesen + schreiben (`has_role(auth.uid(),'trainer') OR is_staff(...)`).
- `profiles`: SELECT zusätzlich für Trainer auf aktive Mitglieder erlauben: `is_staff(auth.uid()) OR (has_role(auth.uid(),'trainer') AND status='active')`.
- `user_roles`: Trainer darf SELECT (für Anzeige in Mitgliederliste); UPDATE/DELETE bleibt Staff.
- GRANT-Statements werden mitgeliefert.

### 3. Audit-Logger

Neuer Server-Helper `src/lib/audit.server.ts` mit `logAudit({ action, entity, entity_id?, metadata? })`. Wird aufgerufen in:

- `admin-users.functions.ts` → `user.deleted`
- `membership.functions.ts` → `membership.approved`, `membership.rejected`, `membership.deleted`
- `course-assignment.functions.ts` → `course.participant.assigned`
- Rollen-Änderungen in `benutzer.tsx` → neuer Server-Fn `setUserRole` / `setUserStatus`, der Audit schreibt (statt direktem `supabase.from('user_roles')`-Call vom Client). So sind die wichtigsten Mutationen serverseitig protokollierbar.

### 4. UI-Anpassungen

`**_authenticated/admin/route.tsx**`

- `beforeLoad` ruft `getAdminRoles()` und speichert die Rollenmenge im Route-Context.
- Sidebar filtert `adminNav` nach Rollen: Trainer sieht nur „Benutzer" (umbenannt zu „Mitglieder") und „Kurse". Admin sieht zusätzlich „Audit-Log".
- Falls Trainer auf `/admin` landet → Redirect auf `/admin/benutzer`.

`**_authenticated/admin/benutzer.tsx**`

- Liest Rollen aus Route-Context via `Route.useRouteContext()`.
- Trainer-Modus: Liste filtert auf `status='active'` und Rollen enthält `member`, Spalten reduziert (Name, E-Mail, Telefon), keine Delete-/Status-/Rollen-Buttons, kein Detail-Edit-Dialog (nur Anzeige). Suchfeld bleibt.
- Admin/Board: unverändert, zusätzlich Aufrufe gehen über neue Server-Fns (`setUserRole`, `setUserStatus`) mit Audit.

**Übrige Admin-Routen**

- `beforeLoad` mit `assertHasAnyRole([...])` gemäß Matrix. Keine UI-Änderungen.

### 5. Edge Cases

- Layout-Route ist `ssr:false`; Guards laufen client-seitig + werden vom serverseitigen `assertHasAnyRole` bei jeder Server-Fn-Aktion zusätzlich erzwungen. Selbst manipuliertes JS kann keine geschützte Aktion auslösen.
- Bestehender Test, dass nicht-Staff weiterhin auf `/portal` umgeleitet wird, bleibt durch `_authenticated/route.tsx` (status-check) gewahrt.

## Geänderte / neue Dateien

- `supabase/migrations/<neu>.sql` (RLS + GRANTs)
- `src/lib/admin-guard.functions.ts` (erweitert)
- `src/lib/audit.server.ts` (neu)
- `src/lib/admin-users.functions.ts` (Audit + neue `setUserRole`, `setUserStatus`)
- `src/lib/membership.functions.ts` (Audit bei approve/reject/delete – falls noch nicht serverseitig, dann neu)
- `src/routes/_authenticated/admin/route.tsx` (Rollen im Context, Sidebar-Filter, Redirect)
- `src/routes/_authenticated/admin/{index,mitgliedschaften,kurse,anfragen,news,dokumente,events,nachrichten,audit}.tsx` (jeweils `beforeLoad` mit passendem Guard)
- `src/routes/_authenticated/admin/benutzer.tsx` (Trainer-Read-only-Modus + Server-Fn-Aufrufe)