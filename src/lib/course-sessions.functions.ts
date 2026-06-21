import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const generateCourseListXlsx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { courseId: string }) => {
    if (!d || typeof d.courseId !== "string" || d.courseId.length < 8) {
      throw new Error("courseId required");
    }
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const isStaff =
      (await supabase.rpc("has_role", { _user_id: userId, _role: "admin" })).data ||
      (await supabase.rpc("has_role", { _user_id: userId, _role: "board" })).data ||
      (await supabase.rpc("has_role", { _user_id: userId, _role: "trainer" })).data;
    if (!isStaff) throw new Error("Forbidden");

    const { data: course, error: cErr } = await supabase
      .from("courses")
      .select("id,name,location,starts_on,ends_on,schedule")
      .eq("id", data.courseId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!course) throw new Error("Kurs nicht gefunden");

    const { data: sessionsData } = await supabase
      .from("course_sessions")
      .select("session_index,session_date")
      .eq("course_id", data.courseId)
      .order("session_index", { ascending: true });
    const sessions = sessionsData || [];

    const { data: partsData } = await supabase
      .from("course_participants")
      .select("participant_name,participant_phone,date_of_birth,notes,status")
      .eq("course_id", data.courseId)
      .eq("status", "confirmed");
    const participants = (partsData || []).slice().sort((a, b) =>
      (a.participant_name || "").localeCompare(b.participant_name || "", "de"),
    );

    const firstSessionDate =
      sessions.find((s) => s.session_index === 1)?.session_date ||
      sessions[0]?.session_date ||
      course.starts_on ||
      null;

    function ageAt(dob: string | null, ref: string | null): string {
      if (!dob || !ref) return "";
      const d = new Date(dob);
      const r = new Date(ref);
      if (isNaN(d.getTime()) || isNaN(r.getTime())) return "";
      let a = r.getFullYear() - d.getFullYear();
      const m = r.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && r.getDate() < d.getDate())) a--;
      return String(a);
    }

    function fmtDe(s: string | null): string {
      if (!s) return "";
      const [y, m, d] = s.split("-");
      if (!y || !m || !d) return s;
      return `${d}.${m}.${y}`;
    }

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "sicher-schwimmen.com";
    wb.created = new Date();
    const ws = wb.addWorksheet("Kursliste", {
      pageSetup: {
        orientation: "landscape",
        paperSize: 9, // A4
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2,
        },
      },
    });

    // Header rows
    const period =
      course.starts_on || course.ends_on
        ? `${fmtDe(course.starts_on)}${course.ends_on ? ` – ${fmtDe(course.ends_on)}` : ""}`
        : "";
    const titleRow = ws.addRow([`Kursliste: ${course.name}`]);
    titleRow.font = { bold: true, size: 14 };
    ws.mergeCells(titleRow.number, 1, titleRow.number, 18);

    const metaRow = ws.addRow([
      [period && `Zeitraum: ${period}`, course.location && `Ort: ${course.location}`, course.schedule && `Zeitplan: ${course.schedule}`]
        .filter(Boolean)
        .join("    ·    "),
    ]);
    metaRow.font = { italic: true, size: 10 };
    ws.mergeCells(metaRow.number, 1, metaRow.number, 18);

    ws.addRow([]);

    // Column headers
    const headers = [
      "Nr.",
      "Name des Teilnehmers",
      "Kursziel erreicht",
      "Klötze",
      ...Array.from({ length: 10 }, (_, i) => {
        const s = sessions.find((x) => x.session_index === i + 1);
        return s ? fmtDe(s.session_date) : `${i + 1}. Kurstermin`;
      }),
      "Telefonnummer",
      "Alter bei Kursbeginn",
      "Notiz",
    ];
    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    headerRow.height = 32;

    // Data rows
    const dataRowsStart = headerRow.number + 1;
    const formatName = (n: string | null): string =>
      (n || "")
        .replace(/[,;]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    participants.forEach((p, idx) => {
      const row = ws.addRow([
        idx + 1,
        formatName(p.participant_name),
        "",
        "",
        "", "", "", "", "", "", "", "", "", "",
        p.participant_phone || "",
        ageAt(p.date_of_birth, firstSessionDate),
        p.notes || "",
      ]);
      row.alignment = { vertical: "middle", wrapText: true };
      row.height = 22;
    });

    // Ensure at least a few blank rows for printing if no participants
    if (participants.length === 0) {
      for (let i = 0; i < 5; i++) ws.addRow(["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    }

    const lastRow = ws.lastRow!.number;
    const totalCols = headers.length;

    // Column widths
    const widths = [4, 28, 8, 7, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 16, 8, 24];
    widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

    // Borders on all body cells
    for (let r = headerRow.number; r <= lastRow; r++) {
      for (let c = 1; c <= totalCols; c++) {
        const cell = ws.getCell(r, c);
        cell.border = {
          top: { style: "thin" }, left: { style: "thin" },
          bottom: { style: "thin" }, right: { style: "thin" },
        };
      }
    }
    // Light fill on header
    for (let c = 1; c <= totalCols; c++) {
      ws.getCell(headerRow.number, c).fill = {
        type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F1FA" },
      };
    }

    ws.views = [{ state: "frozen", ySplit: headerRow.number }];

    const buf = await wb.xlsx.writeBuffer();
    const base64 = Buffer.from(buf).toString("base64");

    const safeName = course.name.replace(/[^\p{L}\p{N}\-_]+/gu, "_").slice(0, 60);
    const datePart = firstSessionDate || new Date().toISOString().slice(0, 10);
    const filename = `Kursliste_${safeName}_${datePart}.xlsx`;

    // Audit
    try {
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit(null, userId, {
        action: "course_list_exported",
        entity: "courses",
        entity_id: data.courseId,
        metadata: { participants: participants.length, sessions: sessions.length },
      });
    } catch {}

    return { filename, base64 };
  });
