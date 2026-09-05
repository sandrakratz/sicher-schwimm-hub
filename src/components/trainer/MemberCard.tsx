import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Mail, Phone } from "lucide-react";
import { formatDateBerlin } from "@/lib/format";
import { cn } from "@/lib/utils";

type Person = { name: string; date_of_birth?: string | null };

export type MemberCardData = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  membership_type: string;
  member_since: string;
  partner?: Person | null;
  children: Person[];
};

const TYPE_LABEL: Record<string, string> = {
  children_youth: "Kinder & Jugend",
  adult: "Erwachsene",
  family: "Familie",
  supporting: "Förderung",
};

/** Kompakte Mitglieds-Karte für kleine Displays. */
export function MemberCard({ m }: { m: MemberCardData }) {
  const [open, setOpen] = useState(false);
  const extra = (m.partner ? 1 : 0) + m.children.length;

  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{m.name || "—"}</div>
          <div className="truncate text-xs text-muted-foreground">
            {TYPE_LABEL[m.membership_type] || m.membership_type}
            {extra > 0 ? ` · +${extra} Familienmitglied${extra === 1 ? "" : "er"}` : ""}
          </div>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-4 text-sm">
          {m.phone && (
            <a href={`tel:${m.phone}`} className="flex min-h-11 items-center gap-2 text-primary">
              <Phone className="h-4 w-4" /> {m.phone}
            </a>
          )}
          {m.email && (
            <a href={`mailto:${m.email}`} className="flex min-h-11 items-center gap-2 break-all text-primary">
              <Mail className="h-4 w-4 shrink-0" /> {m.email}
            </a>
          )}
          <div className="text-xs text-muted-foreground">
            {m.date_of_birth ? `geb. ${formatDateBerlin(m.date_of_birth)} · ` : ""}
            Mitglied seit {formatDateBerlin(m.member_since)}
          </div>

          {m.partner && (
            <div className="rounded-md bg-muted/40 p-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Partner:in</Badge>
                <span className="text-sm">{m.partner.name}</span>
              </div>
              {m.partner.date_of_birth && (
                <div className="mt-1 text-xs text-muted-foreground">geb. {formatDateBerlin(m.partner.date_of_birth)}</div>
              )}
            </div>
          )}

          {m.children.map((c, i) => (
            <div key={`${m.id}-child-${i}`} className="rounded-md bg-muted/40 p-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Kind</Badge>
                <span className="text-sm">{c.name}</span>
              </div>
              {c.date_of_birth && (
                <div className="mt-1 text-xs text-muted-foreground">geb. {formatDateBerlin(c.date_of_birth)}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MemberCard;
