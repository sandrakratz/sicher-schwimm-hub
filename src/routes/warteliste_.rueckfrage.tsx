import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PublicLayout } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { formatDateBerlin } from "@/lib/format";
import { answerWaitlistFollowup, getWaitlistFollowup } from "@/lib/waitlist.functions";

export const Route = createFileRoute("/warteliste_/rueckfrage")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? (search["token"] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "Warteliste behalten? | Sicher Schwimmen e.V." },
      { name: "description", content: "Teilen Sie uns mit, ob Ihr Kind auf der Warteliste bleiben soll." },
      { property: "og:title", content: "Warteliste behalten?" },
      { property: "og:description", content: "Rückmeldung zum Verbleib auf der Warteliste." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FollowupPage,
});

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <PublicLayout>
      <section className="container mx-auto max-w-2xl px-4 py-16">{children}</section>
    </PublicLayout>
  );
}

export function StayChoice({
  stay,
  setStay,
  when,
  setWhen,
  date,
  setDate,
}: {
  stay: boolean | null;
  setStay: (v: boolean) => void;
  when: "now" | "date";
  setWhen: (v: "now" | "date") => void;
  date: string;
  setDate: (v: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="font-medium">Soll Ihr Kind auf der Warteliste für einen späteren Kurs bleiben?</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={stay === true ? "default" : "outline"} onClick={() => setStay(true)}>
            Ja, gerne
          </Button>
          <Button type="button" variant={stay === false ? "default" : "outline"} onClick={() => setStay(false)}>
            Nein, bitte von der Warteliste nehmen
          </Button>
        </div>
      </div>
      {stay === true && (
        <div className="space-y-2 rounded-md border p-4">
          <p className="font-medium">Ab wann soll Ihr Kind wieder berücksichtigt werden?</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={when === "now"} onChange={() => setWhen("now")} /> Beim nächsten Kurs (nach dem bisherigen Angebot)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={when === "date"} onChange={() => setWhen("date")} /> Erst für Kurse ab:
          </label>
          {when === "date" && (
            <div className="max-w-xs">
              <Label htmlFor="from" className="sr-only">Datum</Label>
              <Input id="from" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FollowupPage() {
  const { token } = useSearch({ from: "/warteliste_/rueckfrage" });
  const [stay, setStay] = useState<boolean | null>(null);
  const [when, setWhen] = useState<"now" | "date">("now");
  const [date, setDate] = useState("");
  const [done, setDone] = useState<null | boolean>(null);
  const [loading, setLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["waitlist-followup", token],
    enabled: !!token,
    queryFn: () => getWaitlistFollowup({ data: { token } }),
  });

  if (!token || (!isLoading && !data?.found)) {
    return (
      <Frame>
        <XCircle className="mb-4 h-12 w-12 text-destructive" />
        <h1 className="font-display text-3xl font-bold text-primary-deep">Link nicht mehr gültig</h1>
        <p className="mt-3 text-muted-foreground">
          Diese Rückfrage wurde bereits beantwortet oder ist nicht mehr aktiv. Bei Fragen: info@sicher-schwimmen.com
        </p>
      </Frame>
    );
  }
  if (isLoading || !data?.found) return <Frame><p className="text-muted-foreground">Wird geladen…</p></Frame>;

  if (done !== null) {
    return (
      <Frame>
        <CheckCircle2 className="mb-4 h-12 w-12 text-success" />
        <h1 className="font-display text-3xl font-bold text-primary-deep">Vielen Dank!</h1>
        <p className="mt-3 text-muted-foreground">
          {done
            ? `${data.childName ?? "Ihr Kind"} bleibt auf der Warteliste${when === "date" && date ? ` und wird ab ${formatDateBerlin(date)} wieder berücksichtigt` : ""}.`
            : `${data.childName ?? "Ihr Kind"} wurde von der Warteliste genommen.`}
        </p>
        <p className="mt-6 text-sm"><Link to="/kurse" className="underline">Zur Kursübersicht</Link></p>
      </Frame>
    );
  }

  if (data.expired) {
    return (
      <Frame>
        <Clock className="mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="font-display text-3xl font-bold text-primary-deep">Frist abgelaufen</h1>
        <p className="mt-3 text-muted-foreground">
          Die Frist für diese Rückfrage ist abgelaufen. Bitte wenden Sie sich an info@sicher-schwimmen.com.
        </p>
      </Frame>
    );
  }

  async function submit() {
    if (stay === null) return toast.error("Bitte wählen Sie eine Option.");
    if (stay && when === "date" && !date) return toast.error("Bitte ein Datum wählen.");
    setLoading(true);
    try {
      const res = await answerWaitlistFollowup({
        data: { token, stay, availableFrom: stay && when === "date" ? date : null },
      });
      if (!res.ok) toast.error(res.reason === "expired" ? "Die Frist ist abgelaufen." : "Link nicht mehr gültig.");
      else setDone(stay);
    } catch {
      toast.error("Es ist ein Fehler aufgetreten.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Frame>
      <h1 className="font-display text-3xl font-bold text-primary-deep">Warteliste behalten?</h1>
      <p className="mt-2 text-muted-foreground">
        Für <strong>{data.childName}</strong> – bitte antworten Sie bis {data.expiresAt ? formatDateBerlin(data.expiresAt) : "zur Frist"}.
      </p>
      <div className="mt-6">
        <StayChoice stay={stay} setStay={setStay} when={when} setWhen={setWhen} date={date} setDate={setDate} />
      </div>
      <Button className="mt-6" onClick={submit} disabled={loading || stay === null}>Antwort senden</Button>
    </Frame>
  );
}
