import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listDeclarations, type DeclarationRow } from "@/lib/trainer-billing.functions";
import { formatDateTimeBerlin, todayBerlinIso } from "@/lib/format";

const eur = (n: number) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

/** Jahreserklärungen der Trainer:innen zur Übungsleiterpauschale (nur Ansicht für den Vorstand). */
export function TrainerDeclarations() {
  const thisYear = Number(todayBerlinIso().slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [rows, setRows] = useState<DeclarationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useServerFn(listDeclarations);

  useEffect(() => {
    setLoading(true);
    load({ data: { year } })
      .then((res) => setRows(res.rows))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Laden fehlgeschlagen"))
      .finally(() => setLoading(false));
  }, [year, load]);

  const missing = rows.filter((r) => !r.declaration).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Jede Trainer:in gibt einmal im Jahr eine Erklärung ab: nebenberuflich tätig ja/nein und
          ein bereits anderweitig genutzter Freibetrag. Ohne Erklärung kann eine Auszahlung nur mit
          Begründung freigegeben werden.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setYear((y) => y - 1)}>
            ◀
          </Button>
          <span className="w-12 text-center font-semibold">{year}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={year >= thisYear}
            onClick={() => setYear((y) => y + 1)}
          >
            ▶
          </Button>
        </div>
      </div>
      {!loading && missing > 0 && (
        <p className="text-sm">
          <Badge variant="secondary">{missing}</Badge> Trainer:in(nen) ohne Erklärung für {year}.
        </p>
      )}
      <Card className="border-0 shadow-soft">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">Wird geladen …</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              Es gibt noch keine Trainer:innen.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Nebenberuflich</TableHead>
                  <TableHead>Anderweitig genutzter Freibetrag</TableHead>
                  <TableHead>Hinweis der Trainer:in</TableHead>
                  <TableHead>Erklärt am</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.trainerId}>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      {r.email && <div className="text-xs text-muted-foreground">{r.email}</div>}
                    </TableCell>
                    {r.declaration ? (
                      <>
                        <TableCell>{r.declaration.sideJob ? "Ja" : "Nein"}</TableCell>
                        <TableCell>{eur(r.declaration.otherAllowance)}</TableCell>
                        <TableCell className="text-sm">{r.declaration.otherNote ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTimeBerlin(r.declaration.confirmedAt)}
                        </TableCell>
                      </>
                    ) : (
                      <TableCell colSpan={4}>
                        <Badge variant="destructive">fehlt</Badge>
                      </TableCell>
                    )}
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
