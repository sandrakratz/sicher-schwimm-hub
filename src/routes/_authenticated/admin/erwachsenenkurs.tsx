import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Trash2, UserRoundSearch } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateBerlin } from "@/lib/format";
import { csvCell } from "@/lib/csv-safe";
import {
  AVAILABILITY_SHORT,
  INTEREST_STATUS,
  MEMBER_STATUS_STATED,
  PRICE_PREFERENCE_SHORT,
  SWIM_LEVEL_SHORT,
  findPossibleDuplicates,
  type InterestStatus,
} from "@/lib/adult-course";
import {
  deleteAdultInterest,
  listAdultInterests,
  updateAdultInterest,
  type AdultInterest,
} from "@/lib/adult-interest.functions";

export const Route = createFileRoute("/_authenticated/admin/erwachsenenkurs")({
  ssr: false,
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/role-guard");
    const { redirect } = await import("@tanstack/react-router");
    try {
      await assertHasAnyRole({ data: { roles: ["admin", "board"] } });
    } catch {
      throw redirect({ to: "/portal" });
    }
  },
  component: Page,
  head: () => ({
    meta: [
      { title: "Erwachsenenkurs-Interessenten – Adminbereich | Sicher Schwimmen e.V." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const selectClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";

function memberLabel(r: AdultInterest) {
  if (r.is_member === true) return "Mitglied (System)";
  if (r.is_member === false) return "Mitgliedschaft nicht aktiv";
  if (r.member_status_stated) return `Angabe: ${MEMBER_STATUS_STATED[r.member_status_stated]}`;
  return "unbekannt";
}

function Page() {
  const [rows, setRows] = useState<AdultInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fLevel, setFLevel] = useState("");
  const [fAvail, setFAvail] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  async function load() {
    setLoading(true);
    try {
      setRows((await listAdultInterests()).entries);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Liste konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const duplicates = useMemo(() => findPossibleDuplicates(rows), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!fLevel || r.swim_level === fLevel) &&
        (!fAvail || r.saturday_availability === fAvail) &&
        (!fStatus || r.status === fStatus) &&
        (!q ||
          `${r.first_name} ${r.last_name} ${r.email} ${r.phone ?? ""}`.toLowerCase().includes(q)),
    );
  }, [rows, search, fLevel, fAvail, fStatus]);

  async function setStatus(r: AdultInterest, status: InterestStatus) {
    try {
      await updateAdultInterest({ data: { id: r.id, status } });
      setRows((all) => all.map((x) => (x.id === r.id ? { ...x, status } : x)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Status konnte nicht gespeichert werden.");
    }
  }

  async function saveNotes(r: AdultInterest) {
    try {
      await updateAdultInterest({ data: { id: r.id, adminNotes: notes } });
      setRows((all) => all.map((x) => (x.id === r.id ? { ...x, admin_notes: notes || null } : x)));
      toast.success("Notiz gespeichert.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Notiz konnte nicht gespeichert werden.");
    }
  }

  async function remove(r: AdultInterest) {
    if (!confirm(`Interessenbekundung von ${r.first_name} ${r.last_name} endgültig löschen?`))
      return;
    try {
      await deleteAdultInterest({ data: { id: r.id } });
      setRows((all) => all.filter((x) => x.id !== r.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Löschen fehlgeschlagen.");
    }
  }

  function exportCsv() {
    const head = [
      "Eingang",
      "Vorname",
      "Nachname",
      "E-Mail",
      "Telefon",
      "Schwimmstand",
      "Samstag",
      "Preis",
      "Mitgliedsstatus",
      "Status",
      "Nachricht",
      "Interne Notiz",
    ];
    const lines = filtered.map((r) =>
      [
        formatDateBerlin(r.created_at),
        r.first_name,
        r.last_name,
        r.email,
        r.phone ?? "",
        SWIM_LEVEL_SHORT[r.swim_level],
        AVAILABILITY_SHORT[r.saturday_availability],
        PRICE_PREFERENCE_SHORT[r.price_preference],
        memberLabel(r),
        INTEREST_STATUS[r.status],
        r.message ?? "",
        r.admin_notes ?? "",
      ]
        .map(csvCell)
        .join(";"),
    );
    const blob = new Blob(["﻿" + [head.map(csvCell).join(";"), ...lines].join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "erwachsenenschwimmen-interessenten.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  return (
    <div className="max-w-7xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold text-primary-deep">
          <UserRoundSearch className="h-7 w-7" /> Erwachsenenschwimmen – Interessenten
        </h1>
        <p className="mt-1 text-muted-foreground">
          Unverbindliche Interessenbekundungen für den geplanten Kurs ab 13.02.2027. Diese Personen
          sind weder angemeldet noch Mitglied noch zahlungspflichtig. Die verbindliche Anmeldung
          schalten Sie unter Kurse &amp; Teilnehmer frei (Angebot „Erwachsenenschwimmen“ → buchbar).
        </p>
      </div>

      <Card className="border-0 shadow-soft">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              className="w-64"
              placeholder="Suche nach Name, E-Mail, Telefon"
              aria-label="Suche"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className={selectClass}
              aria-label="Schwimmstand filtern"
              value={fLevel}
              onChange={(e) => setFLevel(e.target.value)}
            >
              <option value="">Alle Schwimmstände</option>
              {Object.entries(SWIM_LEVEL_SHORT).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              aria-label="Verfügbarkeit filtern"
              value={fAvail}
              onChange={(e) => setFAvail(e.target.value)}
            >
              <option value="">Alle Verfügbarkeiten</option>
              {Object.entries(AVAILABILITY_SHORT).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              aria-label="Status filtern"
              value={fStatus}
              onChange={(e) => setFStatus(e.target.value)}
            >
              <option value="">Alle Status</option>
              {Object.entries(INTEREST_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v} ({counts[k] ?? 0})
                </option>
              ))}
            </select>
            <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="mr-2 h-4 w-4" /> CSV exportieren
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {filtered.length} von {rows.length} Einträgen
          </p>

          {loading ? (
            <p className="py-6 text-center text-muted-foreground">Wird geladen…</p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">Keine Einträge gefunden.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Eingang</TableHead>
                  <TableHead>Name / Kontakt</TableHead>
                  <TableHead>Schwimmstand</TableHead>
                  <TableHead>Samstag</TableHead>
                  <TableHead>Preis</TableHead>
                  <TableHead>Mitglied</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <Fragment key={r.id}>
                    <TableRow>
                      <TableCell className="whitespace-nowrap">
                        {formatDateBerlin(r.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {r.first_name} {r.last_name}{" "}
                          {duplicates.has(r.id) && (
                            <Badge variant="outline" className="border-warning text-warning">
                              mögliche Doppelung
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                        {r.phone && <div className="text-xs text-muted-foreground">{r.phone}</div>}
                      </TableCell>
                      <TableCell>{SWIM_LEVEL_SHORT[r.swim_level]}</TableCell>
                      <TableCell>{AVAILABILITY_SHORT[r.saturday_availability]}</TableCell>
                      <TableCell>{PRICE_PREFERENCE_SHORT[r.price_preference]}</TableCell>
                      <TableCell className="text-xs">{memberLabel(r)}</TableCell>
                      <TableCell>
                        <select
                          className={selectClass}
                          aria-label={`Status für ${r.first_name} ${r.last_name}`}
                          value={r.status}
                          onChange={(e) => void setStatus(r, e.target.value as InterestStatus)}
                        >
                          {Object.entries(INTEREST_STATUS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setOpenId(openId === r.id ? null : r.id);
                            setNotes(r.admin_notes ?? "");
                          }}
                        >
                          {openId === r.id ? "Schließen" : "Details"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Löschen"
                          onClick={() => void remove(r)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {openId === r.id && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/40">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <div className="text-xs font-semibold">Nachricht der Person</div>
                              <p className="whitespace-pre-line text-sm text-muted-foreground">
                                {r.message || "–"}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <div className="text-xs font-semibold">Interne Notiz</div>
                              <Textarea
                                rows={3}
                                maxLength={2000}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                              />
                              <Button size="sm" onClick={() => void saveNotes(r)}>
                                Notiz speichern
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
