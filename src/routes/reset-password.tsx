import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Passwort zurücksetzen" }] }),
  component: ResetPage,
});

function ResetPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password"));
    if (password.length < 8) { toast.error("Mindestens 8 Zeichen"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Passwort aktualisiert.");
    navigate({ to: "/portal" });
  }
  return (
    <div className="min-h-screen bg-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-card">
        <CardContent className="p-8">
          <h1 className="font-display font-bold text-2xl text-primary-deep mb-4">Neues Passwort setzen</h1>
          <form onSubmit={onSubmit} className="space-y-4">
            <div><Label htmlFor="password">Neues Passwort</Label><Input id="password" type="password" name="password" required minLength={8} /></div>
            <Button type="submit" variant="accent" className="w-full" disabled={loading}>Passwort speichern</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
