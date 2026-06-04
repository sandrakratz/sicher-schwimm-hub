import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Waves, ArrowLeft } from "lucide-react";
import logoAsset from "@/assets/logo-sicher-schwimmen.jpg.asset.json";
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
  }, [navigate]);

  async function onLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Willkommen zurück!");
    navigate({ to: "/portal" });
  }

  async function onSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      options: {
        emailRedirectTo: window.location.origin + "/portal",
        data: { first_name: fd.get("first_name"), last_name: fd.get("last_name") },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Bitte E-Mail-Adresse bestätigen.");
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
              <form onSubmit={onSignup} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label htmlFor="first_name">Vorname</Label><Input id="first_name" name="first_name" required /></div>
                  <div><Label htmlFor="last_name">Nachname</Label><Input id="last_name" name="last_name" required /></div>
                </div>
                <div><Label htmlFor="signup_email">E-Mail</Label><Input id="signup_email" type="email" name="email" required /></div>
                <div><Label htmlFor="signup_password">Passwort (min. 8 Zeichen)</Label><Input id="signup_password" type="password" name="password" required minLength={8} /></div>
                <Button type="submit" variant="accent" className="w-full" disabled={loading}>Registrieren</Button>
                <p className="text-xs text-muted-foreground text-center">Eine Bestätigungs-E-Mail wird gesendet.</p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
