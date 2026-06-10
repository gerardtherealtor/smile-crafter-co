// Admin-only: build a CSV of the requested week's time entries, upload to the
// weekly-reports bucket, and email the signed download link to the caller.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const csvEscape = (v: unknown) => {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const fmtTime = (t: string | null) => {
  if (!t) return "";
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${mm} ${ampm}`;
};

const fmtDateShort = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub as string;
    const callerEmail = (claimsData.claims.email as string) || "";

    let body: { week_start?: string; week_end?: string } = {};
    try { body = await req.json(); } catch { /* ignore */ }
    const weekStart = body.week_start?.trim();
    const weekEnd = body.week_end?.trim();
    if (!weekStart || !weekEnd || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !/^\d{4}-\d{2}-\d{2}$/.test(weekEnd)) {
      return new Response(JSON.stringify({ error: "Invalid week range" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: callerId, _role: "admin",
    });
    if (roleErr || !isAdmin) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!callerEmail) {
      return new Response(JSON.stringify({ error: "No email on caller account" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull entries + profiles + jobs.
    const [entriesRes, profilesRes, jobsRes] = await Promise.all([
      admin.from("time_entries")
        .select("user_id,work_date,clock_in,clock_out,break_minutes,hours,job_id,notes,notes_en,work_category,work_category_other,work_quantity")
        .gte("work_date", weekStart).lte("work_date", weekEnd)
        .order("work_date", { ascending: true }),
      admin.from("profiles").select("id,full_name,email"),
      admin.from("jobs").select("id,name"),
    ]);

    if (entriesRes.error) throw entriesRes.error;
    const entries = entriesRes.data ?? [];
    const profileMap = new Map<string, { name: string; email: string }>();
    for (const p of profilesRes.data ?? []) {
      profileMap.set(p.id, { name: p.full_name || p.email, email: p.email });
    }
    const jobMap = new Map<string, string>();
    for (const j of jobsRes.data ?? []) jobMap.set(j.id, j.name);

    const header = [
      "Employee", "Email", "Date", "Clock In", "Clock Out", "Break (min)",
      "Job", "Category", "Quantity", "Notes", "Hours",
    ];
    const lines = [header.map(csvEscape).join(",")];
    let totalHours = 0;
    const crew = new Set<string>();
    for (const e of entries) {
      const p = profileMap.get(e.user_id) || { name: e.user_id, email: "" };
      crew.add(e.user_id);
      totalHours += Number(e.hours) || 0;
      const cat = e.work_category === "Other" ? (e.work_category_other || "Other") : (e.work_category || "");
      const notes = e.notes_en || e.notes || "";
      lines.push([
        p.name, p.email, e.work_date, fmtTime(e.clock_in), fmtTime(e.clock_out),
        e.break_minutes ?? 0, jobMap.get(e.job_id || "") || "", cat,
        e.work_quantity ?? "", notes, Number(e.hours || 0).toFixed(2),
      ].map(csvEscape).join(","));
    }

    const csv = lines.join("\n");
    const path = `weekly-csv/${weekStart}_${weekEnd}_${callerId}.csv`;
    const { error: upErr } = await admin.storage.from("weekly-reports").upload(
      path, new Blob([csv], { type: "text/csv" }),
      { upsert: true, contentType: "text/csv" },
    );
    if (upErr) throw upErr;

    const { data: signed, error: sErr } = await admin.storage
      .from("weekly-reports")
      .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days
    if (sErr) throw sErr;

    const { error: emailErr } = await admin.functions.invoke("send-transactional-email", {
      body: {
        templateName: "admin-weekly-csv",
        recipientEmail: callerEmail,
        idempotencyKey: `weekly-csv-${callerId}-${weekStart}-${Date.now()}`,
        templateData: {
          weekStart: fmtDateShort(weekStart),
          weekEnd: fmtDateShort(weekEnd),
          rowCount: entries.length,
          crewCount: crew.size,
          totalHours: totalHours.toFixed(2),
          csvUrl: signed?.signedUrl,
        },
      },
    });
    if (emailErr) throw emailErr;

    return new Response(JSON.stringify({ success: true, recipient: callerEmail, rowCount: entries.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[email-weekly-csv] failed:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
