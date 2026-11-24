import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { ContactForm } from "@/components/portal/ContactForm";

// Alte Adresse bleibt erreichbar; im Menü steht das Formular jetzt unter „Nachrichten“.
export const Route = createFileRoute("/_authenticated/portal/kontakt")({
  component: PortalContact,
});

function PortalContact() {
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-bold text-primary-deep mb-6">
        Verein kontaktieren
      </h1>
      <Card className="border-0 shadow-soft">
        <CardContent className="p-6">
          <ContactForm />
        </CardContent>
      </Card>
    </div>
  );
}
