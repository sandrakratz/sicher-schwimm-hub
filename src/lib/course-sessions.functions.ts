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

    // Trainer-Unterschriftenblock: Namen in Spalte 1, Unterschrift je Kurstermin
    let trainerNames: string[] = [];
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: roleRows } = await supabaseAdmin
        .from("user_roles")
        .select("user_id,role")
        .in("role", ["admin", "board", "trainer"]);
      const ids = Array.from(new Set((roleRows || []).map((r: any) => r.user_id)));
      if (ids.length > 0) {
        const { data: profs } = await supabaseAdmin
          .from("profiles")
          .select("id,first_name,last_name,email")
          .in("id", ids);
        trainerNames = (profs || [])
          .map((p: any) => [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.email || "")
          .filter(Boolean)
          .sort((a: string, b: string) => a.localeCompare(b, "de"));
      }
    } catch (err) {
      console.warn("[course-sessions] Nicht-kritischer Fehler:", err);
    }

    ws.addRow([]);
    const trainerTitle = ws.addRow(["Trainer – Anwesenheit (Unterschrift je Kurstermin)"]);
    trainerTitle.font = { bold: true, size: 12 };
    ws.mergeCells(trainerTitle.number, 1, trainerTitle.number, headers.length);

    const trainerHeaders = [
      "Trainer",
      "",
      "",
      "",
      ...Array.from({ length: 10 }, (_, i) => {
        const s = sessions.find((x) => x.session_index === i + 1);
        return s ? fmtDe(s.session_date) : `${i + 1}. Kurstermin`;
      }),
      "",
      "",
      "",
    ];
    const trainerHeaderRow = ws.addRow(trainerHeaders);
    trainerHeaderRow.font = { bold: true };
    trainerHeaderRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    trainerHeaderRow.height = 28;

    const trainerRowsStart = trainerHeaderRow.number + 1;
    const namesForRows = trainerNames.length > 0 ? trainerNames : ["", "", "", "", ""];
    for (const n of namesForRows) {
      const row = ws.addRow([n, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
      row.alignment = { vertical: "middle", wrapText: true };
      row.height = 26;
    }
    const trainerRowsEnd = ws.lastRow!.number;

    for (let r = trainerHeaderRow.number; r <= trainerRowsEnd; r++) {
      for (let c = 1; c <= 14; c++) {
        ws.getCell(r, c).border = {
          top: { style: "thin" }, left: { style: "thin" },
          bottom: { style: "thin" }, right: { style: "thin" },
        };
      }
    }
    for (let c = 1; c <= 14; c++) {
      ws.getCell(trainerHeaderRow.number, c).fill = {
        type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF7EC" },
      };
    }
    for (let r = trainerRowsStart; r <= trainerRowsEnd; r++) {
      ws.mergeCells(r, 1, r, 4);
      ws.getCell(r, 1).alignment = { vertical: "middle", wrapText: true };
    }
    ws.mergeCells(trainerHeaderRow.number, 1, trainerHeaderRow.number, 4);

    const lastRow = headerRow.number + Math.max(participants.length, participants.length === 0 ? 5 : 0);

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
    } catch (err) {
      console.warn("[course-sessions] Nicht-kritischer Fehler:", err);
    }

    return { filename, base64 };
  });

export const generateTaxParticipantListXlsx = createServerFn({ method: "POST" })
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

    const { data: partsData } = await supabase
      .from("course_participants")
      .select(
        "participant_name,participant_email,participant_phone,date_of_birth,status,is_member,online_booking,price_amount,paid,paid_at,payment_note,created_at,notes",
      )
      .eq("course_id", data.courseId);
    const participants = (partsData || []).slice().sort((a, b) =>
      (a.participant_name || "").localeCompare(b.participant_name || "", "de"),
    );

    function fmtDe(s: string | null): string {
      if (!s) return "";
      const [y, m, d] = s.split("-");
      if (!y || !m || !d) return s;
      return `${d}.${m}.${y}`;
    }
    function fmtTs(s: string | null): string {
      if (!s) return "";
      try {
        return new Intl.DateTimeFormat("de-DE", {
          timeZone: "Europe/Berlin",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }).format(new Date(s));
      } catch {
        return "";
      }
    }
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
    const STATUS: Record<string, string> = {
      confirmed: "bestätigt",
      waiting: "Warteliste",
      cancelled: "storniert",
    };

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "sicher-schwimmen.com";
    wb.created = new Date();
    const ws = wb.addWorksheet("Teilnehmerliste", {
      pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    const period =
      course.starts_on || course.ends_on
        ? `${fmtDe(course.starts_on)}${course.ends_on ? ` – ${fmtDe(course.ends_on)}` : ""}`
        : "";
    const titleRow = ws.addRow([`Teilnehmerliste (Steuer): ${course.name}`]);
    titleRow.font = { bold: true, size: 14 };
    ws.mergeCells(titleRow.number, 1, titleRow.number, 14);

    const metaRow = ws.addRow([
      [
        period && `Zeitraum: ${period}`,
        course.location && `Ort: ${course.location}`,
        course.schedule && `Zeitplan: ${course.schedule}`,
        `Erstellt: ${fmtTs(new Date().toISOString())}`,
      ]
        .filter(Boolean)
        .join("    ·    "),
    ]);
    metaRow.font = { italic: true, size: 10 };
    ws.mergeCells(metaRow.number, 1, metaRow.number, 14);
    ws.addRow([]);

    const headers = [
      "Nr.",
      "Name des Kindes",
      "Geburtsdatum",
      "Alter bei Kursbeginn",
      "Kontakt / Eltern",
      "E-Mail",
      "Telefon",
      "Mitglied",
      "Status",
      "Buchungsart",
      "Betrag (€)",
      "Bezahlt",
      "Bezahlt am",
      "Zahlungsnotiz",
      "Anmeldung",
    ];
    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    headerRow.height = 32;

    const firstDataRow = headerRow.number + 1;
    participants.forEach((p, idx) => {
      const row = ws.addRow([
        idx + 1,
        p.participant_name || "",
        fmtDe(p.date_of_birth),
        ageAt(p.date_of_birth, course.starts_on),
        p.participant_name || "",
        p.participant_email || "",
        p.participant_phone || "",
        p.is_member == null ? "" : p.is_member ? "ja" : "nein",
        STATUS[p.status] || p.status,
        p.online_booking ? "online gebucht" : "manuell",
        p.price_amount != null ? Number(p.price_amount) : null,
        p.paid ? "ja" : "nein",
        fmtTs(p.paid_at),
        p.payment_note || "",
        fmtTs(p.created_at),
      ]);
      row.alignment = { vertical: "middle", wrapText: true };
      row.getCell(11).numFmt = '#,##0.00 "€"';
    });

    const lastDataRow = headerRow.number + participants.length;
    const totalCols = headers.length;

    let sumRowNumber = 0;
    if (participants.length > 0) {
      const sumRow = ws.addRow([]);
      sumRowNumber = sumRow.number;
      sumRow.getCell(1).value = `Summe (${participants.length} Teilnehmer)`;
      ws.mergeCells(sumRowNumber, 1, sumRowNumber, 10);
      sumRow.getCell(11).value = { formula: `SUM(K${firstDataRow}:K${lastDataRow})` } as never;
      sumRow.getCell(11).numFmt = '#,##0.00 "€"';
      sumRow.getCell(12).value = "bezahlt:";
      sumRow.getCell(13).value = {
        formula: `SUMIF(L${firstDataRow}:L${lastDataRow},"ja",K${firstDataRow}:K${lastDataRow})`,
      } as never;
      sumRow.getCell(13).numFmt = '#,##0.00 "€"';
      sumRow.getCell(14).value = "offen:";
      sumRow.getCell(15).value = {
        formula: `SUMIF(L${firstDataRow}:L${lastDataRow},"nein",K${firstDataRow}:K${lastDataRow})`,
      } as never;
      sumRow.getCell(15).numFmt = '#,##0.00 "€"';
      sumRow.font = { bold: true };
    }

    const widths = [4, 26, 13, 9, 24, 30, 16, 9, 12, 14, 12, 9, 13, 24, 13];
    widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

    const lastRow = ws.lastRow!.number;
    for (let r = headerRow.number; r <= lastRow; r++) {
      for (let c = 1; c <= totalCols; c++) {
        ws.getCell(r, c).border = {
          top: { style: "thin" }, left: { style: "thin" },
          bottom: { style: "thin" }, right: { style: "thin" },
        };
      }
    }
    for (let c = 1; c <= totalCols; c++) {
      ws.getCell(headerRow.number, c).fill = {
        type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F1FA" },
      };
    }
    ws.views = [{ state: "frozen", ySplit: headerRow.number }];

    const buf = await wb.xlsx.writeBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    const safeName = course.name.replace(/[^\p{L}\p{N}\-_]+/gu, "_").slice(0, 60);
    const datePart = course.starts_on || new Date().toISOString().slice(0, 10);
    const filename = `Teilnehmerliste_Steuer_${safeName}_${datePart}.xlsx`;

    try {
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit(null, userId, {
        action: "tax_participant_list_exported",
        entity: "courses",
        entity_id: data.courseId,
        metadata: { participants: participants.length },
      });
    } catch (err) {
      console.warn("[course-sessions] Nicht-kritischer Fehler:", err);
    }

    return { filename, base64 };
  });

export const generateCourseConfirmations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { courseId: string; format: "pdf" | "zip" }) => {
    if (!d || typeof d.courseId !== "string" || d.courseId.length < 8) {
      throw new Error("courseId required");
    }
    if (d.format !== "pdf" && d.format !== "zip") throw new Error("invalid format");
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
      .select("id,name,location,starts_on,ends_on,schedule,unit_count,payment_due_days,program_id,course_programs(name,location)")
      .eq("id", data.courseId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!course) throw new Error("Kurs nicht gefunden");

    const program = (course as any).course_programs as { name: string; location: string | null } | null;

    const { data: partsData } = await supabase
      .from("course_participants")
      .select(
        "participant_name,payer_street,payer_zip,payer_city,price_amount,document_no,document_issued_at,created_at,request_id,status",
      )
      .eq("course_id", data.courseId)
      .eq("status", "confirmed");

    const participants = (partsData || []).slice().sort((a, b) =>
      (a.participant_name || "").localeCompare(b.participant_name || "", "de"),
    );
    if (participants.length === 0) throw new Error("Keine bestätigten Teilnehmer in diesem Zeitraum.");

    const requestIds = participants.map((p) => p.request_id).filter(Boolean) as Array<string>;
    const payerByRequest = new Map<string, string>();
    if (requestIds.length > 0) {
      const { data: reqs } = await supabase
        .from("course_requests")
        .select("id,parent_name")
        .in("id", requestIds);
      for (const r of reqs || []) if (r.parent_name) payerByRequest.set(r.id, r.parent_name);
    }

    const inputs = participants.map((p) => ({
      documentNo: p.document_no,
      issuedAt: p.document_issued_at || p.created_at,
      payerName: (p.request_id && payerByRequest.get(p.request_id)) || p.participant_name,
      payerStreet: p.payer_street,
      payerZip: p.payer_zip,
      payerCity: p.payer_city,
      childName: p.participant_name,
      courseName: course.name,
      programName: program?.name ?? null,
      startsOn: course.starts_on,
      endsOn: course.ends_on,
      schedule: course.schedule,
      location: course.location ?? program?.location ?? null,
      unitCount: course.unit_count,
      priceAmount: p.price_amount != null ? Number(p.price_amount) : null,
      paymentDueDays: course.payment_due_days ?? 14,
    }));

    const safe = (s: string) => s.replace(/[^\p{L}\p{N}\-_]+/gu, "_").slice(0, 60);
    const base = `Kursbestaetigungen_${safe(course.name)}_${course.starts_on || new Date().toISOString().slice(0, 10)}`;

    const { renderConfirmationPdf, renderConfirmationsPdf } = await import(
      "@/lib/course-confirmation-pdf.server"
    );

    let bytes: Uint8Array;
    let filename: string;
    if (data.format === "pdf") {
      bytes = await renderConfirmationsPdf(inputs);
      filename = `${base}.pdf`;
    } else {
      const { zipSync } = await import("fflate");
      const files: Record<string, Uint8Array> = {};
      for (const input of inputs) {
        const pdf = await renderConfirmationPdf(input);
        const name = `${safe(input.documentNo || "ohne-Nr")}_${safe(input.childName || "Teilnehmer")}.pdf`;
        files[name] = pdf;
      }
      bytes = zipSync(files, { level: 6 });
      filename = `${base}.zip`;
    }

    const base64 = Buffer.from(bytes).toString("base64");

    try {
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit(null, userId, {
        action: "course_confirmations_exported",
        entity: "courses",
        entity_id: data.courseId,
        metadata: { participants: participants.length, format: data.format },
      });
    } catch (err) {
      console.warn("[course-sessions] Nicht-kritischer Fehler:", err);
    }

    return { filename, base64 };
  });

export const generateMeinVereinCsv = createServerFn({ method: "POST" })
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
      .select("id,name,starts_on,ends_on,payment_due_days,course_programs(name)")
      .eq("id", data.courseId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!course) throw new Error("Kurs nicht gefunden");
    const program = (course as any).course_programs as { name: string } | null;

    const { data: partsData } = await supabase
      .from("course_participants")
      .select(
        "participant_name,participant_email,payer_street,payer_zip,payer_city,price_amount,document_no,document_issued_at,created_at,request_id",
      )
      .eq("course_id", data.courseId)
      .eq("status", "confirmed");

    const participants = (partsData || []).slice().sort((a, b) =>
      (a.participant_name || "").localeCompare(b.participant_name || "", "de"),
    );
    if (participants.length === 0) throw new Error("Keine bestätigten Buchungen in diesem Zeitraum.");

    const requestIds = participants.map((p) => p.request_id).filter(Boolean) as Array<string>;
    const payerByRequest = new Map<string, string>();
    if (requestIds.length > 0) {
      const { data: reqs } = await supabase
        .from("course_requests")
        .select("id,parent_name")
        .in("id", requestIds);
      for (const r of reqs || []) if (r.parent_name) payerByRequest.set(r.id, r.parent_name);
    }

    const { computeDueDate } = await import("@/lib/course-confirmation");
    const deDate = (d: Date | string | null | undefined) => {
      if (!d) return "";
      const dt = typeof d === "string" ? new Date(d) : d;
      if (isNaN(dt.getTime())) return "";
      return dt.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
    };
    const deAmount = (v: number | null) => (v == null ? "" : Number(v).toFixed(2).replace(".", ","));
    const splitName = (full: string) => {
      const parts = (full || "").trim().split(/\s+/);
      if (parts.length < 2) return { first: "", last: full || "" };
      return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1]! };
    };

    const courseTitle = program?.name || course.name;
    const periodLabel = course.starts_on
      ? `${deDate(course.starts_on)}${course.ends_on ? `–${deDate(course.ends_on)}` : ""}`
      : "";
    const dueDays = course.payment_due_days ?? 14;

    const headers = [
      "Rechnungsnummer",
      "Rechnungsdatum",
      "Fälligkeitsdatum",
      "Nachname",
      "Vorname",
      "Straße",
      "PLZ",
      "Ort",
      "E-Mail",
      "Teilnehmer",
      "Position",
      "Menge",
      "Einzelpreis",
      "Gesamtbetrag",
      "Steuersatz",
      "Verwendungszweck",
    ];

    const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines: Array<string> = [headers.map(esc).join(";")];
    let missingDocNo = 0;

    for (const p of participants) {
      const issuedAt = p.document_issued_at || p.created_at;
      const due = computeDueDate(issuedAt, dueDays, course.starts_on);
      const payerFull = (p.request_id && payerByRequest.get(p.request_id)) || p.participant_name || "";
      const { first, last } = splitName(payerFull);
      const amount = p.price_amount != null ? Number(p.price_amount) : null;
      if (!p.document_no) missingDocNo++;

      lines.push(
        [
          p.document_no || "",
          deDate(issuedAt),
          deDate(due),
          last,
          first,
          p.payer_street || "",
          p.payer_zip || "",
          p.payer_city || "",
          p.participant_email || "",
          p.participant_name || "",
          `${courseTitle}${periodLabel ? `, ${periodLabel}` : ""}`,
          "1",
          deAmount(amount),
          deAmount(amount),
          "0",
          `${p.document_no ? p.document_no + " / " : ""}${p.participant_name || ""}`,
        ]
          .map(esc)
          .join(";"),
      );
    }

    const csv = "\uFEFF" + lines.join("\r\n") + "\r\n";
    const base64 = Buffer.from(csv, "utf8").toString("base64");
    const safe = (s: string) => s.replace(/[^\p{L}\p{N}\-_]+/gu, "_").slice(0, 60);
    const filename = `MeinVerein_${safe(course.name)}_${course.starts_on || new Date().toISOString().slice(0, 10)}.csv`;

    try {
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit(null, userId, {
        action: "meinverein_csv_exported",
        entity: "courses",
        entity_id: data.courseId,
        metadata: { rows: participants.length, missing_document_no: missingDocNo },
      });
    } catch (err) {
      console.warn("[course-sessions] Nicht-kritischer Fehler:", err);
    }

    return { filename, base64, rows: participants.length, missingDocNo };
  });
