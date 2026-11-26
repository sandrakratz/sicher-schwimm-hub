import { normChildName, type ChildBooking, type ChildEntry } from "@/lib/family-child-status";
import type { WaitlistData } from "@/components/admin/warteliste/logic";
import type { Participant } from "@/components/admin/kurse/shared";

export type FamilyChild = {
  key: string;
  name: string;
  dob: string | null;
  entries: ChildEntry[];
  bookings: ChildBooking[];
};

type OverviewChild = { name: string; dob: string | null };

/**
 * Kinder der Familie mit ihren Einträgen und Buchungen. Zuordnung über den normalisierten
 * Kindernamen (wie in der Familienübersicht).
 */
export function buildFamilyChildren(
  children: OverviewChild[],
  entryIds: string[],
  waitlist: WaitlistData | undefined,
  rows: Participant[] | null,
  courseName: (id: string) => string,
  courseStart: (id: string) => string | null,
): FamilyChild[] {
  const ids = new Set(entryIds);
  const entries = (waitlist?.entries ?? []).filter((e) => ids.has(e.id));
  return children.map((c) => {
    const key = normChildName(c.name);
    return {
      key,
      name: c.name,
      dob: c.dob,
      entries: entries
        .filter((e) => normChildName(e.child_name) === key)
        .map((e) => ({
          id: e.id,
          status: e.status,
          program: waitlist?.programs.find((p) => p.id === e.program_id)?.name ?? null,
          offerCourse: e.offer_course_id
            ? (waitlist?.courses.find((x) => x.id === e.offer_course_id)?.name ?? null)
            : null,
          offerExpiresAt: e.offer_expires_at ?? null,
          availableFrom: e.available_from ?? null,
          adminNotes: e.admin_notes ?? null,
          respondedAt: e.responded_at ?? null,
          createdAt: e.created_at,
        })),
      bookings: (rows ?? [])
        .filter((p) => normChildName(p.participant_name) === key)
        .map((p) => {
          const x = p as Participant & {
            cancelled_at?: string | null;
            transferred_at?: string | null;
          };
          return {
            id: p.id,
            status: p.status,
            course: courseName(p.course_id),
            startsOn: courseStart(p.course_id),
            paid: !!p.paid,
            removedAt: p.removed_at ?? null,
            cancelledAt: x.cancelled_at ?? null,
            transferredAt: x.transferred_at ?? null,
            cancelReason: p.cancel_reason ?? null,
            createdAt: p.created_at ?? "",
          };
        }),
    };
  });
}
