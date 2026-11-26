import { askConfirm } from "@/components/admin/confirm-store";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getNewsNoticeInfo,
  sendNewsNoticeBatch,
  sendNewsNoticeTest,
} from "@/lib/news-notice.functions";

type Info = Awaited<ReturnType<typeof getNewsNoticeInfo>>;

/**
 * „Mitglieder per E-Mail informieren“: Hinweis-Mail auf einen News-Beitrag an alle aktiven
 * Mitglieder, in Paketen mit Tageslimit. Genutzt in News und im Versand.
 */
export function NewsNoticeDialog({
  newsId,
  onClose,
}: {
  newsId: string | null;
  onClose: () => void;
}) {
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  // Aktuelles onClose merken, ohne das Laden bei jedem neuen Callback zu wiederholen
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    setInfo(null);
    setProgress("");
    if (!newsId) return;
    setBusy(true);
    getNewsNoticeInfo({ data: { newsId } })
      .then(setInfo)
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Vorschau nicht möglich.");
        closeRef.current();
      })
      .finally(() => setBusy(false));
  }, [newsId]);

  async function sendTest() {
    if (!newsId) return;
    try {
      const r = await sendNewsNoticeTest({ data: { newsId } });
      toast.success(`Testmail an ${r.to} gesendet.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Testmail fehlgeschlagen.");
    }
  }

  async function sendAll() {
    if (!newsId || !info) return;
    if (
      !(await askConfirm({
        title: "Mail an Mitglieder senden?",
        consequence: `Die Mail geht jetzt an ${info.open} Mitglieder-Adressen. Eine gesendete Mail kannst du nicht zurückholen.`,
        confirmLabel: "Jetzt senden",
      }))
    )
      return;
    let delivered = 0;
    setBusy(true);
    setProgress("Wird gesendet…");
    try {
      for (let i = 0; i < 100; i++) {
        const r = await sendNewsNoticeBatch({ data: { newsId } });
        delivered += r.delivered;
        setProgress(`${delivered} gesendet, noch ${r.remaining} offen…`);
        if (r.remaining === 0) break;
        if (r.limitReached) {
          toast.warning(
            `Das Tageslimit des Mail-Anbieters ist erreicht. ${delivered} gesendet, ${r.remaining} offen. Morgen auf „Weiter senden“ klicken.`,
          );
          break;
        }
        if (r.delivered === 0) {
          toast.warning(
            `Es konnte nichts mehr gesendet werden. ${r.remaining} Adressen sind offen (siehe Gesendete E-Mails, Filter „Nur Probleme“).`,
          );
          break;
        }
      }
      toast.success(`${delivered} Mails gesendet.`);
      setInfo(await getNewsNoticeInfo({ data: { newsId } }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Versand unterbrochen.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <Dialog open={!!newsId} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Mitglieder per E-Mail informieren</DialogTitle>
        </DialogHeader>
        {!info ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Wird geladen…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border p-4 bg-muted/40">
              <div className="text-xs text-muted-foreground">So sieht der Inhalt aus:</div>
              <div className="font-semibold text-primary-deep mt-1">{info.title}</div>
              <p className="text-sm mt-1 whitespace-pre-wrap">{info.preview}</p>
              <div className="text-xs text-muted-foreground mt-2">
                Knopf „Weiterlesen“ → {info.url}
              </div>
            </div>
            <ul className="text-sm space-y-1">
              <li>
                Empfänger insgesamt: <strong>{info.total}</strong> (aktive Mitglieder, ohne
                Doppelte)
              </li>
              <li>
                Schon informiert: <strong>{info.alreadySent}</strong> · noch offen:{" "}
                <strong>{info.open}</strong>
              </li>
              <li>
                Heute noch möglich (Tageslimit des Mail-Anbieters):{" "}
                <strong>{info.budgetToday}</strong>
              </li>
            </ul>
            {info.open > info.budgetToday && (
              <p className="text-sm text-amber-700">
                Das Tageslimit reicht nicht für alle. Es wird so viel gesendet wie möglich, den Rest
                kannst du morgen mit „Weiter senden“ nachholen.
              </p>
            )}
            {progress && <p className="text-sm font-medium">{progress}</p>}
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={!info || busy} onClick={sendTest}>
            Testmail an mich
          </Button>
          <Button disabled={!info || busy || info.open === 0} onClick={sendAll}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {info && info.alreadySent > 0 ? "Weiter senden" : "An alle senden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
