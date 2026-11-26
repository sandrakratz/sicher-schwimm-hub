import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  ShieldBan,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { TableCell, TableRow } from "@/components/ui/table";
import { addDaysIso, formatDateBerlin, todayBerlinIso } from "@/lib/format";
import { matchProgram, meetsMinAge, minAgeReachedOn, withinMaxAge } from "@/lib/waitlist-age";
import {
  PAYMENT_LABEL,
  STATUS_LABEL,
  courseFitsEntry,
  declineTone,
  fitProblems,
  programOf,
  type WaitlistData,
  type WaitlistEntry,
} from "./logic";
import { confirmFit, confirmTooYoung } from "./confirm";
import { EntryAssign, SuggestionActions } from "./ui";
import { UnregisterDialog } from "./UnregisterDialog";
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog";
import { MoreMenu } from "@/components/admin/MoreMenu";
import type { WaitlistMutations } from "./useWaitlistMutations";

const CELL = "py-2 pr-3 pl-0";
const LINK_SMALL = "mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary";

function PaymentCell({ entry }: { entry: WaitlistEntry }) {
  const booking = entry.booking;
  const p = PAYMENT_LABEL[entry.payment_status] ?? PAYMENT_LABEL["none"]!;
  return (
    <div className="space-y-1">
      <Badge className={p.className} variant="secondary">
        {p.label}
      </Badge>
      {booking?.price_amount != null && (
        <div className="text-xs text-muted-foreground">
          {Number(booking.price_amount).toFixed(2).replace(".", ",")} €
        </div>
      )}
      {booking?.paid_at ? (
        <div className="text-xs text-muted-foreground">
          bezahlt am {formatDateBerlin(booking.paid_at)}
        </div>
      ) : booking?.payment_due_date ? (
        <div className="text-xs text-muted-foreground">
          fällig {formatDateBerlin(booking.payment_due_date)}
        </div>
      ) : null}
    </div>
  );
}

/** Interne Notiz; mit `key` = gespeicherte Notiz rendern, damit neue Daten den Entwurf ersetzen. */
function NotesCell({
  parentNote,
  adminNote,
  onSave,
}: {
  parentNote: string | null;
  adminNote: string | null;
  onSave: (adminNotes: string) => void;
}) {
  const [value, setValue] = useState(adminNote ?? "");
  return (
    <div className="space-y-1">
      {parentNote && (
        <p className="whitespace-pre-wrap text-xs text-muted-foreground">{parentNote}</p>
      )}
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Interne Notiz…"
        rows={2}
        className="min-h-[3rem] text-xs"
      />
      {(adminNote ?? "") !== value && (
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onSave(value)}>
          Notiz speichern
        </Button>
      )}
    </div>
  );
}

/** Eine Zeile der Anfrageliste (plus aufklappbare Details). */
export function EntryRow({
  e,
  data,
  courseName,
  open,
  onToggle,
  onDetail,
  onDecline,
  m,
}: {
  e: WaitlistEntry;
  data: WaitlistData | undefined;
  courseName: (id: unknown) => string;
  open: boolean;
  onToggle: () => void;
  onDetail: () => void;
  onDecline: () => void;
  m: WaitlistMutations;
}) {
  const programs = data?.programs ?? [];
  const minAge = programOf(programs, e.program_id)?.min_age_years ?? null;
  const wish = e.desired_course;
  // Vorschlag nur aus Angeboten, die vom Alter her passen (nicht zu alt, spätestens in einem Jahr alt genug)
  const today = todayBerlinIso();
  const ageFits = (p: (typeof programs)[number]) =>
    withinMaxAge(e.child_dob, today, p.max_age_years ?? null) &&
    meetsMinAge(e.child_dob, addDaysIso(today, 365), p.min_age_years ?? null);
  const suggestion = !e.program_id ? matchProgram(wish ?? e.notes, programs.filter(ageFits)) : null;
  const readyOn = minAgeReachedOn(e.child_dob, minAge);
  // Direktbuchung: der Vorstand darf auch volle Kurse überbuchen (Platzangebote nur für freie Plätze)
  const bookCourses = (data?.courses ?? [])
    .map((c) => ({ ...c, fits: courseFitsEntry(e, c, programs) }))
    .sort((a, b) => Number(b.fits) - Number(a.fits));
  const courses = bookCourses.filter((c) => c.free !== 0);
  const tooYoungEverywhere =
    !!e.child_dob &&
    minAge != null &&
    courses.length > 0 &&
    courses.every((c) => !meetsMinAge(e.child_dob, c.starts_on, minAge));
  const issues = fitProblems(e, data);
  const update = m.update.mutate;

  const offerTo = (courseId: string) => {
    const c = courses.find((x) => x.id === courseId);
    if (!c) return;
    if (!meetsMinAge(e.child_dob, c.starts_on, minAge) && !confirmTooYoung(e)) return;
    const af = e.available_from;
    if (
      af &&
      (!c.starts_on || c.starts_on < af) &&
      !confirm(`${e.child_name} ist zurückgestellt bis ${formatDateBerlin(af)}. Trotzdem anbieten?`)
    )
      return;
    if (!confirmFit(e, programOf(programs, c.program_id), "anbieten")) return;
    m.offer.mutate({ entryId: e.id, courseId });
  };

  const bookInto = (courseId: string) => {
    const c = bookCourses.find((x) => x.id === courseId);
    if (
      !confirm(
        `${e.child_name} verbindlich in „${c?.name ?? "Kurs"}“ buchen${c?.free === 0 ? " (Kurs ist voll – Überbuchung)" : ""}? Die Eltern erhalten sofort die Buchungsbestätigung mit Zahlungsdetails.`,
      )
    )
      return;
    if (c && !confirmFit(e, programOf(programs, c.program_id), "buchen")) return;
    m.bookDirect.mutate({ entryId: e.id, courseId });
  };

  // Kurs für „Platz anbieten“ bzw. „Direkt buchen“: erst wählen, dann per Knopf auslösen
  const [pick, setPick] = useState("");
  const pickedOfferable = !!pick && courses.some((c) => c.id === pick);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Abmelden mit Grund: Eintrag bleibt als „Abgemeldet“ erhalten, Grund mit Zeitstempel in der Notiz.
  // Bei offenem Angebot gibt es stattdessen „Absage erfassen“ (gibt den Platz sofort weiter).
  const [unregisterOpen, setUnregisterOpen] = useState(false);
  const canUnregister = ["waiting", "declined", "expired"].includes(e.status);
  const unregister = ({ reason, blocklist }: { reason: string; blocklist: boolean }) =>
    update(
      {
        entryId: e.id,
        status: "removed",
        appendNote: `Abgemeldet – Grund: ${reason}`,
        ...(blocklist ? { blocklist: true, blocklistReason: reason } : {}),
      },
      {
        onSuccess: () => {
          setUnregisterOpen(false);
          toast.success(
            blocklist ? "Abgemeldet und gesperrt" : "Abgemeldet – der Grund steht in der Notiz",
          );
        },
      },
    );

  const st = STATUS_LABEL[e.status] ?? { label: e.status, className: "" };
  const fu = e.follow_up_on;

  return (
    <>
      <TableRow className="border-b align-top">
        <TableCell className={`${CELL} font-medium`}>
          <button
            type="button"
            className="text-left text-primary underline underline-offset-2"
            title="Originalanfrage anzeigen"
            onClick={onDetail}
          >
            {e.child_name}
          </button>
          {e.child_dob && (
            <div className="text-xs text-muted-foreground">{formatDateBerlin(e.child_dob)}</div>
          )}
          {e.blocked_reason && (
            <div className="mt-1 flex items-center gap-1 text-xs text-destructive">
              <ShieldBan className="h-3 w-3" /> Sperrliste
            </div>
          )}
          {e.available_from && (
            <div className="mt-1 text-xs font-medium text-blue-700">
              ⏸ Zurückgestellt – erst Kurse ab {formatDateBerlin(e.available_from)}
            </div>
          )}
          {e.duplicate && (
            <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
              <Copy className="h-3 w-3" /> mögliche Dublette
            </div>
          )}
          <button type="button" className={LINK_SMALL} onClick={onDetail}>
            <FileText className="h-3 w-3" /> Details
          </button>
          <Link to="/admin/familie" search={{ email: e.parent_email ?? "" }} className={LINK_SMALL}>
            <Users className="h-3 w-3" /> Familie, Verlauf
          </Link>
          <button type="button" className={LINK_SMALL} onClick={onToggle}>
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Kurswunsch, Notiz, Zahlung
          </button>
        </TableCell>

        <TableCell className={CELL}>
          {e.parent_name}
          <div className="text-xs text-muted-foreground">{e.parent_email}</div>
          {e.parent_phone && <div className="text-xs text-muted-foreground">{e.parent_phone}</div>}
        </TableCell>
        <TableCell className={CELL}>
          <Badge className={st.className} variant="secondary">
            {st.label}
          </Badge>
          {fu && (
            <div className="mt-1 flex flex-wrap gap-1 text-xs">
              <Badge
                variant="secondary"
                className={
                  fu <= todayBerlinIso() ? "bg-red-100 text-red-900" : "bg-sky-100 text-sky-900"
                }
              >
                Wiedervorlage {formatDateBerlin(fu)}
              </Badge>
            </div>
          )}
          {issues && (
            <div className="mt-1 rounded border border-red-300 bg-red-50 p-1.5 text-xs text-red-900">
              Passt das? {issues.join("; ")}
            </div>
          )}
          {/* Ohne Kurswunsch gibt es nie ein automatisches Angebot – darum hier direkt sichtbar
              (dasselbe Feld steht auch in der aufgeklappten Zeile). */}
          {!e.program_id && ["waiting", "offered"].includes(e.status) && (
            <div className="mt-1 space-y-1 rounded border border-amber-300 bg-amber-50 p-1.5 text-xs text-amber-900">
              <label className="block font-semibold" htmlFor={`wish-${e.id}`}>
                Kurswunsch fehlt
              </label>
              <NativeSelect
                id={`wish-${e.id}`}
                size="xs"
                className="w-full bg-white"
                value=""
                onChange={(ev) =>
                  ev.target.value && update({ entryId: e.id, programId: ev.target.value })
                }
              >
                <option value="">Kursangebot wählen …</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
              {suggestion && (
                <button
                  type="button"
                  className="underline"
                  onClick={() => update({ entryId: e.id, programId: suggestion.id })}
                >
                  Vorschlag übernehmen: {suggestion.name}
                </button>
              )}
            </div>
          )}
          {e.payment_status !== "none" && (
            <div className="mt-1">
              <PaymentCell entry={e} />
            </div>
          )}
          {e.decline_count > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <Badge variant="secondary" className={declineTone(e.decline_count)}>
                {e.decline_count}× abgesagt{e.decline_count >= 3 ? " – deaktiviert" : ""}
              </Badge>
              <button
                type="button"
                className="text-xs text-primary underline"
                onClick={() => {
                  if (!confirm(`Absage-Zähler für ${e.child_name} auf 0 zurücksetzen?`)) return;
                  update({
                    entryId: e.id,
                    declineCount: 0,
                    appendNote: "Absage-Zähler vom Vorstand zurückgesetzt.",
                  });
                }}
              >
                Zähler zurücksetzen
              </button>
            </div>
          )}
          {e.declines_total > e.decline_count && (
            <div className="mt-1 text-xs text-muted-foreground">
              Gesamt {e.declines_total} Absagen (alle Einträge)
            </div>
          )}
          {e.block_suggestion && e.decline_count > 0 && (
            <div className="mt-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs">
              <p className="font-semibold text-red-900">Sperrliste prüfen</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <SuggestionActions
                  onBlock={() => {
                    if (
                      !confirm(
                        `${e.child_name} / ${e.parent_email} auf die Sperrliste setzen? Buchung und Warteliste sind dann gesperrt.`,
                      )
                    )
                      return;
                    update(
                      {
                        entryId: e.id,
                        blocklist: true,
                        blocklistReason: `Wiederholte Absagen (${e.declines_total})`,
                        appendNote: "Wegen wiederholter Absagen auf die Sperrliste gesetzt.",
                      },
                      { onSuccess: () => toast.success("Auf die Sperrliste gesetzt") },
                    );
                  }}
                  onDismiss={() =>
                    update({
                      entryId: e.id,
                      dismissBlockSuggestion: true,
                      appendNote: "Sperrvorschlag geprüft und ignoriert.",
                    })
                  }
                />
              </div>
            </div>
          )}
          {!!e.followup_expires_at && ["declined", "expired"].includes(e.status) && (
            <div className="mt-1 text-xs text-muted-foreground">
              Rückfrage läuft bis {formatDateBerlin(e.followup_expires_at)}
            </div>
          )}
          {e.status === "offered" && e.offer_expires_at && (
            <div className="mt-1 text-xs text-muted-foreground">
              {courseName(e.offer_course_id)} · Frist: {formatDateBerlin(e.offer_expires_at)}
            </div>
          )}
        </TableCell>
        <TableCell className={CELL}>
          <EntryAssign entry={e} />
        </TableCell>
        <TableCell className={CELL}>
          <div className="flex flex-col items-start gap-2">
            {/* Kurs nur auswählen; ausgelöst wird mit einem Knopf (Bedienregel 4) */}
            {e.status !== "accepted" && bookCourses.length > 0 && (
              <NativeSelect
                size="xs"
                className="w-72 max-w-full"
                value={pick}
                onChange={(ev) => setPick(ev.target.value)}
                aria-label="Kurs wählen"
              >
                <option value="">Kurs wählen …</option>
                {bookCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fits ? "" : "(anderes Angebot) "}
                    {c.name}
                    {c.free != null ? (c.free > 0 ? ` (${c.free} frei)` : " (voll)") : ""}
                    {!meetsMinAge(e.child_dob, c.starts_on, minAge) ? " – zu jung" : ""}
                  </option>
                ))}
              </NativeSelect>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {e.status === "waiting" && bookCourses.length > 0 && (
                <Button
                  size="sm"
                  disabled={!pickedOfferable || m.offer.isPending}
                  title={
                    !pick
                      ? "Erst oben einen Kurs wählen"
                      : !pickedOfferable
                        ? "Kurs ist voll – anbieten geht nur bei freien Plätzen (unter „Weitere“ direkt buchen)"
                        : "Die Eltern bekommen ein Platzangebot mit Frist per E-Mail"
                  }
                  onClick={() => offerTo(pick)}
                >
                  Platz anbieten
                </Button>
              )}
              {e.status === "offered" && (
                <Button
                  size="sm"
                  variant="outline"
                  title="Eltern haben das Angebot telefonisch oder per E-Mail abgelehnt"
                  onClick={onDecline}
                >
                  Absage erfassen
                </Button>
              )}
              {["offered", "declined", "expired", "removed"].includes(e.status) && (
                <Button
                  size="sm"
                  variant="outline"
                  title={
                    e.status === "offered"
                      ? "Angebot zurückziehen: Platz wird frei, die Familie wartet ab dem nächsten Kurs (zählt nicht als Absage)"
                      : "Familie wartet wieder (frühestens auf den nächsten Kurs)"
                  }
                  onClick={() => update({ entryId: e.id, status: "waiting" })}
                >
                  Wieder auf die Warteliste
                </Button>
              )}
              {canUnregister && (
                <Button size="sm" variant="outline" onClick={() => setUnregisterOpen(true)}>
                  Abmelden …
                </Button>
              )}
              <MoreMenu
                items={[
                  ...(e.status !== "accepted" && bookCourses.length > 0
                    ? [
                        {
                          label: "Direkt in den gewählten Kurs buchen",
                          hint: pick
                            ? "Verbindlich; die Buchungsbestätigung geht sofort an die Eltern"
                            : "Erst oben einen Kurs wählen",
                          disabled: !pick || m.bookDirect.isPending,
                          onSelect: () => bookInto(pick),
                        },
                      ]
                    : []),
                  {
                    label: "Eintrag löschen …",
                    hint: "Nur für Fehleinträge und Dubletten – die Spur geht verloren",
                    destructive: true,
                    onSelect: () => setDeleteOpen(true),
                  },
                ]}
              />
            </div>
          </div>
        </TableCell>
      </TableRow>
      {open && (
        <TableRow className="border-b bg-muted/30">
          <TableCell colSpan={5} className="p-3">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Kurswunsch</p>
                <NativeSelect
                  size="xs"
                  className="w-full"
                  value={e.program_id ?? ""}
                  onChange={(ev) => update({ entryId: e.id, programId: ev.target.value || null })}
                >
                  <option value="">Kein Wunschkurs</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
                {wish && <div className="mt-1 text-xs text-muted-foreground">Wunsch: {wish}</div>}
                {suggestion && (
                  <button
                    type="button"
                    className="mt-1 text-xs text-primary underline"
                    onClick={() => update({ entryId: e.id, programId: suggestion.id })}
                  >
                    Vorschlag übernehmen: {suggestion.name}
                  </button>
                )}
                {readyOn && (
                  <div className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                    <span>
                      Mindestalter erreicht ab {formatDateBerlin(readyOn)}
                      {tooYoungEverywhere ? " – aktuell kein passender Kursstart" : ""}
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Notiz</p>
                <NotesCell
                  key={e.admin_notes ?? ""}
                  parentNote={e.notes}
                  adminNote={e.admin_notes}
                  onSave={(adminNotes) =>
                    update(
                      { entryId: e.id, adminNotes },
                      { onSuccess: () => toast.success("Notiz gespeichert") },
                    )
                  }
                />
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Wiedervorlage
                </p>
                <label className="block text-xs text-muted-foreground">
                  Wiedervorlage am
                  <Input
                    type="date"
                    className="mt-1 h-8"
                    defaultValue={fu ?? ""}
                    onBlur={(ev) => {
                      const v = ev.target.value || null;
                      if (v !== (fu ?? null))
                        update(
                          { entryId: e.id, followUpOn: v },
                          {
                            onSuccess: () =>
                              toast.success(
                                v ? "Wiedervorlage gespeichert" : "Wiedervorlage entfernt",
                              ),
                          },
                        );
                    }}
                  />
                </label>
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Angaben</p>
                <div>Eingang: {formatDateBerlin(e.created_at)}</div>
                <div>
                  Mitglied:{" "}
                  {e.is_member
                    ? "Ja"
                    : e.is_member === false
                      ? "Nein"
                      : e.member_claimed
                        ? "angegeben, nicht bestätigt – bitte prüfen"
                        : "–"}
                </div>
                {e.parent_phone && <div>Telefon: {e.parent_phone}</div>}
                <div>
                  <PaymentCell entry={e} />
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
      {deleteOpen && (
        <ConfirmActionDialog
          title={`Eintrag für ${e.child_name ?? "dieses Kind"} löschen`}
          consequence={
            <>
              Der Eintrag verschwindet endgültig aus der Warteliste, samt Notizen und Verlauf. Das
              ist nur für Fehleinträge und Dubletten gedacht. Soll die Familie nicht mehr warten,
              nutzen Sie „Abmelden“: Dann bleibt der Vorgang mit Grund nachvollziehbar.
            </>
          }
          confirmLabel="Endgültig löschen"
          destructive
          busy={m.remove.isPending}
          onClose={() => setDeleteOpen(false)}
          onConfirm={() => m.remove.mutate(e.id, { onSuccess: () => setDeleteOpen(false) })}
        />
      )}
      {unregisterOpen && (
        <UnregisterDialog
          entry={e}
          onClose={() => setUnregisterOpen(false)}
          onSave={unregister}
          saving={m.update.isPending}
        />
      )}
    </>
  );
}
