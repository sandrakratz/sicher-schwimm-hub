import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Copy, Download } from "lucide-react";
import { formatDateTimeBerlin } from "@/lib/format";
import { formatIban } from "@/lib/iban";
import { listPayoutDetails, type PayoutListRow } from "@/lib/trainer-payout.functions";

export const Route = createFileRoute("/_authenticated/admin/uebungsleitergelder")({
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
      { title: "Übungsleitergelder – Adminbereich | Sicher Schwimmen e.V." },
      {
        name: "description",
        content: "Bankverbindungen der Trainer:innen für die Abrechnung der Übungsleitergelder.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function csvCell(v: string) {
  return `"${v.replace(/"/g, '""')}"`;
}

function Page() {
  const [rows, setRows] = useState<PayoutListRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listPayoutDetails()
      .then((res) => setRows(res.rows))
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Liste konnte nicht geladen werden."),
      )
      .finally(() => setLoading(false));
  }, []);

  const withIban = rows.filter((r) => r.iban);
  const missing = rows.length - withIban.length;

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} kopiert`);
    } catch {
      toast.error("Kopieren nicht möglich");
    }
  }

  function exportCsv() {
    const header = ["Name", "E-Mail", "Kontoinhaber:in", "IBAN", "Zuletzt geändert"];
    const lines = withIban.map((r) =>
      [
        r.name,
        r.email ?? "",
        r.account_holder ?? "",
        formatIban(r.iban ?? ""),
        formatDateTimeBerlin(r.updated_at),
      ]
        .map(csvCell)
        .join(";"),
    );
    // BOM, damit Excel Umlaute richtig anzeigt
    const blob = new Blob(["﻿" + [header.map(csvCell).join(";"), ...lines].join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `uebungsleitergelder-iban-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary-deep sm:text-3xl">
            Übungsleitergelder
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bankverbindungen der Trainer:innen. Sie pflegen ihre Angaben selbst im Profil; bei einer
            Änderung geht automatisch ein Hinweis an info@sicher-schwimmen.com. Jeder Abruf wird im
            Audit-Log vermerkt.
          </p>
        </div>
        <Button onClick={exportCsv} disabled={withIban.length === 0} variant="outline">
          <Download className="mr-2 h-4 w-4" /> Als CSV herunterladen
        </Button>
      </div>

      {missing > 0 && (
        <p className="text-sm text-muted-foreground">
          <Badge variant="secondary">{missing}</Badge> Trainer:in(nen) haben noch keine IBAN
          hinterlegt.
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
                  <TableHead>Kontoinhaber:in</TableHead>
                  <TableHead>IBAN</TableHead>
                  <TableHead>Zuletzt geändert</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.user_id}>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      {r.email && <div className="text-xs text-muted-foreground">{r.email}</div>}
                    </TableCell>
                    <TableCell>{r.account_holder ?? "—"}</TableCell>
                    <TableCell>
                      {r.iban ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="font-mono text-sm">{formatIban(r.iban)}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label={`IBAN von ${r.name} kopieren`}
                            onClick={() => copy(r.iban!, "IBAN")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </span>
                      ) : (
                        <Badge variant="secondary">fehlt</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTimeBerlin(r.updated_at)}
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
