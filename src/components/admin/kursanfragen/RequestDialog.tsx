import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog";
import { ConversationTimeline } from "@/components/admin/ConversationTimeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  assignRequestToCourse,
  suggestMatchForRequest,
  unassignRequestFromCourse,
} from "@/lib/course-assignment.functions";
import { replyToCourseRequest } from "@/lib/course-requests.functions";
import { errorText, formatDateBerlin, formatDateTimeBerlin } from "@/lib/format";
import { Row, SharkyButton, StatusBadge, type Sharky } from "./parts";
import type { CourseLabel, CourseOpt, Item, RequestStatus } from "./types";

type Actions = {
  /** Geänderte Felder sofort im Dialog zeigen. */
  patch: (p: Partial<Item>) => void;
  reload: () => Promise<void>;
  close: () => void;
};

function Box({ children, className = "space-y-2" }: { children: ReactNode; className?: string }) {
  return <div className={`${className} rounded-md border bg-muted/30 p-3`}>{children}</div>;
}

function UnassignBox({ item, actions }: { item: Item; actions: Actions }) {
  const unassignFn = useServerFn(unassignRequestFromCourse);
  const [status, setStatus] = useState<"waiting_list" | "new">("waiting_list");
  const [busy, setBusy] = useState(false);

  async function doUnassign() {
    if (!confirm("Zuweisung wirklich aufheben? Der Teilnehmer-Eintrag im Kurs wird storniert."))
      return;
    setBusy(true);
    try {
      await unassignFn({ data: { requestId: item.id, newStatus: status } });
      toast.success(
        status === "new"
          ? "Zuweisung aufgehoben – Status: Neu"
          : "Zuweisung aufgehoben – Status: Warteliste",
      );
      actions.patch({ assigned_course_id: null, status });
      await actions.reload();
    } catch (e) {
      toast.error(errorText(e, "Fehler"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box>
      <p className="text-xs text-muted-foreground">
        Zuweisung aufheben: Die Anfrage erscheint wieder unter „Aktuelle Anfragen“, der
        Teilnehmer-Eintrag im Kurs wird storniert. Es wird keine E-Mail versendet.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Label>Neuer Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="waiting_list">Warteliste</SelectItem>
              <SelectItem value="new">Neu</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={doUnassign} disabled={busy}>
          {busy ? "Wird aufgehoben …" : "Zuweisung aufheben"}
        </Button>
      </div>
    </Box>
  );
}

function NotesBox({ item, actions }: { item: Item; actions: Actions }) {
  const [draft, setDraft] = useState(item.admin_notes || "");
  const [busy, setBusy] = useState(false);

  async function saveNotes() {
    setBusy(true);
    const value = draft.trim() ? draft : null;
    const { error } = await supabase
      .from("course_requests")
      .update({ admin_notes: value })
      .eq("id", item.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Notiz gespeichert");
    actions.patch({ admin_notes: value });
    void actions.reload();
  }

  return (
    <Box>
      <p className="text-xs text-muted-foreground">
        Nur intern sichtbar – z.B. Telefonate, Absprachen oder sonstige Hinweise. Erscheint auch in
        der Übersicht.
      </p>
      <Textarea
        rows={4}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="z.B. 20.08. telefoniert – Rückruf nächste Woche"
      />
      <Button variant="outline" size="sm" onClick={saveNotes} disabled={busy}>
        {busy ? "Wird gespeichert …" : "Notiz speichern"}
      </Button>
    </Box>
  );
}

function ReplyBox({ item, actions, onSent }: { item: Item; actions: Actions; onSent: () => void }) {
  const replyFn = useServerFn(replyToCourseRequest);
  const [subject, setSubject] = useState(
    `Rückfrage zu Ihrer Kursanfrage${item.child_name ? ` – ${item.child_name}` : ""}`,
  );
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function doReply() {
    if (body.trim().length < 2) return toast.error("Bitte Nachricht eingeben");
    setBusy(true);
    try {
      await replyFn({ data: { requestId: item.id, body, subject } });
      toast.success("E-Mail gesendet – Status auf Kontaktiert gesetzt");
      setBody("");
      actions.patch({ status: "contacted" });
      onSent();
      await actions.reload();
    } catch (e) {
      toast.error(errorText(e, "E-Mail konnte nicht gesendet werden"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Sendet eine E-Mail an {item.parent_email} und setzt den Status automatisch auf
        „Kontaktiert".
      </p>
      <div>
        <Label>Betreff</Label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={300} />
      </div>
      <div>
        <Label>Nachricht</Label>
        <Textarea
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Ihre Rückfrage an die Eltern …"
        />
      </div>
      <Button variant="default" onClick={doReply} disabled={busy || body.trim().length < 2}>
        {busy ? "Wird gesendet …" : "E-Mail senden & als Kontaktiert markieren"}
      </Button>
    </Box>
  );
}

type Member = "yes" | "no" | "unknown";

function AssignBox({
  item,
  courses,
  actions,
}: {
  item: Item;
  courses: CourseOpt[];
  actions: Actions;
}) {
  const assignFn = useServerFn(assignRequestToCourse);
  const suggestFn = useServerFn(suggestMatchForRequest);
  const [courseId, setCourseId] = useState(item.assigned_course_id || "");
  const [status, setStatus] = useState<"confirmed" | "waiting">("confirmed");
  const [notes, setNotes] = useState("");
  const [sendMail, setSendMail] = useState(true);
  const [isMember, setIsMember] = useState<Member>("unknown");
  const [parent, setParent] = useState({ id: "", label: "" });
  // Von Hand eingetragene Gebühr; sonst gilt der Kurspreis passend zum Mitgliedstatus.
  const [priceOverride, setPriceOverride] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Mitgliedschaft und Elternkonto zur E-Mail der Anfrage vorschlagen.
  useEffect(() => {
    suggestFn({ data: { email: item.parent_email, requestId: item.id } })
      .then((res) => {
        if (res.isMember === true) setIsMember("yes");
        else if (res.isMember === false) setIsMember("no");
        if (res.parentUserId) setParent({ id: res.parentUserId, label: res.parentLabel || "" });
      })
      .catch((err) =>
        console.warn("[anfragen] Mitgliedsvorschlag konnte nicht geladen werden:", err),
      );
  }, [item.id, item.parent_email, suggestFn]);

  const course = courses.find((x) => x.id === courseId);
  const listPrice =
    isMember === "yes" ? course?.price_member : isMember === "no" ? course?.price_non_member : null;
  const priceAmount = priceOverride ?? (listPrice != null ? String(listPrice) : "");

  async function doAssign() {
    if (!courseId) return toast.error("Bitte Kurs auswählen");
    setBusy(true);
    try {
      const priceNum = priceAmount.trim() ? Number(priceAmount.replace(",", ".")) : null;
      const res = await assignFn({
        data: {
          requestId: item.id,
          courseId,
          status,
          sendEmail: sendMail,
          adminNotes: notes || undefined,
          isMember: isMember === "yes" ? true : isMember === "no" ? false : null,
          parentUserId: parent.id || null,
          priceAmount: priceNum != null && !Number.isNaN(priceNum) ? priceNum : null,
        },
      });
      toast.success(res.emailQueued ? "Eingebucht & E-Mail versendet" : "Eingebucht");
      actions.close();
      await actions.reload();
    } catch (e) {
      toast.error(errorText(e, "Fehler"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box className="space-y-3">
      <div>
        <Label>Kurs auswählen</Label>
        <Select value={courseId} onValueChange={setCourseId}>
          <SelectTrigger>
            <SelectValue placeholder="Kurs wählen…" />
          </SelectTrigger>
          <SelectContent>
            {courses.length === 0 && (
              <div className="p-2 text-xs text-muted-foreground">Keine Kurse vorhanden.</div>
            )}
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
                {c.starts_on ? ` · ab ${formatDateBerlin(c.starts_on)}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="confirmed">Bestätigt</SelectItem>
              <SelectItem value="waiting">Warteliste</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-end gap-2 text-sm pb-2">
          <Checkbox checked={sendMail} onCheckedChange={(v) => setSendMail(!!v)} />
          Bestätigungs-E-Mail an Eltern senden
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Mitglied?</Label>
          <Select
            value={isMember}
            onValueChange={(v) => {
              setIsMember(v as Member);
              setPriceOverride(null);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Ja, Mitglied</SelectItem>
              <SelectItem value="no">Nein</SelectItem>
              <SelectItem value="unknown">Unklar / prüfen</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Kursgebühr (€)</Label>
          <Input
            type="number"
            step="0.01"
            value={priceAmount}
            onChange={(e) => setPriceOverride(e.target.value)}
            placeholder="z.B. 150"
          />
        </div>
      </div>
      <div>
        <Label>Elternkonto verknüpfen</Label>
        {parent.id ? (
          <div className="flex items-center gap-2 text-xs mt-1">
            <Badge className="bg-green-600 hover:bg-green-700">verknüpft</Badge>
            <span>{parent.label || parent.id}</span>
            <Button variant="ghost" size="sm" onClick={() => setParent({ id: "", label: "" })}>
              Entfernen
            </Button>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground mt-1">
            Kein passendes Eltern-Konto gefunden. Sobald sich das Elternteil mit „
            {item.parent_email}" registriert, wird der Kurs automatisch verknüpft.
          </div>
        )}
      </div>

      <div>
        <Label>Persönliche Nachricht (optional, wird in die E-Mail aufgenommen)</Label>
        <Textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="z.B. Hinweise zur ersten Stunde, Treffpunkt, Mitzubringendes…"
        />
      </div>

      <Button variant="accent" onClick={doAssign} disabled={busy || !courseId}>
        {busy ? "Wird gespeichert…" : sendMail ? "Einbuchen & E-Mail senden" : "Einbuchen"}
      </Button>
    </Box>
  );
}

/**
 * Inhalt des Anfrage-Dialogs. Wird je Anfrage neu aufgebaut (key = id), damit alle Eingaben
 * beim Öffnen einer anderen Anfrage leer starten.
 */
export function RequestDetails({
  item,
  courses,
  courseLabel,
  sharky,
  actions,
}: {
  item: Item;
  courses: CourseOpt[];
  courseLabel: CourseLabel;
  sharky: Sharky;
  actions: Actions;
}) {
  const [payerAddress, setPayerAddress] = useState<string | null>(null);
  const [conversationReloadKey, setConversationReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("course_participants")
      .select("payer_street,payer_zip,payer_city")
      .eq("request_id", item.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const city = [data.payer_zip, data.payer_city].filter(Boolean).join(" ");
        setPayerAddress([data.payer_street, city].filter(Boolean).join(", ") || null);
      });
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  async function setStatus(status: RequestStatus) {
    const { error } = await supabase.from("course_requests").update({ status }).eq("id", item.id);
    if (error) return toast.error(error.message);
    toast.success("Aktualisiert");
    actions.patch({ status });
    void actions.reload();
  }

  // „Ablehnen“ setzt per Datenbank-Trigger automatisch auf die Sperrliste – daher nur über die
  // Rückfrage mit Grund. Der Grund landet in der Notiz der Anfrage und im Sperrlisten-Eintrag.
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  async function reject(reason: string) {
    setRejecting(true);
    try {
      const line = `[${formatDateTimeBerlin(new Date().toISOString())}] Abgelehnt – Grund: ${reason}`;
      const notes = [item.admin_notes, line].filter(Boolean).join("\n");
      const { error } = await supabase
        .from("course_requests")
        .update({ status: "rejected", admin_notes: notes })
        .eq("id", item.id);
      if (error) return void toast.error(error.message);
      const { error: blErr } = await supabase
        .from("booking_blocklist")
        .update({ reason: `Kursanfrage abgelehnt: ${reason}` })
        .eq("request_id", item.id);
      if (blErr)
        toast.error(`Abgelehnt, aber der Grund fehlt auf der Sperrliste: ${blErr.message}`);
      else toast.success("Abgelehnt – die Familie steht jetzt auf der Sperrliste");
      setRejectOpen(false);
      actions.patch({ status: "rejected", admin_notes: notes });
      void actions.reload();
    } finally {
      setRejecting(false);
    }
  }

  async function doDelete() {
    if (!confirm("Diese Kursanfrage wirklich endgültig löschen?")) return;
    const { error } = await supabase.from("course_requests").delete().eq("id", item.id);
    if (error) return toast.error(error.message);
    toast.success("Anfrage gelöscht");
    actions.close();
    await actions.reload();
  }

  const cl = courseLabel(item.assigned_course_id);
  const orDash = (v: string | null) => v || "—";

  return (
    <>
      <div className="space-y-4 text-sm">
        <Row label="Eingegangen" value={formatDateTimeBerlin(item.created_at)} />
        <Row label="Status" value={<StatusBadge status={item.status} />} />
        <Row
          label="Schwimmschule Sharky"
          value={
            <div className="flex items-center gap-2">
              <SharkyButton item={item} sharky={sharky} />
              {item.referred_sharky && item.referred_sharky_at && (
                <span className="text-xs text-muted-foreground">
                  verwiesen am {formatDateBerlin(item.referred_sharky_at)}
                </span>
              )}
            </div>
          }
        />
        {item.assigned_course_id && (
          <>
            <Row
              label="Zugewiesener Kurs"
              value={cl ? `${cl.name}${cl.period ? ` (${cl.period})` : ""}` : "—"}
            />
            <UnassignBox item={item} actions={actions} />
          </>
        )}
        <hr />
        <h3 className="font-semibold">Eltern / Erziehungsberechtigte</h3>
        <Row label="Name" value={item.parent_name} />
        <Row
          label="E-Mail"
          value={
            <a className="text-primary underline" href={`mailto:${item.parent_email}`}>
              {item.parent_email}
            </a>
          }
        />
        <Row label="Telefon" value={orDash(item.parent_phone)} />
        <Row label="Rechnungsanschrift" value={orDash(payerAddress)} />
        <hr />
        <h3 className="font-semibold">Kind</h3>
        <Row label="Name" value={orDash(item.child_name)} />
        <Row label="Geburtsdatum" value={item.child_dob ? formatDateBerlin(item.child_dob) : "—"} />
        <Row label="Schwimmlevel" value={orDash(item.swimming_level)} />
        <hr />
        <h3 className="font-semibold">Wunsch</h3>
        <Row label="Gewünschter Kurs" value={orDash(item.desired_course)} />
        <Row label="Gesundheit" value={orDash(item.health_info)} />
        <Row
          label="Nachricht"
          value={<span className="whitespace-pre-wrap">{orDash(item.message)}</span>}
        />
        <hr />
        <Row label="Datenschutz akzeptiert" value={item.gdpr_consent ? "Ja" : "Nein"} />
        <Row label="Kontakt erlaubt" value={item.contact_permission ? "Ja" : "Nein"} />

        <hr />
        <h3 className="font-semibold">Interne Notizen</h3>
        <NotesBox item={item} actions={actions} />

        <hr />
        <ConversationTimeline
          kind="course-request"
          id={item.id}
          original={{
            title: `Kursanfrage${item.child_name ? ` – ${item.child_name}` : ""}`,
            when: item.created_at,
            from: `${item.parent_name} <${item.parent_email}>`,
            body: [
              item.desired_course ? `Gewünschter Kurs: ${item.desired_course}` : null,
              item.swimming_level ? `Schwimmlevel: ${item.swimming_level}` : null,
              item.message ? `\n${item.message}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
          }}
          reloadKey={conversationReloadKey}
        />

        <hr />
        <h3 className="font-semibold">Rückfrage per E-Mail senden</h3>
        <ReplyBox
          item={item}
          actions={actions}
          onSent={() => setConversationReloadKey((k) => k + 1)}
        />

        <hr />
        <h3 className="font-semibold">In Kurs einbuchen</h3>
        <AssignBox item={item} courses={courses} actions={actions} />
      </div>

      <DialogFooter className="flex-wrap gap-2">
        <Button
          variant="ghost"
          className="mr-auto text-destructive"
          title="Nur für Fehleinträge – die Anfrage verschwindet endgültig"
          onClick={doDelete}
        >
          Löschen
        </Button>
        <Button variant="outline" onClick={() => setStatus("contacted")}>
          Kontaktiert
        </Button>
        <Button variant="outline" onClick={() => setStatus("waiting_list")}>
          Warteliste
        </Button>
        <Button variant="accent" onClick={() => setStatus("accepted")}>
          Akzeptieren
        </Button>
        {item.status !== "rejected" && (
          <Button variant="destructive" onClick={() => setRejectOpen(true)}>
            Ablehnen und sperren …
          </Button>
        )}
        <Button variant="ghost" onClick={actions.close}>
          Schließen
        </Button>
      </DialogFooter>
      {rejectOpen && (
        <ConfirmActionDialog
          title={`Anfrage für ${item.child_name || item.parent_name} ablehnen`}
          consequence={
            <>
              Die Anfrage wird abgelehnt und die Familie kommt auf die Sperrliste. Über die Webseite
              kann sie dann nicht mehr direkt buchen, nur noch eine Anfrage zur Einzelfallprüfung
              stellen. Es geht keine E-Mail an die Familie. Die Sperre lässt sich unter Familien →
              Sperrliste aufheben.
            </>
          }
          reason={{ label: "Grund", placeholder: "z. B. Alter passt nicht", required: true }}
          confirmLabel="Ablehnen und sperren"
          destructive
          busy={rejecting}
          onClose={() => setRejectOpen(false)}
          onConfirm={(r) => void reject(r)}
        />
      )}
    </>
  );
}
