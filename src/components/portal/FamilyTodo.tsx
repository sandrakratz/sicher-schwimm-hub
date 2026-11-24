import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarX, Euro, Hourglass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PaymentSummary } from "@/components/PaymentSummary";
import { formatDateTimeBerlin, todayBerlinIso } from "@/lib/format";

type Offer = {
  id: string;
  child_name: string;
  offer_token: string;
  offer_expires_at: string | null;
  courseName: string;
};

type Booking = {
  id: string;
  participant_name: string | null;
  price_amount: number | null;
  paid: boolean;
  status: string;
  member_check: string | null;
  push_token: string | null;
  created_at: string;
  courses: {
    name: string;
    starts_on: string | null;
    ends_on: string | null;
    payment_due_days: number | null;
  } | null;
};

/**
 * „Zu tun“ im Portal: was die Familie jetzt erledigen kann – Platzangebote beantworten, offene
 * Zahlungen, Kind für einen Termin abmelden. Antworten und Abmelden laufen über dieselben Seiten
 * wie die Links in den E-Mails, es gibt also keinen zweiten Weg mit eigenen Regeln.
 */
export function FamilyTodo() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: wl }, { data: cp }] = await Promise.all([
        supabase
          .from("waitlist_entries")
          .select("id,child_name,offer_token,offer_expires_at,offer_course_id")
          .eq("parent_user_id", u.user.id)
          .eq("status", "offered")
          .not("offer_token", "is", null),
        supabase
          .from("course_participants")
          .select(
            "id,participant_name,price_amount,paid,status,member_check,push_token,created_at,courses!course_participants_course_id_fkey(name,starts_on,ends_on,payment_due_days)",
          )
          .or(`parent_user_id.eq.${u.user.id},user_id.eq.${u.user.id}`)
          .eq("status", "confirmed"),
      ]);
      const offerRows = wl ?? [];
      const courseIds = [
        ...new Set(offerRows.map((o) => o.offer_course_id).filter(Boolean)),
      ] as string[];
      const { data: courseRows } = courseIds.length
        ? await supabase.from("courses").select("id,name").in("id", courseIds)
        : { data: [] as { id: string; name: string }[] };
      const nameOf = new Map((courseRows ?? []).map((c) => [c.id, c.name]));
      setOffers(
        offerRows.map((o) => ({
          id: o.id,
          child_name: o.child_name ?? "Ihr Kind",
          offer_token: o.offer_token as string,
          offer_expires_at: o.offer_expires_at,
          courseName: (o.offer_course_id && nameOf.get(o.offer_course_id)) || "einen Kursplatz",
        })),
      );
      setBookings((cp ?? []) as unknown as Booking[]);
      setLoaded(true);
    })().catch(() => setLoaded(true));
  }, []);

  if (!loaded) return null;
  const today = todayBerlinIso();
  const running = bookings.filter((b) => !b.courses?.ends_on || b.courses.ends_on >= today);
  // Zahlungsdaten erst, wenn der Preis feststeht (Mitgliedschaft geprüft) – wie bei den Zahlungsmails
  const unpaid = running.filter((b) => !b.paid && b.member_check !== "pending");
  const priceInCheck = running.filter((b) => !b.paid && b.member_check === "pending");
  const canAbsent = running.filter((b) => !!b.push_token);
  if (
    offers.length === 0 &&
    unpaid.length === 0 &&
    priceInCheck.length === 0 &&
    canAbsent.length === 0
  )
    return null;

  return (
    <section aria-labelledby="zu-tun" className="space-y-3">
      <h2 id="zu-tun" className="font-display text-2xl font-bold text-primary-deep">
        Zu tun
      </h2>

      {offers.map((o) => (
        <Card key={o.id} className="border-0 bg-accent/10 shadow-soft">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <Hourglass className="mt-0.5 h-5 w-5 text-accent" aria-hidden="true" />
              <div>
                <div className="font-semibold text-primary-deep">
                  Platzangebot für {o.child_name}: {o.courseName}
                </div>
                {o.offer_expires_at && (
                  <div className="text-sm text-muted-foreground">
                    Bitte antworten bis {formatDateTimeBerlin(o.offer_expires_at)}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="accent">
                <Link to="/warteliste/antwort" search={{ token: o.offer_token, aktion: "zusage" }}>
                  Platz annehmen
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/warteliste/antwort" search={{ token: o.offer_token, aktion: "absage" }}>
                  Absagen
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {unpaid.map((b) => (
        <Card key={b.id} className="border-0 shadow-soft">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start gap-3">
              <Euro className="mt-0.5 h-5 w-5 text-accent" aria-hidden="true" />
              <div className="font-semibold text-primary-deep">
                Zahlung offen: {b.participant_name ?? "Kurs"} · {b.courses?.name ?? ""}
              </div>
            </div>
            <PaymentSummary
              startsOn={b.courses?.starts_on}
              paymentDueDays={b.courses?.payment_due_days}
              amount={b.price_amount}
              bookedAt={b.created_at}
            />
          </CardContent>
        </Card>
      ))}

      {priceInCheck.map((b) => (
        <Card key={b.id} className="border-0 shadow-soft">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <Euro className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <div>
              <div className="font-semibold text-primary-deep">
                {b.participant_name ?? "Kurs"} · {b.courses?.name ?? ""}
              </div>
              <div className="text-muted-foreground">
                Wir prüfen noch die Mitgliedschaft. Danach bekommen Sie die Zahlungsdaten per Mail.
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {canAbsent.length > 0 && (
        <Card className="border-0 shadow-soft">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start gap-3">
              <CalendarX className="mt-0.5 h-5 w-5 text-accent" aria-hidden="true" />
              <div>
                <div className="font-semibold text-primary-deep">
                  Kind für einen Termin abmelden
                </div>
                <div className="text-sm text-muted-foreground">
                  Ohne Begründung. Die Trainer:innen sehen es sofort.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canAbsent.map((b) => (
                <Button key={b.id} asChild variant="outline">
                  <Link to="/abmelden" search={{ token: b.push_token as string }}>
                    {b.participant_name ?? "Kind"} · {b.courses?.name ?? "Kurs"}
                  </Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
