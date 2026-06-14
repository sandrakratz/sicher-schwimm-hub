import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Waves, ArrowLeft, Info } from "lucide-react";
import logoAsset from "@/assets/sicher-schwimmen-rund.png.asset.json";
const logo = logoAsset.url;

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Login – Sicher Schwimmen e.V." }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/portal" });
    });
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("pending") === "1") {
      toast.info("Dein Konto wartet noch auf Freischaltung durch einen Administrator.");
    }
  }, [navigate]);

  async function onLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    setLoading(true);
    const { data: signIn, error } = await supabase.auth.signInWithPassword({
      email,
      password: String(fd.get("password")),
    });
    if (error) {
      setLoading(false);
      const code = (error as any).code || "";
      if (code === "email_not_confirmed" || /not confirmed/i.test(error.message)) {
        toast.error("E-Mail-Adresse noch nicht bestätigt.", {
          description: "Bitte bestätige zuerst deine E-Mail-Adresse über den Link, den wir dir zugeschickt haben.",
          duration: 10000,
          action: {
            label: "Erneut senden",
            onClick: async () => {
              const { error: rErr } = await supabase.auth.resend({ type: "signup", email });
              if (rErr) toast.error(rErr.message);
              else toast.success("Bestätigungs-E-Mail wurde erneut gesendet.");
            },
          },
        });
        return;
      }
      if (code === "invalid_credentials" || /invalid login credentials/i.test(error.message)) {
        toast.error("Anmeldung fehlgeschlagen", { description: "E-Mail oder Passwort ist falsch.", duration: 8000 });
        return;
      }
      toast.error("Anmeldung fehlgeschlagen", { description: error.message, duration: 8000 });
      return;
    }

    const userId = signIn.user?.id;
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", userId)
        .maybeSingle();
      if (profile?.status && profile.status !== "active") {
        await supabase.auth.signOut();
        setLoading(false);
        const msg = profile.status === "pending"
          ? "Dein Konto wartet noch auf Freischaltung durch einen Administrator."
          : "Dein Konto ist derzeit nicht aktiv. Bitte kontaktiere den Vorstand.";
        toast.error(msg);
        return;
      }
    }

    setLoading(false);
    toast.success("Willkommen zurück!");
    navigate({ to: "/portal" });
  }

  async function onReset() {
    const email = prompt("E-Mail-Adresse für Passwort-Reset:");
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    if (error) toast.error(error.message);
    else toast.success("E-Mail zum Zurücksetzen wurde versendet.");
  }

  return (
    <div className="min-h-screen bg-hero flex items-center justify-center p-4">
      <div className="absolute top-4 left-4">
        <Button asChild variant="heroOutline" size="sm"><Link to="/"><ArrowLeft className="h-4 w-4" />Zur Webseite</Link></Button>
      </div>
      <Card className="w-full max-w-md shadow-card border-0">
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <img src={logo} alt="Sicher Schwimmen e.V." className="h-28 w-auto object-contain mx-auto mb-2" height={112} />
            <h1 className="font-display font-bold text-2xl text-primary-deep">Mitgliederbereich</h1>
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1"><Waves className="h-3.5 w-3.5" /> Sicher Schwimmen e.V.</p>
          </div>
          <Tabs defaultValue="login">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Anmelden</TabsTrigger>
              <TabsTrigger value="signup">Registrieren</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={onLogin} className="space-y-4 pt-4">
                <div><Label htmlFor="email">E-Mail</Label><Input id="email" type="email" name="email" required /></div>
                <div><Label htmlFor="password">Passwort</Label><Input id="password" type="password" name="password" required /></div>
                <Button type="submit" variant="accent" className="w-full" disabled={loading}>Anmelden</Button>
                <button type="button" onClick={onReset} className="text-xs text-primary hover:underline w-full text-center">Passwort vergessen?</button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <div className="pt-4 space-y-4">
                <div className="rounded-md border border-primary/20 bg-primary/5 p-4 text-sm">
                  <div className="flex gap-2 items-start">
                    <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-primary-deep mb-1">Registrierung nur über Mitgliedsantrag</p>
                      <p className="text-muted-foreground">
                        Eine direkte Registrierung ist nicht möglich. Bitte stellen Sie zuerst Ihren Mitgliedsantrag — am Ende des Formulars können Sie Ihr Konto direkt anlegen.
                      </p>
                    </div>
                  </div>
                </div>
                <Button asChild variant="accent" className="w-full">
                  <Link to="/mitgliedschaft">Zum Mitgliedsantrag</Link>
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
