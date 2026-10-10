import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ConversationTimeline } from "@/components/admin/ConversationTimeline";
import { replyToWaitlistEntry } from "@/lib/waitlist-reply.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
  Send,
  ShieldBan,
  Trash2,
  Users,
  Undo2,
} from "lucide-react";

import { formatDateBerlin, formatDateTimeBerlin } from "@/lib/format";
import { matchProgram, meetsMinAge, minAgeReachedOn } from "@/lib/waitlist-age";
import { relatedProgramIds } from "@/lib/waitlist-programs";
import {
  WaitlistToday,
  buildTodo,
  fitProblems,
  type TodayEntry,
} from "@/components/admin/WaitlistToday";
import { checkFit } from "@/lib/swim-fit";
import { WaitlistReport } from "@/components/admin/WaitlistReport";
import { DeclineReasonFields } from "@/components/admin/DeclineReasonFields";
import { categorizeReason, combineReason } from "@/lib/decline-reasons";
import {
  listWaitlist,
  runWaitlistAllocation,
  offerWaitlistPlace,
  updateWaitlistEntry,
  deleteWaitlistEntry,
  migrateWaitingRequests,
  bookWaitlistPlaceDirect,
  recordWaitlistDecline,
  resolveBlockSuggestion,
} from "@/lib/waitlist.functions";

const PAYMENT_LABEL: Record<string, { label: string; className: string }> = {
  none: { label: "Nicht gebucht", className: "bg-slate-100 text-slate-700" },
  open: { label: "Offen", className: "bg-amber-100 text-amber-900" },
  overdue: { label: "Überfällig", className: "bg-red-100 text-red-900" },
  paid: { label: "Bezahlt", className: "bg-emerald-100 text-emerald-900" },
};

function PaymentCell({ entry }: { entry: Record<string, unknown> }) {
  const status = (entry["payment_status"] as string) ?? "none";
  const booking = entry["booking"] as
    | {
        paid_at?: string | null;
        price_amount?: number | null;
        payment_due_date?: string | null;
        booked_at?: string | null;
      }
    | null
    | undefined;
  const p = PAYMENT_LABEL[status] ?? PAYMENT_LABEL["none"]!;
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

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  waiting: { label: "Wartend", className: "bg-amber-100 text-amber-900" },
  offered: { label: "Platz angeboten", className: "bg-blue-100 text-blue-900" },
  accepted: { label: "Zugesagt", className: "bg-emerald-100 text-emerald-900" },
  declined: { label: "Abgesagt", className: "bg-slate-200 text-slate-800" },
  expired: { label: "Frist abgelaufen", className: "bg-slate-200 text-slate-800" },
  removed: { label: "Entfernt", className: "bg-slate-200 text-slate-800" },
};

type WaitlistEntry = Record<string, unknown> & {
  id: string;
  child_name: string | null;
  request?: Record<string, string | number | boolean | null> | null;
};

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

type EditPatch = {
  entryId: string;
  childName?: string;
  childDob?: string | null;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string | null;
  isMember?: boolean | null;
  notes?: string | null;
  availableFrom?: string | null;
  appendNote?: string;
};

function OriginalRequestDialog({
  entry,
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  entry: WaitlistEntry | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (patch: EditPatch) => void;
  saving: boolean;
}) {
  const r = entry?.request ?? null;
  const g = (k: string) => (r ? r[k] : (entry as Record<string, unknown> | null)?.[k]) ?? null;

  const [edit, setEdit] = useState(false);
  const replyFn = useServerFn(replyToWaitlistEntry);
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState({
    childName: "",
    childDob: "",
    parentName: "",
    parentEmail: "",
    parentPhone: "",
    isMember: "" as "" | "yes" | "no",
    notes: "",
    availableFrom: "",
  });
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!entry) return;
    setEdit(false);
    setNote("");
    setReplyBody("");
    setReplySubject("");
    setForm({
      childName: String(entry["child_name"] ?? ""),
      childDob: String(entry["child_dob"] ?? ""),
      parentName: String(entry["parent_name"] ?? ""),
      parentEmail: String(entry["parent_email"] ?? ""),
      parentPhone: String(entry["parent_phone"] ?? ""),
      isMember: entry["is_member"] === true ? "yes" : entry["is_member"] === false ? "no" : "",
      notes: String(entry["notes"] ?? ""),
      availableFrom: String(entry["available_from"] ?? ""),
    });
  }, [entry]);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Anfrage – {String(entry?.child_name ?? "")}</DialogTitle>
          <DialogDescription>
            {r
              ? "Ursprüngliche Kursanfrage über das Anfrageformular."
              : "Direkte Anmeldung über das Wartelisten-Formular."}
          </DialogDescription>
        </DialogHeader>
        {entry && (
          <div className="space-y-3">
            {!!entry["blocked_reason"] && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Auf der Sperrliste: {String(entry["blocked_reason"])}</span>
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
                <label className="text-sm">
                  Kind
                  <Input
                    value={form.childName}
                    onChange={(e) => setForm((f) => ({ ...f, childName: e.target.value }))}
                  />
                </label>
                <label className="text-sm">
                  Geburtsdatum
                  <Input
                    type="date"
                    value={form.childDob}
                    onChange={(e) => setForm((f) => ({ ...f, childDob: e.target.value }))}
                  />
                </label>
                <label className="text-sm">
                  Eltern
                  <Input
                    value={form.parentName}
                    onChange={(e) => setForm((f) => ({ ...f, parentName: e.target.value }))}
                  />
                </label>
                <label className="text-sm">
                  E-Mail
                  <Input
                    type="email"
                    value={form.parentEmail}
                    onChange={(e) => setForm((f) => ({ ...f, parentEmail: e.target.value }))}
                  />
                </label>
                <label className="text-sm">
                  Telefon
                  <Input
                    value={form.parentPhone}
                    onChange={(e) => setForm((f) => ({ ...f, parentPhone: e.target.value }))}
                  />
                </label>
                <label className="text-sm">
                  Mitglied
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={form.isMember}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isMember: e.target.value as "" | "yes" | "no" }))
                    }
                  >
                    <option value="">Unbekannt</option>
                    <option value="yes">Ja</option>
                    <option value="no">Nein</option>
                  </select>
                </label>
                <label className="text-sm">
                  Erst zuteilen ab (Zurückstellung)
                  <Input
                    type="date"
                    value={form.availableFrom}
                    onChange={(e) => setForm((f) => ({ ...f, availableFrom: e.target.value }))}
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
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
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
                  <Row label="Eingang" value={formatDateTimeBerlin(String(entry["created_at"]))} />
                  <Row label="Kind" value={entry["child_name"]} />
                  <Row
                    label="Geburtsdatum"
                    value={entry["child_dob"] ? formatDateBerlin(String(entry["child_dob"])) : null}
                  />
                  <Row label="Eltern" value={entry["parent_name"]} />
                  <Row label="E-Mail" value={entry["parent_email"]} />
                  <Row label="Telefon" value={entry["parent_phone"]} />
                  <Row label="Kurswunsch" value={g("desired_course")} />
                  <Row label="Schwimmniveau" value={g("swimming_level")} />
                  <Row label="Gesundheitliche Hinweise" value={g("health_info")} />
                  <Row label="Angaben der Eltern" value={entry["notes"] ?? g("message")} />
                  <Row label="Mitglied" value={entry["is_member"]} />
                  <Row
                    label="Erst zuteilen ab"
                    value={
                      entry["available_from"]
                        ? formatDateBerlin(String(entry["available_from"]))
                        : null
                    }
                  />
                  <Row
                    label="Datenschutz zugestimmt"
                    value={entry["gdpr_consent"] ?? g("gdpr_consent")}
                  />
                  <Row label="Kontaktaufnahme erlaubt" value={g("contact_permission")} />
                  <Row label="Interne Notizen" value={entry["admin_notes"]} />
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
                title: `Wartelisten-Eintrag${entry["child_name"] ? ` – ${String(entry["child_name"])}` : ""}`,
                when: String(entry["created_at"] ?? ""),
                from: `${String(entry["parent_name"] ?? "")} <${String(entry["parent_email"] ?? "")}>`,
                body: String(entry["notes"] ?? g("message") ?? "—"),
              }}
            />

            <div className="space-y-2 rounded-md border p-3">
              <h3 className="font-semibold">Rückfrage an die Familie senden</h3>
              <p className="text-xs text-muted-foreground">
                Die E-Mail geht an {String(entry["parent_email"] ?? "—")} und erscheint anschließend
                im Verlauf.
              </p>
              <label className="block text-sm">
                Betreff (optional)
                <Input
                  value={replySubject}
                  maxLength={300}
                  onChange={(e) => setReplySubject(e.target.value)}
                  placeholder={`Rückfrage zu Ihrem Wartelisten-Eintrag – ${String(entry["child_name"] ?? "")}`}
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
                disabled={replyBusy || replyBody.trim().length < 2 || !entry["parent_email"]}
                onClick={async () => {
                  setReplyBusy(true);
                  try {
                    await replyFn({
                      data: { entryId: entry.id, body: replyBody, subject: replySubject },
                    });
                    toast.success("E-Mail gesendet");
                    setReplyBody("");
                    setReplySubject("");
                    setReloadKey((k) => k + 1);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Senden fehlgeschlagen");
                  } finally {
                    setReplyBusy(false);
                  }
                }}
              >
                {replyBusy ? (
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

function NotesCell({
  entryId,
  parentNote,
  adminNote,
  onSave,
}: {
  entryId: string;
  parentNote: string | null;
  adminNote: string | null;
  onSave: (v: { entryId: string; adminNotes: string }) => void;
}) {
  const [value, setValue] = useState(adminNote ?? "");
  useEffect(() => setValue(adminNote ?? ""), [adminNote]);
  const dirty = (adminNote ?? "") !== value;

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
      {dirty && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => onSave({ entryId, adminNotes: value })}
        >
          Notiz speichern
        </Button>
      )}
    </div>
  );
}

export function WaitlistAdmin({ initialProgramIds }: { initialProgramIds?: string[] } = {}) {
  const qc = useQueryClient();
  const [view, setView] = useState<
    "today" | "report" | "waiting" | "offered" | "followup" | "declined" | "done"
  >(initialProgramIds?.length ? "waiting" : "today");
  const [search, setSearch] = useState("");
  const [programFilter, setProgramFilter] = useState<string[] | null>(
    initialProgramIds?.length ? initialProgramIds : null,
  );
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const toggleRow = (id: string) =>
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [detail, setDetail] = useState<WaitlistEntry | null>(null);
  const [declineFor, setDeclineFor] = useState<WaitlistEntry | null>(null);
  const [declineStay, setDeclineStay] = useState(true);
  const [declineFrom, setDeclineFrom] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [declineCategory, setDeclineCategory] = useState("");
  const migratedOnce = useRef(false);

  const {
    data,
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ["admin-waitlist"],
    queryFn: () => listWaitlist(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-waitlist"] });

  const migrate = useMutation({
    mutationFn: () => migrateWaitingRequests(),
    onSuccess: (res) => {
      if (res.migrated > 0) {
        toast.success(`${res.migrated} Anfrage(n) in die Warteliste übernommen.`);
        invalidate();
      }
    },
  });

  // Alte Kursanfragen mit Status „Warteliste“ einmalig übernehmen (idempotent)
  useEffect(() => {
    if (migratedOnce.current) return;
    migratedOnce.current = true;
    migrate.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allocate = useMutation({
    mutationFn: (courseId?: string | null) =>
      runWaitlistAllocation({ data: { courseId: courseId ?? null } }),
    onSuccess: (res) => {
      toast.success(
        `${res.offers} Platzangebot(e) verschickt, ${res.expired} abgelaufene Angebote geschlossen.`,
      );
      invalidate();
    },
    onError: () => toast.error("Platzvergabe fehlgeschlagen"),
  });

  const offer = useMutation({
    mutationFn: (v: { entryId: string; courseId: string }) => offerWaitlistPlace({ data: v }),
    onSuccess: () => {
      toast.success("Platzangebot verschickt");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Angebot fehlgeschlagen"),
  });

  const bookDirect = useMutation({
    mutationFn: (v: { entryId: string; courseId: string }) => bookWaitlistPlaceDirect({ data: v }),
    onSuccess: (res) => {
      toast.success(
        `Verbindlich gebucht: ${res.courseName}. Zahlung bis ${formatDateBerlin(res.paymentDueDate)}${
          res.immediatePayment ? " (Sofortüberweisung)" : ""
        }.`,
      );
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Buchung fehlgeschlagen"),
  });

  const recordDecline = useMutation({
    mutationFn: (v: {
      entryId: string;
      stay: boolean;
      availableFrom: string | null;
      reason: string | null;
    }) => recordWaitlistDecline({ data: v }),
    onSuccess: (res) => {
      toast.success(
        res.deactivated
          ? "Absage erfasst – 3. Absage, Wartelistenplatz wurde deaktiviert."
          : `Absage erfasst (${res.count}. Absage). Platz ist frei${res.newOffers > 0 ? `, ${res.newOffers} neues Angebot verschickt` : ""}.`,
      );
      setDeclineFor(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Absage konnte nicht erfasst werden"),
  });

  const update = useMutation({
    mutationFn: (v: {
      entryId: string;
      status?: "waiting" | "removed";
      adminNotes?: string;
      appendNote?: string;
      programId?: string | null;
      childName?: string;
      childDob?: string | null;
      parentName?: string;
      parentEmail?: string;
      parentPhone?: string | null;
      isMember?: boolean | null;
      notes?: string | null;
      blocklist?: boolean;
      blocklistReason?: string;
      dismissBlockSuggestion?: boolean;
      assignedTo?: string | null;
      followUpOn?: string | null;
      declineCount?: number;
    }) => updateWaitlistEntry({ data: v }),

    onSuccess: () => {
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Aktualisierung fehlgeschlagen"),
  });

  const resolveSuggestion = useMutation({
    mutationFn: (v: {
      action: "block" | "dismiss";
      email: string | null;
      childName: string | null;
      reason?: string;
    }) => resolveBlockSuggestion({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.action === "block" ? "Auf die Sperrliste gesetzt" : "Vorschlag ignoriert");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Aktion fehlgeschlagen"),
  });

  const remove = useMutation({
    mutationFn: (entryId: string) => deleteWaitlistEntry({ data: { entryId } }),
    onSuccess: () => {
      toast.success("Eintrag gelöscht");
      invalidate();
    },
    onError: () => toast.error("Löschen fehlgeschlagen"),
  });

  const programs = data?.programs ?? [];
  const programName = (id: string | null) =>
    programs.find((p) => p.id === id)?.name ?? "Ohne Zuordnung";
  const programById = (id: string | null) => programs.find((p) => p.id === id) ?? null;
  const courseName = (id: unknown) =>
    (data?.courses ?? []).find((c) => c.id === id)?.name ?? "Kurs";

  const allEntries = data?.entries ?? [];
  const declineCountOf = (e: unknown) =>
    Number((e as Record<string, unknown>)["decline_count"] ?? 0);
  const inView = (e: { status: string }, v: typeof view) => {
    switch (v) {
      case "waiting":
        return e.status === "waiting";
      case "offered":
        return e.status === "offered";
      case "followup":
        return ["declined", "expired"].includes(e.status);
      // Nachhalte-Liste: jeder Eintrag mit mindestens einer Absage, egal in welchem Status
      case "declined":
        return declineCountOf(e) > 0;
      default:
        return !["waiting", "offered", "declined", "expired"].includes(e.status);
    }
  };
  const tabCounts = {
    waiting: allEntries.filter((e) => inView(e, "waiting")).length,
    offered: allEntries.filter((e) => inView(e, "offered")).length,
    followup: allEntries.filter((e) => inView(e, "followup")).length,
    declined:
      allEntries.filter((e) => inView(e, "declined")).length + (data?.cancellations ?? []).length,
    done: allEntries.filter((e) => inView(e, "done")).length,
  };
  const cancellations = data?.cancellations ?? [];
  const q = search.trim().toLowerCase();
  const shown = q ? "search" : view;
  const matchesSearch = (...vals: Array<unknown>) =>
    vals.some((v) =>
      String(v ?? "")
        .toLowerCase()
        .includes(q),
    );
  const cancellationsShown = q
    ? cancellations.filter((c) => matchesSearch(c.child_name, c.parent_email))
    : cancellations;
  const todo = buildTodo(data);
  const reasonCounts = (() => {
    const m = new Map<string, number>();
    const add = (r: unknown) => {
      const c = categorizeReason(typeof r === "string" ? r : null);
      m.set(c, (m.get(c) ?? 0) + 1);
    };
    for (const e of allEntries)
      if (declineCountOf(e) > 0) add((e as Record<string, unknown>)["last_decline_reason"]);
    for (const c of cancellations) add(c.reason);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  })();

  const grouped = useMemo(() => {
    const entries = q
      ? allEntries.filter((e) =>
          matchesSearch(e.child_name, e.parent_name, e.parent_email, e.parent_phone),
        )
      : view === "today" || view === "report"
        ? []
        : allEntries.filter(
            (e) =>
              inView(e, view) && (!programFilter || programFilter.includes(e.program_id ?? "none")),
          );
    const map = new Map<string, typeof entries>();
    for (const e of entries) {
      const key = e.program_id ?? "none";
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, view, q, programFilter]);

  // Freie Plätze der Kurse, die zu einem Programm gehören (für den Gruppenkopf der Wartenden)
  const freeForProgram = (programId: string) =>
    (data?.courses ?? [])
      .filter(
        (c) => c.free != null && relatedProgramIds(c.program_id, programs).includes(programId),
      )
      .reduce((sum, c) => sum + (c.free ?? 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Anfrageliste wird geladen…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
        <p className="font-semibold">Die Anfrageliste konnte nicht geladen werden.</p>
        <p className="text-muted-foreground">
          Das ist ein technischer Fehler, die Einträge sind nicht gelöscht. Meldung:{" "}
          {loadError.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-primary-deep">Anfrageliste</h2>
          <p className="text-sm text-muted-foreground">
            Automatische Platzvergabe: Mitglieder zuerst, danach nach Eingangsdatum. Angeboten wird
            nur, wenn das Kind zum Kursbeginn das Mindestalter erreicht. Angebote laufen nach der im
            Programm hinterlegten Frist ab.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => allocate.mutate(null)} disabled={allocate.isPending}>
            {allocate.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Plätze jetzt vergeben
          </Button>
        </div>
      </div>

      <CollapsibleCard
        storageKey="waitlist-rules-info"
        defaultOpen={false}
        title="ℹ️ Leitfaden: Fristen, Regeln & Folgen der Anfrageliste"
        subtitle="Für den Vorstand – so arbeitet die Warteliste automatisch"
      >
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-semibold">1. Reihenfolge der Platzvergabe</p>
            <ul className="ml-5 list-disc text-muted-foreground">
              <li>Aktive Vereinsmitglieder zuerst, danach nach Eingangsdatum.</li>
              <li>Nur Kinder, die zum Kursbeginn das Mindestalter erreichen.</li>
              <li>Kinder mit „Erst zuteilen ab“ erst für Kurse ab diesem Datum.</li>
              <li>Programme mit ausgeschalteter Warteliste nehmen keine neuen Einträge an.</li>
              <li>
                „Passt das?“: Automatisch angeboten wird nur, wenn Schwimmniveau (Mindest-Niveau des
                Angebots) und Wunschtag zum Kurs passen. Andere Fälle erscheinen in „Heute“ unter
                „Passt das?“ mit Begründung; der Vorstand bietet dann von Hand an. Mindest-Niveau
                und Kurstag stellen Sie je Angebot in der Kursverwaltung ein.
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">2. Platzangebot</p>
            <ul className="ml-5 list-disc text-muted-foreground">
              <li>
                Eltern erhalten eine E-Mail mit Zusage-/Absage-Link. Frist: laut Programm (Standard
                3 Tage).
              </li>
              <li>Offene Angebote zählen als reservierte Plätze.</li>
              <li>
                Zusage = verbindliche Buchung mit Zahlungsfrist; der Absage-Zähler wird auf 0
                gesetzt.
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">3. Absage durch die Eltern</p>
            <ul className="ml-5 list-disc text-muted-foreground">
              <li>Der Platz wird frei und geht sofort an das nächste passende Kind.</li>
              <li>
                Eltern entscheiden direkt: auf der Warteliste bleiben oder abmelden. Wer bleibt,
                fällt auf die Warteliste zurück und wird frühestens für den nächsten Kurs (Start
                nach dem abgelehnten Kurs) wieder berücksichtigt, ggf. erst ab einem Wunschdatum.
              </li>
              <li>
                Absage-Zähler +1, Grund und Entscheidung werden in den internen Notizen vermerkt.
              </li>
              <li>
                Kam die Absage per Telefon oder E-Mail, im Reiter „Angebote“ auf „Absage erfassen“
                klicken – der Platz wird dann freigegeben.
              </li>
              <li>
                Alle Familien mit mindestens einer Absage stehen zum Nachhalten im Reiter „Absagen“
                (zusätzlich zu ihrem eigentlichen Reiter). Der Reiter „Heute“ zeigt, was gerade zu
                tun ist; die Suche findet eine Familie in allen Reitern.
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">4. Frist ohne Antwort abgelaufen</p>
            <ul className="ml-5 list-disc text-muted-foreground">
              <li>Zählt wie eine Absage (Zähler +1), der Platz geht an das nächste Kind.</li>
              <li>
                Eltern erhalten eine Rückfrage „Warteliste behalten?“ mit 7 Tagen Frist; solange sie
                läuft, steht der Eintrag im Reiter „Rückfragen“.
              </li>
              <li>
                Keine Antwort auf die Rückfrage → Wartelistenplatz wird gestrichen (Reiter
                „Archiv“). Keine automatische Sperrliste.
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">5. Die 3-Absagen-Regel</p>
            <ul className="ml-5 list-disc text-muted-foreground">
              <li>
                Beim 3. abgesagten oder unbeantworteten Angebot wird der Wartelistenplatz
                automatisch deaktiviert.
              </li>
              <li>
                Die Eltern werden per E-Mail informiert: erneute Buchung nur über den Vorstand.
              </li>
              <li>In der Tabelle: 1× grau, 2× gelb, 3× rot.</li>
              <li>
                Der Zähler gilt je Eltern-E-Mail bzw. Kind über alle Einträge und zählt auch
                Stornierungen gebuchter Plätze (Umbuchung, „zurück auf die Warteliste“) mit: ein
                neuer Eintrag setzt ihn nicht zurück. Ab 3 Absagen/Stornierungen gesamt erscheint
                „Sperrliste prüfen“; gesperrt wird nie automatisch, sondern nur per Klick auf
                „Sperren“. „Ignorieren“ blendet den Vorschlag dauerhaft aus.
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">6. Was der Vorstand jederzeit tun kann</p>
            <ul className="ml-5 list-disc text-muted-foreground">
              <li>
                Zähler zurücksetzen (z. B. bei Krankheit) über den Button „Zähler zurücksetzen“.
              </li>
              <li>
                Kind mit „Zurück auf wartend“ reaktivieren, manuell anbieten oder direkt buchen.
              </li>
              <li>
                Familien, die Angebote wiederholt ablaufen lassen, über den Sperrvorschlag oder
                manuell auf die Sperrliste setzen.
              </li>
              <li>
                Zuständigkeit und Wiedervorlage: in der aufgeklappten Zeile („Kurswunsch, Notiz,
                Zahlung“) „Bearbeitet von“ und „Wiedervorlage am“ setzen. Fällige Wiedervorlagen
                stehen im Reiter „Heute“.
              </li>
              <li>
                „Familie, Verlauf“ zeigt alle Kinder, Buchungen, Absagen, E-Mails und Sperrliste
                einer Familie auf einer Seite. Der Reiter „Nachfrage“ zeigt, wo sich ein
                zusätzlicher Kurs lohnt.
              </li>
            </ul>
          </div>
        </div>
      </CollapsibleCard>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(ev) => setSearch(ev.target.value)}
          placeholder="Suchen: Kind, Eltern, E-Mail, Telefon …"
          className="max-w-sm"
        />
        {q && (
          <Button size="sm" variant="ghost" onClick={() => setSearch("")}>
            Suche löschen
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {(
          [
            ["today", "Heute"],
            ["waiting", "Wartend"],
            ["offered", "Angebote"],
            ["followup", "Rückfragen"],
            ["declined", "Absagen"],
            ["done", "Archiv"],
            ["report", "Nachfrage"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={shown === key ? "default" : "outline"}
            onClick={() => {
              setSearch("");
              setView(key);
            }}
          >
            {label}
            {key === "report" ? "" : ` (${key === "today" ? todo.count : tabCounts[key]})`}
          </Button>
        ))}
      </div>

      {shown !== "today" && shown !== "search" && shown !== "report" && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ...programs.map((p) => ({ key: p.id, name: p.name })),
            ...(allEntries.some((e) => !e.program_id)
              ? [{ key: "none", name: "Ohne Zuordnung" }]
              : []),
          ].map((p) => {
            const mine = allEntries.filter((e) => (e.program_id ?? "none") === p.key);
            const waiting = mine.filter((e) => inView(e, "waiting")).length;
            const offered = mine.filter((e) => inView(e, "offered")).length;
            const followup = mine.filter((e) => inView(e, "followup")).length;
            const declined = mine.filter((e) => inView(e, "declined")).length;
            const free = p.key === "none" ? 0 : freeForProgram(p.key);
            const selected = programFilter?.length === 1 && programFilter[0] === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setProgramFilter(selected ? null : [p.key])}
                className={`rounded-lg border bg-card p-4 text-left transition hover:shadow-soft ${
                  selected ? "ring-2 ring-primary" : ""
                } ${mine.length === 0 ? "opacity-60" : ""}`}
              >
                <div className="font-semibold text-primary-deep">{p.name}</div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  <Badge variant="outline">{waiting} wartend</Badge>
                  {offered > 0 && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-900">
                      {offered} Angebot(e)
                    </Badge>
                  )}
                  {followup > 0 && <Badge variant="secondary">{followup} Rückfrage(n)</Badge>}
                  {declined > 0 && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-900">
                      {declined} mit Absage
                    </Badge>
                  )}
                  {free > 0 && (
                    <Badge className="bg-success text-success-foreground hover:bg-success">
                      {free} Platz/Plätze frei
                    </Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
      {programFilter && shown !== "today" && shown !== "search" && shown !== "report" && (
        <p className="text-sm text-muted-foreground">
          Gefiltert auf{" "}
          {programFilter?.length === 1 ? "ein Angebot" : "mehrere Angebote (Mischkurs)"}.{" "}
          <button type="button" className="underline" onClick={() => setProgramFilter(null)}>
            Filter aufheben
          </button>
        </p>
      )}

      {q && (
        <p className="text-sm text-muted-foreground">
          Suchergebnis für „{search.trim()}“ in allen Reitern:{" "}
          {grouped.reduce((n, [, l]) => n + l.length, 0)} Eintrag/Einträge,{" "}
          {cancellationsShown.length} Stornierung(en). Der Status steht jeweils in der Zeile.
        </p>
      )}

      {shown === "report" && <WaitlistReport data={data} />}

      {shown === "today" && (
        <WaitlistToday
          data={data}
          courseName={courseName}
          onGoto={(v) => setView(v)}
          onOpenDetail={(e) => setDetail(e as unknown as WaitlistEntry)}
          onDeclineOffer={(e) => {
            setDeclineStay(true);
            setDeclineFrom("");
            setDeclineReason("");
            setDeclineCategory("");
            setDeclineFor(e as unknown as WaitlistEntry);
          }}
          onAllocate={() => allocate.mutate(null)}
          allocating={allocate.isPending}
          onBlock={(s) => {
            if (
              !confirm(
                `${s.childName} / ${s.email} auf die Sperrliste setzen? Buchung und Anfrageliste sind dann gesperrt.`,
              )
            )
              return;
            resolveSuggestion.mutate({
              action: "block",
              email: s.email,
              childName: s.childName,
              reason: `Wiederholte Absagen/Stornierungen (${s.total})`,
            });
          }}
          onDismiss={(s) =>
            resolveSuggestion.mutate({ action: "dismiss", email: s.email, childName: s.childName })
          }
        />
      )}

      {shown === "followup" && (
        <p className="text-sm text-muted-foreground">
          Die Familien haben „Warteliste behalten?“ erhalten. Ohne Antwort innerhalb der Frist wird
          der Platz automatisch gestrichen.
        </p>
      )}
      {shown === "declined" && (
        <p className="text-sm text-muted-foreground">
          Alle Einträge mit mindestens einer Absage, egal in welchem Status (Zähler, Grund und
          Verlauf stehen in den Notizen). Der Zähler zählt je E-Mail bzw. Kind über alle Einträge.
        </p>
      )}

      {shown === "declined" && reasonCounts.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold">Gründe der Absagen</h3>
          <div className="flex flex-wrap gap-2 text-sm">
            {reasonCounts.map(([reason, n]) => (
              <Badge key={reason} variant="secondary">
                {reason} · {n}
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Zählt den zuletzt genannten Grund je Eintrag und die Gründe der Stornierungen. Ältere
            Freitexte werden automatisch einer Kategorie zugeordnet.
          </p>
        </div>
      )}

      {shown === "waiting" && (data?.courses ?? []).some((c) => c.max_participants != null) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {(data?.courses ?? [])
            .filter((c) => c.max_participants != null)
            .map((c) => (
              <span key={c.id} className="rounded-md border bg-muted/40 px-2 py-1">
                <strong>{c.name}</strong>: {c.confirmed} gebucht · {c.held} angeboten · {c.free}{" "}
                frei
              </span>
            ))}
        </div>
      )}

      {(shown === "declined" || shown === "search") && cancellationsShown.length > 0 && (
        <CollapsibleCard
          storageKey="waitlist-cancellations"
          title="Stornierungen gebuchter Plätze"
          meta={
            <span className="text-sm text-muted-foreground">
              {cancellationsShown.length} Einträge
            </span>
          }
          contentClassName="overflow-x-auto"
        >
          <p className="mb-2 text-xs text-muted-foreground">
            Absagen in der Teilnehmerliste, Umbuchungen und „zurück auf die Warteliste“ durch die
            Familie. Jede zählt wie eine Absage. Kursabsagen des Vereins zählen nicht.
          </p>
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">Kind</th>
                <th className="py-2 pr-3">E-Mail</th>
                <th className="py-2 pr-3">Kurs</th>
                <th className="py-2 pr-3">Datum</th>
                <th className="py-2 pr-3">Art / Grund</th>
                <th className="py-2 pr-3">Gesamt</th>
                <th className="py-2 pr-3">Sperrliste</th>
              </tr>
            </thead>
            <tbody>
              {cancellationsShown.map((c) => (
                <tr key={c.id} className="border-b align-top">
                  <td className="py-2 pr-3 font-medium">
                    {c.parent_email ? (
                      <Link
                        to="/admin/familie"
                        search={{ email: c.parent_email }}
                        className="text-primary underline underline-offset-2"
                      >
                        {c.child_name ?? "–"}
                      </Link>
                    ) : (
                      (c.child_name ?? "–")
                    )}
                  </td>
                  <td className="py-2 pr-3">{c.parent_email ?? "–"}</td>
                  <td className="py-2 pr-3">{c.course_name}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {c.cancelled_at ? formatDateBerlin(c.cancelled_at) : "–"}
                  </td>
                  <td className="py-2 pr-3">
                    <Badge variant="secondary">
                      {c.kind === "transfer"
                        ? `Umbuchung → ${c.moved_to}`
                        : c.kind === "waitlist"
                          ? "Zurück auf Warteliste"
                          : "Absage im Kurs"}
                    </Badge>
                    {c.reason && (
                      <div className="mt-1 text-xs text-muted-foreground">{c.reason}</div>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <Badge
                      variant="secondary"
                      className={
                        c.declines_total >= 3
                          ? "bg-red-100 text-red-900"
                          : c.declines_total === 2
                            ? "bg-amber-100 text-amber-900"
                            : "bg-slate-100 text-slate-700"
                      }
                    >
                      {c.declines_total}×
                    </Badge>
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    {c.blocked ? (
                      <span className="text-muted-foreground">gesperrt</span>
                    ) : c.block_suggestion ? (
                      <div className="flex flex-wrap gap-2">
                        <span className="font-semibold text-red-900">prüfen:</span>
                        <button
                          type="button"
                          className="text-red-900 underline"
                          onClick={() => {
                            if (
                              !confirm(
                                `${c.child_name} / ${c.parent_email} auf die Sperrliste setzen? Buchung und Warteliste sind dann gesperrt.`,
                              )
                            )
                              return;
                            resolveSuggestion.mutate({
                              action: "block",
                              email: c.parent_email,
                              childName: c.child_name,
                              reason: `Wiederholte Absagen/Stornierungen (${c.declines_total})`,
                            });
                          }}
                        >
                          Sperren
                        </button>
                        <button
                          type="button"
                          className="text-muted-foreground underline"
                          onClick={() =>
                            resolveSuggestion.mutate({
                              action: "dismiss",
                              email: c.parent_email,
                              childName: c.child_name,
                            })
                          }
                        >
                          Ignorieren
                        </button>
                      </div>
                    ) : (
                      "–"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CollapsibleCard>
      )}

      {grouped.length === 0 &&
        !((shown === "declined" || shown === "search") && cancellationsShown.length > 0) &&
        shown !== "today" &&
        shown !== "report" && (
          <p className="text-muted-foreground">Keine Einträge in diesem Bereich.</p>
        )}

      {grouped.map(([programId, entries]) => (
        <CollapsibleCard
          key={programId}
          storageKey={`waitlist-${programId}`}
          title={programName(programId === "none" ? null : programId)}
          meta={
            <span className="text-sm text-muted-foreground">
              {entries.length}{" "}
              {shown === "waiting"
                ? "wartend"
                : shown === "offered"
                  ? "Angebote aktiv"
                  : "Einträge"}
              {shown === "waiting" && programId !== "none" && freeForProgram(programId) > 0
                ? ` · ${freeForProgram(programId)} Platz/Plätze frei`
                : ""}
            </span>
          }
          contentClassName="overflow-x-auto"
        >
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">Kind</th>
                <th className="py-2 pr-3">Eltern</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const st = STATUS_LABEL[e.status] ?? { label: e.status, className: "" };
                const program = programById(e.program_id);
                const wish = (e as { desired_course?: string | null }).desired_course ?? null;
                const suggestion = !e.program_id ? matchProgram(wish ?? e.notes, programs) : null;
                const minAge = program?.min_age_years ?? null;
                const readyOn = minAgeReachedOn(e.child_dob, minAge);
                const fits = (c: { program_id: string | null }) =>
                  !e.program_id || relatedProgramIds(c.program_id, programs).includes(e.program_id);
                const courses = (data?.courses ?? [])
                  .filter((c) => c.free !== 0)
                  .map((c) => ({ ...c, fits: fits(c) }))
                  .sort((a, b) => Number(b.fits) - Number(a.fits));
                // Direktbuchung: der Vorstand darf auch volle Kurse überbuchen (Platzangebote nur für freie Plätze)
                const bookCourses = (data?.courses ?? [])
                  .map((c) => ({ ...c, fits: fits(c) }))
                  .sort((a, b) => Number(b.fits) - Number(a.fits));
                const tooYoungEverywhere =
                  !!e.child_dob &&
                  minAge != null &&
                  courses.length > 0 &&
                  courses.every((c) => !meetsMinAge(e.child_dob, c.starts_on, minAge));
                const isOpen = openRows.has(e.id);

                return (
                  <Fragment key={e.id}>
                    <tr className="border-b align-top">
                      <td className="py-2 pr-3 font-medium">
                        <button
                          type="button"
                          className="text-left text-primary underline underline-offset-2"
                          title="Originalanfrage anzeigen"
                          onClick={() => setDetail(e as unknown as WaitlistEntry)}
                        >
                          {e.child_name}
                        </button>
                        {e.child_dob && (
                          <div className="text-xs text-muted-foreground">
                            {formatDateBerlin(e.child_dob)}
                          </div>
                        )}
                        {(e as Record<string, unknown>)["blocked_reason"] ? (
                          <div className="mt-1 flex items-center gap-1 text-xs text-destructive">
                            <ShieldBan className="h-3 w-3" /> Sperrliste
                          </div>
                        ) : null}
                        {(e as Record<string, unknown>)["available_from"] ? (
                          <div className="mt-1 text-xs font-medium text-blue-700">
                            ⏸ Zurückgestellt – erst Kurse ab{" "}
                            {formatDateBerlin(
                              String((e as Record<string, unknown>)["available_from"]),
                            )}
                          </div>
                        ) : null}
                        {(e as Record<string, unknown>)["duplicate"] ? (
                          <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                            <Copy className="h-3 w-3" /> mögliche Dublette
                          </div>
                        ) : null}

                        <button
                          type="button"
                          className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                          onClick={() => setDetail(e as unknown as WaitlistEntry)}
                        >
                          <FileText className="h-3 w-3" /> Details
                        </button>
                        <Link
                          to="/admin/familie"
                          search={{ email: e.parent_email ?? "" }}
                          className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                        >
                          <Users className="h-3 w-3" /> Familie, Verlauf
                        </Link>
                        <button
                          type="button"
                          className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                          onClick={() => toggleRow(e.id)}
                        >
                          {isOpen ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                          Kurswunsch, Notiz, Zahlung
                        </button>
                      </td>

                      <td className="py-2 pr-3">
                        {e.parent_name}
                        <div className="text-xs text-muted-foreground">{e.parent_email}</div>
                        {e.parent_phone && (
                          <div className="text-xs text-muted-foreground">{e.parent_phone}</div>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge className={st.className} variant="secondary">
                          {st.label}
                        </Badge>
                        {(() => {
                          const who = (e as Record<string, unknown>)["assigned_to"] as
                            string | null;
                          const fu = (e as Record<string, unknown>)["follow_up_on"] as
                            string | null;
                          if (!who && !fu) return null;
                          const due = !!fu && fu <= new Date().toISOString().slice(0, 10);
                          return (
                            <div className="mt-1 flex flex-wrap gap-1 text-xs">
                              {who && <Badge variant="outline">→ {who}</Badge>}
                              {fu && (
                                <Badge
                                  variant="secondary"
                                  className={
                                    due ? "bg-red-100 text-red-900" : "bg-sky-100 text-sky-900"
                                  }
                                >
                                  Wiedervorlage {formatDateBerlin(fu)}
                                </Badge>
                              )}
                            </div>
                          );
                        })()}
                        {(() => {
                          const issues = fitProblems(e as unknown as TodayEntry, data);
                          return issues ? (
                            <div className="mt-1 rounded border border-red-300 bg-red-50 p-1.5 text-xs text-red-900">
                              Passt das? {issues.join("; ")}
                            </div>
                          ) : null;
                        })()}
                        {(e as { payment_status?: string }).payment_status &&
                          (e as { payment_status?: string }).payment_status !== "none" && (
                            <div className="mt-1">
                              <PaymentCell entry={e as unknown as WaitlistEntry} />
                            </div>
                          )}
                        {Number((e as Record<string, unknown>)["decline_count"] ?? 0) > 0 &&
                          (() => {
                            const n = Number((e as Record<string, unknown>)["decline_count"]);
                            const cls =
                              n >= 3
                                ? "bg-red-100 text-red-900"
                                : n === 2
                                  ? "bg-amber-100 text-amber-900"
                                  : "bg-slate-100 text-slate-700";
                            return (
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                <Badge variant="secondary" className={cls}>
                                  {n}× abgesagt{n >= 3 ? " – deaktiviert" : ""}
                                </Badge>
                                <button
                                  type="button"
                                  className="text-xs text-primary underline"
                                  onClick={() => {
                                    if (
                                      !confirm(
                                        `Absage-Zähler für ${e.child_name} auf 0 zurücksetzen?`,
                                      )
                                    )
                                      return;
                                    update.mutate({
                                      entryId: e.id,
                                      declineCount: 0,
                                      appendNote: "Absage-Zähler vom Vorstand zurückgesetzt.",
                                    });
                                  }}
                                >
                                  Zähler zurücksetzen
                                </button>
                              </div>
                            );
                          })()}
                        {Number((e as Record<string, unknown>)["declines_total"] ?? 0) >
                          declineCountOf(e) && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Gesamt {String((e as Record<string, unknown>)["declines_total"])}{" "}
                            Absagen (alle Einträge)
                          </div>
                        )}
                        {(e as { block_suggestion?: boolean }).block_suggestion &&
                          declineCountOf(e) > 0 && (
                            <div className="mt-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs">
                              <p className="font-semibold text-red-900">Sperrliste prüfen</p>
                              <div className="mt-1 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="text-red-900 underline"
                                  onClick={() => {
                                    if (
                                      !confirm(
                                        `${e.child_name} / ${e.parent_email} auf die Sperrliste setzen? Buchung und Warteliste sind dann gesperrt.`,
                                      )
                                    )
                                      return;
                                    update.mutate(
                                      {
                                        entryId: e.id,
                                        blocklist: true,
                                        blocklistReason: `Wiederholte Absagen (${String((e as Record<string, unknown>)["declines_total"])})`,
                                        appendNote:
                                          "Wegen wiederholter Absagen auf die Sperrliste gesetzt.",
                                      },
                                      {
                                        onSuccess: () =>
                                          toast.success("Auf die Sperrliste gesetzt"),
                                      },
                                    );
                                  }}
                                >
                                  Sperren
                                </button>
                                <button
                                  type="button"
                                  className="text-muted-foreground underline"
                                  onClick={() =>
                                    update.mutate({
                                      entryId: e.id,
                                      dismissBlockSuggestion: true,
                                      appendNote: "Sperrvorschlag geprüft und ignoriert.",
                                    })
                                  }
                                >
                                  Ignorieren
                                </button>
                              </div>
                            </div>
                          )}
                        {!!(e as Record<string, unknown>)["followup_expires_at"] &&
                          ["declined", "expired"].includes(e.status) && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Rückfrage läuft bis{" "}
                              {formatDateBerlin(
                                String((e as Record<string, unknown>)["followup_expires_at"]),
                              )}
                            </div>
                          )}
                        {e.status === "offered" && e.offer_expires_at && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {courseName(e.offer_course_id)} · Frist:{" "}
                            {formatDateBerlin(e.offer_expires_at)}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {e.status === "waiting" && courses.length > 0 && (
                            <select
                              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                              defaultValue=""
                              onChange={(ev) => {
                                const courseId = ev.target.value;
                                ev.target.value = "";
                                if (!courseId) return;
                                const c = courses.find((x) => x.id === courseId);
                                if (c && !meetsMinAge(e.child_dob, c.starts_on, minAge)) {
                                  if (
                                    !confirm(
                                      `${e.child_name} erreicht zum Kursbeginn das Mindestalter noch nicht. Trotzdem anbieten?`,
                                    )
                                  )
                                    return;
                                }
                                const af = (e as Record<string, unknown>)["available_from"] as
                                  string | null;
                                if (c && af && (!c.starts_on || c.starts_on < af)) {
                                  if (
                                    !confirm(
                                      `${e.child_name} ist zurückgestellt bis ${formatDateBerlin(af)}. Trotzdem anbieten?`,
                                    )
                                  )
                                    return;
                                }
                                const fitO = checkFit(
                                  e.notes,
                                  programs.find((p) => p.id === c?.program_id) ?? null,
                                );
                                if (
                                  c &&
                                  !fitO.ok &&
                                  !confirm(
                                    "Passt laut Prüfung nicht:\n- " +
                                      fitO.issues.join("\n- ") +
                                      "\n\nTrotzdem anbieten?",
                                  )
                                )
                                  return;
                                offer.mutate({ entryId: e.id, courseId });
                              }}
                            >
                              <option value="">Platz anbieten…</option>
                              {courses.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.fits ? "" : "(anderes Angebot) "}
                                  {c.name}
                                  {c.free != null ? ` (${c.free} frei)` : ""}
                                  {!meetsMinAge(e.child_dob, c.starts_on, minAge)
                                    ? " – zu jung"
                                    : ""}
                                </option>
                              ))}
                            </select>
                          )}
                          {e.status !== "accepted" && bookCourses.length > 0 && (
                            <select
                              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                              defaultValue=""
                              disabled={bookDirect.isPending}
                              onChange={(ev) => {
                                const courseId = ev.target.value;
                                ev.target.value = "";
                                if (!courseId) return;
                                const c = bookCourses.find((x) => x.id === courseId);
                                if (
                                  !confirm(
                                    `${e.child_name} verbindlich in „${c?.name ?? "Kurs"}“ buchen${c?.free === 0 ? " (Kurs ist voll – Überbuchung)" : ""}? Die Eltern erhalten sofort die Buchungsbestätigung mit Zahlungsdetails.`,
                                  )
                                )
                                  return;
                                const fitB = checkFit(
                                  e.notes,
                                  programs.find((p) => p.id === c?.program_id) ?? null,
                                );
                                if (
                                  c &&
                                  !fitB.ok &&
                                  !confirm(
                                    "Passt laut Prüfung nicht:\n- " +
                                      fitB.issues.join("\n- ") +
                                      "\n\nTrotzdem buchen?",
                                  )
                                )
                                  return;
                                bookDirect.mutate({ entryId: e.id, courseId });
                              }}
                            >
                              <option value="">Direkt buchen…</option>
                              {bookCourses.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.fits ? "" : "(anderes Angebot) "}
                                  {c.name}
                                  {c.free != null
                                    ? c.free > 0
                                      ? ` (${c.free} frei)`
                                      : " (voll – überbuchen)"
                                    : ""}
                                </option>
                              ))}
                            </select>
                          )}
                          {e.status === "offered" && (
                            <Button
                              size="sm"
                              variant="outline"
                              title="Eltern haben das Angebot telefonisch oder per E-Mail abgelehnt"
                              onClick={() => {
                                setDeclineStay(true);
                                setDeclineFrom("");
                                setDeclineReason("");
                                setDeclineCategory("");
                                setDeclineFor(e as unknown as WaitlistEntry);
                              }}
                            >
                              Absage erfassen
                            </Button>
                          )}
                          {e.status === "waiting" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Als abgemeldet markieren"
                              onClick={() => {
                                if (!confirm(`${e.child_name} als abgemeldet markieren?`)) return;
                                const block = confirm(
                                  "Zusätzlich auf die Sperrliste setzen? (OK = ja, Abbrechen = nein)",
                                );
                                update.mutate(
                                  {
                                    entryId: e.id,
                                    status: "removed",
                                    ...(block
                                      ? {
                                          blocklist: true,
                                          blocklistReason: "Von der Warteliste abgemeldet",
                                        }
                                      : {}),
                                  },
                                  {
                                    onSuccess: () =>
                                      toast.success(
                                        block
                                          ? "Abgemeldet und gesperrt"
                                          : "Als abgemeldet markiert",
                                      ),
                                  },
                                );
                              }}
                            >
                              <Send className="h-4 w-4 rotate-180" />
                            </Button>
                          )}

                          {e.status !== "waiting" && e.status !== "accepted" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title={
                                e.status === "offered"
                                  ? "Angebot zurückziehen: Platz wird frei, Familie wartet erst wieder ab dem nächsten Kurs (zählt nicht als Absage)"
                                  : "Zurück auf wartend"
                              }
                              onClick={() => update.mutate({ entryId: e.id, status: "waiting" })}
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Eintrag löschen"
                            onClick={() => {
                              if (confirm(`Eintrag für ${e.child_name} wirklich löschen?`))
                                remove.mutate(e.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b bg-muted/30">
                        <td colSpan={4} className="p-3">
                          <div className="grid gap-4 md:grid-cols-4">
                            <div className="space-y-1">
                              <p className="text-xs font-semibold uppercase text-muted-foreground">
                                Kurswunsch
                              </p>
                              <select
                                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                                value={e.program_id ?? ""}
                                onChange={(ev) =>
                                  update.mutate({
                                    entryId: e.id,
                                    programId: ev.target.value || null,
                                  })
                                }
                              >
                                <option value="">Kein Wunschkurs</option>
                                {programs.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                              {wish && (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  Wunsch: {wish}
                                </div>
                              )}
                              {suggestion && (
                                <button
                                  type="button"
                                  className="mt-1 text-xs text-primary underline"
                                  onClick={() =>
                                    update.mutate({ entryId: e.id, programId: suggestion.id })
                                  }
                                >
                                  Vorschlag übernehmen: {suggestion.name}
                                </button>
                              )}
                              {readyOn && (
                                <div className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                                  <span>
                                    Mindestalter erreicht ab {formatDateBerlin(readyOn)}
                                    {tooYoungEverywhere
                                      ? " – aktuell kein passender Kursstart"
                                      : ""}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-semibold uppercase text-muted-foreground">
                                Notiz
                              </p>
                              <NotesCell
                                entryId={e.id}
                                parentNote={e.notes}
                                adminNote={e.admin_notes}
                                onSave={(v) => {
                                  update.mutate(v, {
                                    onSuccess: () => toast.success("Notiz gespeichert"),
                                  });
                                }}
                              />
                            </div>
                            <div className="space-y-2 text-sm">
                              <p className="text-xs font-semibold uppercase text-muted-foreground">
                                Zuständigkeit
                              </p>
                              <label className="block text-xs text-muted-foreground">
                                Bearbeitet von
                                <select
                                  className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                                  value={String(
                                    (e as Record<string, unknown>)["assigned_to"] ?? "",
                                  )}
                                  onChange={(ev) =>
                                    update.mutate({
                                      entryId: e.id,
                                      assignedTo: ev.target.value || null,
                                    })
                                  }
                                >
                                  <option value="">Niemand</option>
                                  {(data?.staff ?? []).map((n) => (
                                    <option key={n} value={n}>
                                      {n}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block text-xs text-muted-foreground">
                                Wiedervorlage am
                                <Input
                                  type="date"
                                  className="mt-1 h-8"
                                  defaultValue={String(
                                    (e as Record<string, unknown>)["follow_up_on"] ?? "",
                                  )}
                                  onBlur={(ev) => {
                                    const v = ev.target.value || null;
                                    if (
                                      v !== ((e as Record<string, unknown>)["follow_up_on"] ?? null)
                                    )
                                      update.mutate({ entryId: e.id, followUpOn: v });
                                  }}
                                />
                              </label>
                            </div>
                            <div className="space-y-2 text-sm">
                              <p className="text-xs font-semibold uppercase text-muted-foreground">
                                Angaben
                              </p>
                              <div>Eingang: {formatDateBerlin(e.created_at)}</div>
                              <div>
                                Mitglied:{" "}
                                {e.is_member ? "Ja" : e.is_member === false ? "Nein" : "–"}
                              </div>
                              {e.parent_phone && <div>Telefon: {e.parent_phone}</div>}
                              <div>
                                <PaymentCell entry={e as unknown as WaitlistEntry} />
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </CollapsibleCard>
      ))}

      <OriginalRequestDialog
        entry={detail}
        open={!!detail}
        onOpenChange={(v) => !v && setDetail(null)}
        saving={update.isPending}
        onSave={(patch) => {
          update.mutate(patch, {
            onSuccess: () => {
              toast.success("Angaben gespeichert");
              setDetail(null);
            },
          });
        }}
      />

      <Dialog open={!!declineFor} onOpenChange={(v) => !v && setDeclineFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Absage erfassen – {String(declineFor?.child_name ?? "")}</DialogTitle>
            <DialogDescription>
              Der reservierte Platz wird freigegeben, die Absage zählt mit und der Platz geht an das
              nächste Kind. Es wird keine Rückfrage-Mail verschickt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <label className="flex items-start gap-2">
              <input
                type="radio"
                checked={declineStay}
                onChange={() => setDeclineStay(true)}
                className="mt-1"
              />
              <span>Bleibt auf der Warteliste</span>
            </label>
            {declineStay && (
              <div className="ml-6 space-y-1">
                <label className="text-xs text-muted-foreground">
                  Erst für Kurse ab (optional – sonst nächster Kurs nach dem Angebot)
                </label>
                <Input
                  type="date"
                  value={declineFrom}
                  onChange={(ev) => setDeclineFrom(ev.target.value)}
                />
              </div>
            )}
            <label className="flex items-start gap-2">
              <input
                type="radio"
                checked={!declineStay}
                onChange={() => setDeclineStay(false)}
                className="mt-1"
              />
              <span>Möchte nicht mehr auf der Warteliste stehen</span>
            </label>
            <DeclineReasonFields
              category={declineCategory}
              detail={declineReason}
              onCategory={setDeclineCategory}
              onDetail={setDeclineReason}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setDeclineFor(null)}>
              Abbrechen
            </Button>
            <Button
              disabled={recordDecline.isPending}
              onClick={() =>
                declineFor &&
                recordDecline.mutate({
                  entryId: declineFor.id,
                  stay: declineStay,
                  availableFrom: declineStay && declineFrom ? declineFrom : null,
                  reason: combineReason(declineCategory, declineReason),
                })
              }
            >
              {recordDecline.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Absage speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
