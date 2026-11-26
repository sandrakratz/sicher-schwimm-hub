// Server-only: Nachricht an alle Eltern eines Kurses (E-Mail je Adresse einmal + Handy-Mitteilung).
// Gemeinsam für „Eilnachricht an Eltern“ und „Termin fällt aus“.

export async function sendCourseBroadcast(opts: {
  courseId: string;
  subject: string;
  message: string;
  senderUserId: string;
  /** Eindeutiger Teil des Idempotenz-Schlüssels (z. B. Zeitstempel oder Termin-ID) */
  key: string;
}): Promise<{
  courseName: string;
  sent: number;
  total: number;
  pushSent: number;
  pushDevices: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: course } = await supabaseAdmin
    .from("courses")
    .select("id,name")
    .eq("id", opts.courseId)
    .maybeSingle();
  if (!course) throw new Error("Kurs nicht gefunden");
  const { queueTemplateEmail } = await import("@/lib/email-send.server");
  const { data: parts } = await supabaseAdmin
    .from("course_participants")
    .select("id,participant_name,participant_email")
    .eq("course_id", course.id)
    .eq("status", "confirmed");
  const seen = new Set<string>();
  let sent = 0;
  for (const p of parts ?? []) {
    const email = p.participant_email?.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    const kids = (parts ?? [])
      .filter((x) => x.participant_email?.trim().toLowerCase() === email)
      .map((x) => x.participant_name)
      .filter(Boolean)
      .join(" und ");
    const r = await queueTemplateEmail({
      templateName: "course-broadcast",
      recipientEmail: p.participant_email!,
      senderUserId: opts.senderUserId,
      idempotencyKey: `course-broadcast-${course.id}-${p.id}-${opts.key}`,
      templateData: {
        subject: opts.subject,
        message: opts.message,
        course_name: course.name,
        child_name: kids || null,
      },
    });
    if (r.queued) sent++;
  }
  // Zusätzlich als Mitteilung aufs Handy (nur an Familien, die das aktiviert haben)
  const { sendPushToCourse } = await import("@/lib/push.server");
  const push = await sendPushToCourse(course.id, {
    title: opts.subject,
    body: opts.message.replace(/\s+/g, " ").slice(0, 160),
    url: "/",
    tag: `course-broadcast-${course.id}`,
  }).catch((e) => {
    console.error("push broadcast failed", e);
    return { sent: 0, devices: 0 };
  });
  return {
    courseName: course.name,
    sent,
    total: seen.size,
    pushSent: push.sent,
    pushDevices: push.devices,
  };
}
