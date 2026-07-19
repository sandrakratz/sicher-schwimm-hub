import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTimeBerlin } from "@/lib/format";
import { getMessageConversation, getCourseRequestConversation, type ReplyEntry } from "@/lib/conversation.functions";

const STATUS_VARIANT: Record<string, { label: string; className: string }> = {
  sent: { label: "Gesendet", className: "bg-green-600 hover:bg-green-700 text-white" },
  pending: { label: "Warteschlange", className: "bg-amber-500 hover:bg-amber-600 text-white" },
  suppressed: { label: "Unterdrückt", className: "bg-slate-500 hover:bg-slate-600 text-white" },
  failed: { label: "Fehler", className: "bg-red-600 hover:bg-red-700 text-white" },
  dlq: { label: "Fehlgeschlagen", className: "bg-red-700 hover:bg-red-800 text-white" },
  bounced: { label: "Bounce", className: "bg-red-500 hover:bg-red-600 text-white" },
  complained: { label: "Beschwerde", className: "bg-red-700 hover:bg-red-800 text-white" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_VARIANT[status] || { label: status, className: "" };
  return <Badge className={s.className}>{s.label}</Badge>;
}

function ReplyItem({ r }: { r: ReplyEntry }) {
  const [showHtml, setShowHtml] = useState(false);
  const hasContent = !!(r.body_text || r.body_html);
  return (
    <div className="rounded-md border bg-background p-3 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-muted-foreground">{formatDateTimeBerlin(r.created_at)}</div>
        <StatusBadge status={r.status} />
      </div>
      <div className="font-semibold text-sm">{r.subject || "(Kein Betreff)"}</div>
      {r.error_message && (
        <div className="text-xs text-red-600">Fehler: {r.error_message}</div>
      )}
      {!hasContent && (
        <div className="text-xs italic text-muted-foreground">
          Inhalt nicht gespeichert (Antwort vor Aktivierung der Inhalts-Protokollierung).
        </div>
      )}
      {hasContent && !showHtml && (
        <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed max-h-64 overflow-auto">
          {r.body_text || "(kein Text-Teil)"}
        </pre>
      )}
      {hasContent && showHtml && r.body_html && (
        <iframe
          sandbox=""
          srcDoc={r.body_html}
          title="E-Mail HTML"
          className="w-full h-64 rounded border bg-white"
        />
      )}
      {r.body_html && (
        <Button variant="ghost" size="sm" onClick={() => setShowHtml(v => !v)}>
          {showHtml ? "Text-Ansicht" : "HTML-Ansicht"}
        </Button>
      )}
    </div>
  );
}

export function ConversationTimeline({
  kind,
  id,
  original,
  reloadKey,
}: {
  kind: "message" | "course-request";
  id: string;
  original: { title: string; when: string; from: string; body: string };
  reloadKey?: unknown;
}) {
  const [replies, setReplies] = useState<ReplyEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = kind === "message"
          ? await getMessageConversation({ data: { messageId: id } })
          : await getCourseRequestConversation({ data: { requestId: id } });
        if (!cancelled) setReplies(res.replies);
      } catch {
        if (!cancelled) setReplies([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [kind, id, reloadKey]);

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Verlauf</h3>
      <div className="rounded-md border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs text-muted-foreground">Eingegangen · {formatDateTimeBerlin(original.when)}</div>
          <Badge variant="outline">Eingang</Badge>
        </div>
        <div className="font-semibold text-sm">{original.title}</div>
        <div className="text-xs text-muted-foreground">Von: {original.from}</div>
        <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed max-h-64 overflow-auto">
          {original.body}
        </pre>
      </div>

      {loading && <div className="text-xs text-muted-foreground">Lade Antworten …</div>}
      {!loading && replies.length === 0 && (
        <div className="text-xs text-muted-foreground italic">Noch keine Antworten über die Website versendet.</div>
      )}
      {!loading && replies.map(r => <ReplyItem key={r.id} r={r} />)}
    </div>
  );
}
