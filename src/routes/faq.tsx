import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/faq")({
  head: () => ({ meta: [
    { title: "FAQ – Häufige Fragen | Sicher Schwimmen e.V." },
    { name: "description", content: "Antworten auf häufige Fragen rund um Schwimmkurse, Mitgliedschaft und unseren Verein." },
  ]}),
  component: Page,
});

const faqs = [
  { q: "Ab welchem Alter können Kinder teilnehmen?", a: "Eltern-Kind-Kurse ab 1 Jahr, Wassergewöhnung ab 3 Jahren, Schwimmkurse in der Regel ab 5 Jahren." },
  { q: "Muss mein Kind schon schwimmen können?", a: "Nein. Wir starten je nach Kurs bei der ersten Wassergewöhnung." },
  { q: "Wie funktioniert die Warteliste?", a: "Über das Anfrageformular landen Sie auf der Warteliste. Wir melden uns, sobald ein Platz frei wird." },
  { q: "Was kostet die Mitgliedschaft?", a: "Kinder/Jugendliche & Erwachsene 60 €/Jahr, Familien 96 €/Jahr." },
  { q: "Gibt es Probestunden?", a: "Probestunden bieten wir je nach Kursauslastung an – bitte über Kontakt anfragen." },
  { q: "Was passiert, wenn mein Kind krank ist?", a: "Bitte melden Sie das Kind ab. Einzelne Termine können in Absprache nachgeholt werden." },
  { q: "Dürfen Eltern beim Unterricht zusehen?", a: "Bei Wassergewöhnung ja. Bei fortgeschrittenen Kursen entscheiden die Trainer*innen je nach Gruppe." },
  { q: "Wie wird die Sicherheit gewährleistet?", a: "Durch kleine Gruppen, qualifizierte Übungsleiter*innen, Rettungsschwimmer-Pflicht und unser Kinderschutzkonzept." },
  { q: "Welche Schwimmabzeichen kann mein Kind erwerben?", a: "Seepferdchen, Bronze, Silber und Gold." },
  { q: "Wie funktioniert das Mitgliederportal?", a: "Nach Aufnahme erhalten Sie einen Zugang zum Portal mit Kursinfos, Dokumenten und Vereinsnews." },
];

function Page() {
  return (
    <PublicLayout>
      <section className="bg-hero text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="font-display text-5xl font-bold mb-3">Häufige Fragen</h1>
          <p className="text-white/85 text-lg">Antworten auf die wichtigsten Fragen rund um unseren Verein.</p>
        </div>
      </section>
      <section className="container mx-auto px-4 py-16 max-w-3xl">
        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`i${i}`} className="border bg-card rounded-2xl px-6 shadow-soft">
              <AccordionTrigger className="text-left font-display font-bold text-primary-deep">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </PublicLayout>
  );
}
