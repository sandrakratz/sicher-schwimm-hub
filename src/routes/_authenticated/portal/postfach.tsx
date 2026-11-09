import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeBerlin } from "@/lib/format";
import { listMyMessages, markMyMessageRead, type MyMessage } from "@/lib/member-messages.functions";

export const Route = createFileRoute("/_authenticated/portal/postfach")({
  ssr: false,
  component: Postfach,
});

function Postfach() {
  const [items, setItems] = useState<MyMessage[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    listMyMessages()
      .then(setItems)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Laden fehlgeschlagen");
        setItems([]);
      });
  }, []);

  function open(m: MyMessage) {
    const isOpen = openId === m.recipientId;
    setOpenId(isOpen ? null : m.recipientId);
    if (!isOpen && !m.readAt) {
      const now = new Date().toISOString();
      setItems((prev) =>
        (prev ?? []).map((x) => (x.recipientId === m.recipientId ? { ...x, readAt: now } : x)),
      );
      markMyMessageRead({ data: { recipientId: m.recipientId } }).catch(() => {});
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl font-bold text-primary-deep mb-2">Postfach</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Persönliche Nachrichten vom Vorstand. Antworten können Sie über{" "}
        <Link to="/portal/kontakt" className="underline">
          Verein kontaktieren
        </Link>
        .
      </p>
      {items === null ? (
        <p className="text-muted-foreground">Lade …</p>
      ) : items.length === 0 ? (
        <Card className="border-0 shadow-soft">
          <CardContent className="p-10 text-center text-muted-foreground">
            Noch keine Nachrichten.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((m) => {
            const isOpen = openId === m.recipientId;
            return (
              <Card key={m.recipientId} className="border-0 shadow-soft">
                <CardContent className="p-4">
                  <button type="button" className="w-full text-left" onClick={() => open(m)}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className={m.readAt ? "font-medium" : "font-bold"}>
                        {!m.readAt && <Badge className="mr-2">Neu</Badge>}
                        {m.subject}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTimeBerlin(m.createdAt)}
                      </span>
                    </div>
                  </button>
                  {isOpen && (
                    <p className="mt-3 whitespace-pre-line leading-relaxed text-foreground/90">
                      {m.body}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
