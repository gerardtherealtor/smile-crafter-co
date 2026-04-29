// Generates the weekly timesheet report:
// 1. Tallies hours per employee for a given week (Mon-Sun)
// 2. Generates a PDF
// 3. Uploads to the weekly-reports storage bucket
// 4. Records it in weekly_reports
// 5. (If transactional email is set up) sends a link to both admin emails
//
// Body: { week_start?: "YYYY-MM-DD" }  defaults to the current week's Monday

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { jsPDF } from "npm:jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAILS = ["gwd978@gmail.com", "dwaynenoeconstructionllc@gmail.com"];

const pad = (n: number) => String(n).padStart(2, "0");

function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getMondayOfWeek(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return isoDate(dt);
}

function fmtHours(n: number) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function splitOT(total: number) {
  const regular = Math.min(40, total);
  const overtime = Math.max(0, total - 40);
  return { regular, overtime };
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let body: { week_start?: string } = {};
    try { body = await req.json(); } catch { /* allow empty */ }

    const monday = body.week_start ?? isoDate(getMondayOfWeek());
    const sunday = addDays(monday, 6);

    // 1. Load employees
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone")
      .order("full_name");
    if (pErr) throw pErr;

    // 2. Load time entries for the week
    const { data: entries, error: eErr } = await supabase
      .from("time_entries")
      .select("user_id, work_date, clock_in, clock_out, hours, job_id, notes")
      .gte("work_date", monday)
      .lte("work_date", sunday)
      .order("work_date");
    if (eErr) throw eErr;

    const { data: jobs } = await supabase.from("jobs").select("id, name");
    const jobName = (id: string | null) => jobs?.find((j) => j.id === id)?.name ?? "—";

    // 3. Aggregate
    type Row = { name: string; email: string; phone: string | null; total: number; entries: any[] };
    const rows: Row[] = (profiles ?? []).map((p) => ({
      name: p.full_name || p.email,
      email: p.email,
      phone: p.phone,
      total: 0,
      entries: [],
    }));

    for (const e of entries ?? []) {
      const r = rows.find((row) => (profiles ?? []).find((p) => p.id === e.user_id && p.email === row.email));
      if (r) {
        r.entries.push(e);
        r.total += Number(e.hours);
      }
    }

    let grandReg = 0, grandOT = 0;
    for (const r of rows) {
      const { regular, overtime } = splitOT(r.total);
      grandReg += regular;
      grandOT += overtime;
    }

    // 4. Build PDF
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const W = doc.internal.pageSize.getWidth();
    let y = 50;

    doc.setFillColor(10, 18, 48); // dark sapphire
    doc.rect(0, 0, W, 70, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("DWAYNE NOE CONSTRUCTION", 40, 35);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(230, 175, 90); // maple
    doc.text("WEEKLY CREW TIMESHEET", 40, 55);

    y = 100;
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(`Week: ${fmtDate(monday)}  –  ${fmtDate(sunday)}`, 40, y);
    y += 18;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString("en-US")}`, 40, y);
    y += 24;

    // Totals box
    doc.setFillColor(245, 240, 230);
    doc.rect(40, y, W - 80, 50, "F");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text("TOTAL REGULAR HOURS", 55, y + 18);
    doc.text("TOTAL OVERTIME HOURS", 240, y + 18);
    doc.text("CREW TOTAL", 425, y + 18);
    doc.setFontSize(20);
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.text(fmtHours(grandReg), 55, y + 40);
    doc.setTextColor(180, 100, 30);
    doc.text(fmtHours(grandOT), 240, y + 40);
    doc.setTextColor(20, 20, 20);
    doc.text(fmtHours(grandReg + grandOT), 425, y + 40);
    y += 70;

    // Per-employee table
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Per Employee", 40, y);
    y += 14;

    doc.setFontSize(9);
    doc.setFillColor(230, 230, 230);
    doc.rect(40, y, W - 80, 18, "F");
    doc.setTextColor(20, 20, 20);
    doc.text("Employee", 50, y + 12);
    doc.text("Phone", 230, y + 12);
    doc.text("Regular", 380, y + 12, { align: "right" });
    doc.text("OT", 450, y + 12, { align: "right" });
    doc.text("Total", 540, y + 12, { align: "right" });
    y += 22;

    doc.setFont("helvetica", "normal");
    for (const r of rows) {
      const { regular, overtime } = splitOT(r.total);
      if (y > 720) { doc.addPage(); y = 50; }
      doc.setTextColor(20, 20, 20);
      doc.text(r.name.slice(0, 30), 50, y);
      doc.setTextColor(120, 120, 120);
      doc.text((r.phone ?? "—").slice(0, 20), 230, y);
      doc.setTextColor(20, 20, 20);
      doc.text(fmtHours(regular), 380, y, { align: "right" });
      doc.setTextColor(overtime > 0 ? 180 : 120, overtime > 0 ? 100 : 120, overtime > 0 ? 30 : 120);
      doc.text(fmtHours(overtime), 450, y, { align: "right" });
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "bold");
      doc.text(fmtHours(r.total), 540, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 16;
    }

    y += 12;
    // Daily detail per employee
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    if (y > 700) { doc.addPage(); y = 50; }
    doc.text("Daily Detail", 40, y);
    y += 14;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    for (const r of rows) {
      if (r.entries.length === 0) continue;
      if (y > 700) { doc.addPage(); y = 50; }
      doc.setFont("helvetica", "bold");
      doc.setFillColor(245, 240, 230);
      doc.rect(40, y - 10, W - 80, 16, "F");
      doc.text(`${r.name} — ${fmtHours(r.total)} hrs`, 50, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      for (const ent of r.entries) {
        if (y > 750) { doc.addPage(); y = 50; }
        doc.text(fmtDate(ent.work_date), 50, y);
        doc.text(`${ent.clock_in.slice(0,5)}–${ent.clock_out.slice(0,5)}`, 200, y);
        doc.text(jobName(ent.job_id), 280, y);
        doc.text(`${fmtHours(Number(ent.hours))} hr`, 540, y, { align: "right" });
        y += 12;
        if (ent.notes) {
          doc.setTextColor(120, 120, 120);
          doc.text(`  ${ent.notes.slice(0, 100)}`, 50, y);
          doc.setTextColor(20, 20, 20);
          y += 12;
        }
      }
      y += 8;
    }

    const pdfBytes = doc.output("arraybuffer");

    // 5. Upload to storage
    const path = `${monday}/dnc-week-${monday}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("weekly-reports")
      .upload(path, new Uint8Array(pdfBytes), {
        contentType: "application/pdf",
        upsert: true,
      });
    if (upErr) throw upErr;

    // 6. Record / update weekly_reports
    const { data: report, error: rErr } = await supabase
      .from("weekly_reports")
      .upsert({
        week_start: monday,
        week_end: sunday,
        pdf_path: path,
        total_regular_hours: Math.round(grandReg * 100) / 100,
        total_overtime_hours: Math.round(grandOT * 100) / 100,
        generated_at: new Date().toISOString(),
      }, { onConflict: "week_start" })
      .select()
      .single();
    if (rErr) throw rErr;

    // 7. Try to send transactional email if it's set up
    let emailStatus = "skipped (email domain not configured)";
    try {
      const { data: signed } = await supabase.storage
        .from("weekly-reports")
        .createSignedUrl(path, 60 * 60 * 24 * 7); // 7-day link

      const link = signed?.signedUrl ?? "";
      const subject = `DNC Weekly Report — ${fmtDate(monday)} to ${fmtDate(sunday)}`;
      const summary = `Regular: ${fmtHours(grandReg)} hrs · Overtime: ${fmtHours(grandOT)} hrs · Total: ${fmtHours(grandReg + grandOT)} hrs`;

      for (const to of ADMIN_EMAILS) {
        const r = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "weekly-timesheet-report",
            recipientEmail: to,
            idempotencyKey: `weekly-report-${monday}-${to}`,
            templateData: {
              weekRange: `${fmtDate(monday)} – ${fmtDate(sunday)}`,
              summary,
              regular: fmtHours(grandReg),
              overtime: fmtHours(grandOT),
              total: fmtHours(grandReg + grandOT),
              downloadUrl: link,
            },
          },
        });
        if (r.error) {
          emailStatus = `email error: ${r.error.message}`;
        } else {
          emailStatus = "sent";
        }
      }
    } catch (e) {
      emailStatus = `email skipped: ${(e as Error).message}`;
    }

    return new Response(JSON.stringify({
      ok: true,
      week_start: monday,
      week_end: sunday,
      report_id: report.id,
      pdf_path: path,
      total_regular_hours: grandReg,
      total_overtime_hours: grandOT,
      email: emailStatus,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
