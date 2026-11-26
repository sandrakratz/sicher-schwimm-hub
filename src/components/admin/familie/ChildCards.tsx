import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MoreMenu } from "@/components/admin/MoreMenu";
import { formatDateBerlin, todayBerlinIso } from "@/lib/format";
import {
  CONCERN_LABEL,
  ageYears,
  childStatus,
  suggestedConcerns,
  type Concern,
  type StatusTone,
} from "@/lib/family-child-status";
import type { FamilyChild } from "./buildFamilyChildren";

const TONE: Record<StatusTone, string> = {
  good: "bg-emerald-100 text-emerald-900",
  info: "bg-blue-100 text-blue-900",
  warn: "bg-amber-100 text-amber-900",
  neutral: "bg-slate-100 text-slate-700",
};

/**
 * Eine Karte je Kind: Name, Alter, ein Satz zum aktuellen Stand und die wahrscheinlichsten
 * Aktionen. Die Aktionen öffnen „Eltern melden sich …“ mit vorgewähltem Anliegen.
 */
export function ChildCards({
  childrenList,
  loading,
  onReport,
}: {
  childrenList: FamilyChild[];
  loading: boolean;
  onReport: (childKey: string, concern: Concern | null) => void;
}) {
  const today = todayBerlinIso();
  if (childrenList.length === 0)
    return <p className="text-sm text-muted-foreground">Keine Kinder erfasst.</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {childrenList.map((c) => {
        const st = childStatus(c.entries, c.bookings, today);
        const age = ageYears(c.dob, today);
        const buttons = suggestedConcerns(c.entries, c.bookings);
        return (
          <Card key={c.key}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">{c.name}</h2>
                <span className="text-sm text-muted-foreground">
                  {age != null ? `${age} Jahre` : "Alter unbekannt"}
                  {c.dob ? ` · geb. ${formatDateBerlin(c.dob)}` : ""}
                </span>
              </div>
              {loading ? (
                <p className="text-sm text-muted-foreground">Stand wird geladen …</p>
              ) : (
                <Badge
                  variant="secondary"
                  className={`h-auto whitespace-normal text-left text-sm font-normal ${TONE[st.tone]}`}
                >
                  {st.sentence}
                </Badge>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {buttons.map((k, i) => (
                  <Button
                    key={k}
                    size="sm"
                    variant={i === 0 ? "default" : "outline"}
                    onClick={() => onReport(c.key, k)}
                  >
                    {BUTTON_LABEL[k]}
                  </Button>
                ))}
                <MoreMenu
                  items={[
                    {
                      label: "Eltern melden sich …",
                      hint: "Absage, Abmeldung, anderer Kurs oder Krankheit festhalten",
                      onSelect: () => onReport(c.key, null),
                    },
                  ]}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/** Kurze Knopftexte der Karte (der volle Text steht im Dialog). */
const BUTTON_LABEL: Record<Concern, string> = {
  leave: "Möchte nicht mehr",
  decline_stay: "Sagt Platz ab",
  other_course: "Anderer Kurs",
  sick: CONCERN_LABEL.sick,
};
