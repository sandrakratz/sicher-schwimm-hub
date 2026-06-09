import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/unsubscribe")({
  component: Page,
});

function Page() {
  const [state, setState] = useState<"loading" | "valid" | "invalid" | "already" | "success" | "error">("loading");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
    if (!t) { setState("invalid"); return; }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`)
      .then(r => r.json())
      .then(d => {
        if (d.valid) setState("valid");
        else if (d.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      })
      .catch(() => setState("error"));
  }, []);

  async function confirm() {
    if (!token) return;
    setState("loading");
    const res = await fetch("/email/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const d = await res.json().catch(() => ({}));
    if (d.success) setState("success");
    else if (d.reason === "already_unsubscribed") setState("already");
    else setState("error");
  }

  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-20 max-w-xl">
        <Card className="border-0 shadow-soft">
          <CardContent className="p-8 text-center space-y-4">
            <h1 className="font-display text-2xl font-bold text-primary-deep">Newsletter abbestellen</h1>
            {state === "loading" && <p className="text-muted-foreground">Bitte warten…</p>}
            {state === "valid" && <>
              <p className="text-muted-foreground">Möchten Sie keine E-Mails mehr von uns erhalten?</p>
              <Button variant="accent" onClick={confirm}>Abmeldung bestätigen</Button>
            </>}
            {state === "already" && <p className="text-muted-foreground">Diese Adresse ist bereits abgemeldet.</p>}
            {state === "success" && <p className="text-success">Sie wurden erfolgreich abgemeldet.</p>}
            {state === "invalid" && <p className="text-destructive">Ungültiger oder abgelaufener Link.</p>}
            {state === "error" && <p className="text-destructive">Es ist ein Fehler aufgetreten. Bitte später erneut versuchen.</p>}
          </CardContent>
        </Card>
      </section>
    </PublicLayout>
  );
}
