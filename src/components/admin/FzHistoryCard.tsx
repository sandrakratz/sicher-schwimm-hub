import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateBerlin } from "@/lib/format";
import { listFzHistory, type FzHistoryRow } from "@/lib/trainer-extras.functions";

/**
 * Nachweis der Einsichtnahmen in erweiterte Führungszeugnisse (§ 72a SGB VIII): jede Prüfung bleibt als
 * eigene Zeile stehen, auch nach dem Ausscheiden. Gespeichert ist nur, dass und wann Einsicht genommen wurde.
 */
export function FzHistoryCard() {
  const load = useServerFn(listFzHistory);
  const [rows, setRows] = useState<FzHistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Konnte nicht geladen werden"));
  }, [load]);

  function downloadCsv() {
    if (!rows) return;
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      [
        "Trainer:in",
        "Zeugnis ausgestellt am",
        "Einsicht genommen am",
        "Geprüft von",
        "Ausgeschieden am",
      ]
        .map(esc)
        .join(";"),
      ...rows.map((r) =>
        [
          r.trainerName,
          r.issuedOn ? formatDateBerlin(r.issuedOn) : "",
          formatDateBerlin(r.checkedAt),
          r.checkedByName ?? "",
          r.leftAt ? formatDateBerlin(r.leftAt) : "",
        ]
          .map(esc)
          .join(";"),
      ),
    ];
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nachweis-fuehrungszeugnisse.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-2 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold text-primary-deep">
            Nachweis Führungszeugnisse
          </h2>
          <p className="text-sm text-muted-foreground">
            Jede Einsicht durch den Vorstand bleibt hier stehen – über die ganze Tätigkeit, auch
            nach dem Ausscheiden. Gespeichert ist nur, dass und wann Einsicht genommen wurde, nie
            das Zeugnis selbst. Ein neues Zeugnis ist spätestens 2 Jahre nach Ausstellung fällig.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={!rows?.length} onClick={downloadCsv}>
          <Download className="h-4 w-4" aria-hidden="true" /> Als CSV herunterladen
        </Button>
      </div>
      <Card className="border-0 shadow-soft">
        <CardContent className="overflow-x-auto p-0">
          {error ? (
            <p className="p-4 text-sm text-destructive">{error}</p>
          ) : !rows ? (
            <p className="p-4 text-sm text-muted-foreground">Wird geladen …</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Noch keine Einsicht vermerkt. Sie entsteht, wenn oben beim Führungszeugnis „Nachweis
              geprüft“ angehakt wird.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trainer:in</TableHead>
                  <TableHead>Zeugnis ausgestellt am</TableHead>
                  <TableHead>Einsicht genommen am</TableHead>
                  <TableHead>Geprüft von</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={`${r.trainerId}-${r.checkedAt}-${i}`}>
                    <TableCell className="font-medium">{r.trainerName}</TableCell>
                    <TableCell>{r.issuedOn ? formatDateBerlin(r.issuedOn) : "—"}</TableCell>
                    <TableCell>{formatDateBerlin(r.checkedAt)}</TableCell>
                    <TableCell>{r.checkedByName ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.leftAt ? `ausgeschieden am ${formatDateBerlin(r.leftAt)}` : "aktiv"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
