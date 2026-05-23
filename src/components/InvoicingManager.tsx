import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  formatDate, formatHours, formatTime12, weekEnd, weekStart,
} from "@/lib/time";
import {
  AlertTriangle, Archive, ArrowLeft, CheckCircle2, ChevronDown, ChevronRight,
  Download, FileCheck2, History, Loader2, Search, Send, Undo2, X,
} from "lucide-react";

type AuditAction =
  | "open_to_ready"
  | "ready_to_archived"
  | "ready_to_open"
  | "archived_to_ready"
  | "csv_downloaded"
  | "archived_on_download";

const AUDIT_LABELS: Record<AuditAction, string> = {
  open_to_ready: "Sent to Ready for Invoicing",
  ready_to_archived: "Archived",
  ready_to_open: "Moved back to Open",
  archived_to_ready: "Restored to Ready",
  csv_downloaded: "Downloaded CSV",
  archived_on_download: "Archived on download",
};

interface AuditRow {
  id: string;
  action: AuditAction;
  invoice_id: string | null;
  job_id: string | null;
  week_start: string | null;
  week_end: string | null;
  actor_id: string | null;
  actor_email: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

// QuickBooks Online Invoice Import CSV headers.
const QBO_HEADERS = [
  "InvoiceNo", "Customer", "InvoiceDate", "DueDate", "Terms",
  "Item(Product/Service)", "ItemDescription", "ItemQuantity", "ItemRate",
  "ItemAmount", "Memo",
];

const csvEscape = (v: string | number) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const downloadCsv = (filename: string, rows: (string | number)[][]) => {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

interface Job { id: string; name: string; address: string | null; is_active: boolean }
interface Profile { id: string; full_name: string; email: string }
interface TEntry {
  id: string; user_id: string; job_id: string | null; work_date: string;
  clock_in: string; clock_out: string; hours: number; notes: string | null; notes_en: string | null;
}
interface InvoiceRecord {
  id: string; job_id: string; week_start: string; week_end: string;
  invoiced_at: string; notes: string | null; status: "ready" | "archived";
  csv_exported_at: string | null; csv_export_count: number;
}

type Stage = "open" | "ready" | "archived";

interface JobWeekGroup {
  key: string;
  job: Job;
  week_start: string;
  week_end: string;
  entries: TEntry[];
  totalHours: number;
  workerIds: Set<string>;
  invoice?: InvoiceRecord;
  stage: Stage;
}

const mondayFor = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return weekStart(new Date(y, m - 1, d));
};

export const InvoicingManager = ({
  jobs,
  profiles,
}: {
  jobs: Job[];
  profiles: Profile[];
}) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<TEntry[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<Stage>("open");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [rangeFilter, setRangeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const openAuditLog = async () => {
    setAuditOpen(true);
    setAuditLoading(true);
    const { data, error } = await supabase
      .from("invoice_audit_log")
      .select("id,action,invoice_id,job_id,week_start,week_end,actor_id,actor_email,details,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    setAuditLoading(false);
    if (error) { toast.error(error.message); return; }
    setAuditRows((data ?? []) as unknown as AuditRow[]);
  };
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [e, inv] = await Promise.all([
      supabase
        .from("time_entries")
        .select("id,user_id,job_id,work_date,clock_in,clock_out,hours,notes,notes_en")
        .order("work_date", { ascending: false }),
      supabase
        .from("job_invoices")
        .select("id,job_id,week_start,week_end,invoiced_at,notes,status,csv_exported_at,csv_export_count")
        .order("week_start", { ascending: false }),
    ]);
    if (e.data) setEntries(e.data as TEntry[]);
    if (inv.data) setInvoices(inv.data as InvoiceRecord[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // Clear selection when switching tabs to avoid cross-stage confusion.
  useEffect(() => { setSelected(new Set()); }, [view]);

  // Append entries to the admin-only audit log. Best-effort: never block the UX.
  const logAudit = async (
    action: AuditAction,
    groups: { invoiceId?: string | null; jobId: string; weekStart: string; weekEnd: string }[],
    details?: Record<string, unknown>,
  ) => {
    if (groups.length === 0) return;
    const { data: u } = await supabase.auth.getUser();
    const actorId = u.user?.id ?? null;
    const actorEmail = u.user?.email ?? null;
    const rows = groups.map((g) => ({
      action,
      invoice_id: g.invoiceId ?? null,
      job_id: g.jobId,
      week_start: g.weekStart,
      week_end: g.weekEnd,
      actor_id: actorId,
      actor_email: actorEmail,
      details: (details ?? null) as never,
    }));
    const { error } = await supabase.from("invoice_audit_log").insert(rows);
    if (error) console.warn("audit log insert failed", error);
  };

  const profileName = (id: string) =>
    profiles.find((p) => p.id === id)?.full_name ||
    profiles.find((p) => p.id === id)?.email ||
    "Unknown";

  // Group time entries by (job_id, week_start) and attach invoice records.
  const groups = useMemo<JobWeekGroup[]>(() => {
    const map = new Map<string, Omit<JobWeekGroup, "stage">>();

    for (const e of entries) {
      if (!e.job_id) continue;
      const job = jobs.find((j) => j.id === e.job_id);
      if (!job) continue;
      const wkStart = mondayFor(e.work_date);
      const wkEnd = weekEnd(wkStart);
      const key = `${e.job_id}__${wkStart}`;
      let g = map.get(key);
      if (!g) {
        g = {
          key, job, week_start: wkStart, week_end: wkEnd,
          entries: [], totalHours: 0, workerIds: new Set(),
        };
        map.set(key, g);
      }
      g.entries.push(e);
      g.totalHours += Number(e.hours);
      g.workerIds.add(e.user_id);
    }

    for (const inv of invoices) {
      const key = `${inv.job_id}__${inv.week_start}`;
      const g = map.get(key);
      if (g) {
        g.invoice = inv;
      } else {
        const job = jobs.find((j) => j.id === inv.job_id);
        if (!job) continue;
        map.set(key, {
          key, job, week_start: inv.week_start, week_end: inv.week_end,
          entries: [], totalHours: 0, workerIds: new Set(), invoice: inv,
        });
      }
    }

    const withStage: JobWeekGroup[] = Array.from(map.values()).map((g) => ({
      ...g,
      stage: !g.invoice ? "open" : g.invoice.status,
    }));

    return withStage.sort((a, b) => {
      if (a.week_start !== b.week_start) return b.week_start.localeCompare(a.week_start);
      return a.job.name.localeCompare(b.job.name, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [entries, invoices, jobs]);

  const stageCounts = useMemo(() => ({
    open: groups.filter((g) => g.stage === "open").length,
    ready: groups.filter((g) => g.stage === "ready").length,
    archived: groups.filter((g) => g.stage === "archived").length,
  }), [groups]);

  const rangeBounds = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfThisWeek = new Date(weekStart(today));
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const minus = (d: Date, days: number) => {
      const n = new Date(d); n.setDate(n.getDate() - days); return n;
    };
    switch (rangeFilter) {
      case "this_week": return { from: iso(startOfThisWeek), to: null as string | null };
      case "last_week": {
        const last = minus(startOfThisWeek, 7);
        return { from: iso(last), to: iso(minus(startOfThisWeek, 1)) };
      }
      case "last_4": return { from: iso(minus(startOfThisWeek, 21)), to: null };
      case "last_12": return { from: iso(minus(startOfThisWeek, 77)), to: null };
      case "this_month": {
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        return { from: iso(first), to: null };
      }
      case "last_month": {
        const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const last = new Date(today.getFullYear(), today.getMonth(), 0);
        return { from: iso(first), to: iso(last) };
      }
      default: return { from: null, to: null };
    }
  }, [rangeFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = groups.filter((g) => {
      if (g.stage !== view) return false;
      if (jobFilter !== "all" && g.job.id !== jobFilter) return false;
      if (rangeBounds.from && g.week_start < rangeBounds.from) return false;
      if (rangeBounds.to && g.week_start > rangeBounds.to) return false;
      if (q) {
        const hay =
          `${g.job.name} ${g.job.address ?? ""}`.toLowerCase() + " " +
          Array.from(g.workerIds).map((id) => profileName(id)).join(" ").toLowerCase() + " " +
          g.entries.map((e) => e.notes ?? "").join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...result];
    switch (sortBy) {
      case "oldest":
        sorted.sort((a, b) => a.week_start.localeCompare(b.week_start) ||
          a.job.name.localeCompare(b.job.name, undefined, { numeric: true, sensitivity: "base" }));
        break;
      case "hours_desc":
        sorted.sort((a, b) => b.totalHours - a.totalHours); break;
      case "hours_asc":
        sorted.sort((a, b) => a.totalHours - b.totalHours); break;
      case "job_az":
        sorted.sort((a, b) => a.job.name.localeCompare(b.job.name, undefined, { numeric: true, sensitivity: "base" }) ||
          b.week_start.localeCompare(a.week_start));
        break;
      default:
        sorted.sort((a, b) => b.week_start.localeCompare(a.week_start) ||
          a.job.name.localeCompare(b.job.name, undefined, { numeric: true, sensitivity: "base" }));
    }
    return sorted;
  }, [groups, view, search, jobFilter, rangeBounds, sortBy, profiles]);

  const hasActiveFilters = search !== "" || jobFilter !== "all" || rangeFilter !== "all" || sortBy !== "newest";
  const clearFilters = () => {
    setSearch(""); setJobFilter("all"); setRangeFilter("all"); setSortBy("newest");
  };

  const jobsInGroups = useMemo(() => {
    const ids = new Set(groups.map((g) => g.job.id));
    return jobs
      .filter((j) => ids.has(j.id))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  }, [groups, jobs]);

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const allVisibleSelected = filtered.length > 0 && filtered.every((g) => selected.has(g.key));
  const someVisibleSelected = filtered.some((g) => selected.has(g.key));
  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const g of filtered) next.delete(g.key);
      } else {
        for (const g of filtered) next.add(g.key);
      }
      return next;
    });
  };

  const selectedGroups = useMemo(
    () => filtered.filter((g) => selected.has(g.key)),
    [filtered, selected],
  );

  // ---- Stage transitions ----

  // Open → Ready: create invoice rows with status='ready'.
  const sendSelectedToReady = async () => {
    const target = selectedGroups.filter((g) => g.stage === "open" && g.entries.length > 0);
    if (target.length === 0) {
      toast.info("Select at least one open job-week with logged hours");
      return;
    }
    setBusy(true);
    const { data: user } = await supabase.auth.getUser();
    const rows = target.map((g) => ({
      job_id: g.job.id,
      week_start: g.week_start,
      week_end: g.week_end,
      invoiced_by: user.user?.id ?? null,
      status: "ready" as const,
    }));
    const { data: inserted, error } = await supabase
      .from("job_invoices")
      .insert(rows)
      .select("id,job_id,week_start,week_end");
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await logAudit(
      "open_to_ready",
      (inserted ?? []).map((r) => ({
        invoiceId: r.id, jobId: r.job_id, weekStart: r.week_start, weekEnd: r.week_end,
      })),
    );
    toast.success(`Sent ${target.length} job-week${target.length === 1 ? "" : "s"} to Ready for Invoicing`);
    setSelected(new Set());
    load();
  };

  // Ready → Archived
  const archiveSelected = async () => {
    const target = selectedGroups.filter((g) => g.stage === "ready" && g.invoice);
    if (target.length === 0) { toast.info("Select at least one ready job-week"); return; }
    setBusy(true);
    const ids = target.map((g) => g.invoice!.id);
    const { error } = await supabase
      .from("job_invoices")
      .update({ status: "archived", invoiced_at: new Date().toISOString() })
      .in("id", ids);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await logAudit(
      "ready_to_archived",
      target.map((g) => ({
        invoiceId: g.invoice!.id, jobId: g.job.id, weekStart: g.week_start, weekEnd: g.week_end,
      })),
    );
    toast.success(`Archived ${target.length} job-week${target.length === 1 ? "" : "s"}`);
    setSelected(new Set());
    load();
  };

  // Ready → Open (undo)
  const sendReadyBackToOpen = async () => {
    const target = selectedGroups.filter((g) => g.stage === "ready" && g.invoice);
    if (target.length === 0) { toast.info("Select at least one ready job-week"); return; }
    setBusy(true);
    const ids = target.map((g) => g.invoice!.id);
    const { error } = await supabase.from("job_invoices").delete().in("id", ids);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await logAudit(
      "ready_to_open",
      target.map((g) => ({
        invoiceId: g.invoice!.id, jobId: g.job.id, weekStart: g.week_start, weekEnd: g.week_end,
      })),
    );
    toast.success(`Moved ${target.length} back to Open`);
    setSelected(new Set());
    load();
  };

  // Archived → Ready (restore)
  const restoreArchivedToReady = async () => {
    const target = selectedGroups.filter((g) => g.stage === "archived" && g.invoice);
    if (target.length === 0) { toast.info("Select at least one archived job-week"); return; }
    setBusy(true);
    const ids = target.map((g) => g.invoice!.id);
    const { error } = await supabase
      .from("job_invoices")
      .update({ status: "ready" })
      .in("id", ids);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await logAudit(
      "archived_to_ready",
      target.map((g) => ({
        invoiceId: g.invoice!.id, jobId: g.job.id, weekStart: g.week_start, weekEnd: g.week_end,
      })),
    );
    toast.success(`Restored ${target.length} to Ready for Invoicing`);
    setSelected(new Set());
    load();
  };

  // ---- CSV building ----

  const buildDescription = (g: JobWeekGroup) => {
    if (g.entries.length === 0) return `${g.job.name} — week of ${formatDate(g.week_start)}`;
    const byDate = new Map<string, TEntry[]>();
    for (const e of g.entries) {
      const arr = byDate.get(e.work_date) ?? [];
      arr.push(e);
      byDate.set(e.work_date, arr);
    }
    const lines: string[] = [];
    const sortedDates = Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b));
    for (const [date, items] of sortedDates) {
      const taskNotes = Array.from(new Set(items.map((i) => i.notes?.trim()).filter(Boolean))) as string[];
      const crew = Array.from(new Set(items.map((i) => profileName(i.user_id)))).join(", ");
      const dayHours = items.reduce((s, i) => s + Number(i.hours), 0);
      const task = taskNotes.length ? ` — ${taskNotes.join("; ")}` : "";
      lines.push(`${formatDate(date)}: ${formatHours(dayHours)} hr (${crew})${task}`);
    }
    return lines.join("\n");
  };

  const groupToRow = (g: JobWeekGroup): (string | number)[] => {
    const invNo = `${g.job.name.replace(/[^A-Za-z0-9]+/g, "").slice(0, 10)}-${g.week_start.replace(/-/g, "").slice(2)}`;
    return [
      invNo, g.job.name, g.week_end, "", "",
      "Labor", buildDescription(g), g.totalHours.toFixed(2), "", "",
      `Week ${formatDate(g.week_start)} – ${formatDate(g.week_end)}${g.job.address ? ` · ${g.job.address}` : ""}`,
    ];
  };

  // Preview state — opened before download so admin can verify QBO column mapping.
  // `exportedInvoiceIds` are the job_invoices.id values to bump csv_export_count on.
  // `duplicates` lists any selected job-weeks that have already been exported before.
  const [preview, setPreview] = useState<{
    filename: string;
    rows: (string | number)[][];
    label: string;
    archiveAfter: { invoiceIds: string[]; groupCount: number } | null;
    exportedInvoiceIds: string[];
    duplicates: { label: string; lastAt: string; count: number }[];
    totals: { invoices: number; lines: number; hours: number; jobs: number; weeks: number };
    batchName: string;
  } | null>(null);

  // Editable batch name + filename — user can rename before download.
  const [batchName, setBatchName] = useState("");
  const [filename, setFilename] = useState("");
  useEffect(() => {
    if (preview) {
      setBatchName(preview.batchName);
      setFilename(preview.filename);
    }
  }, [preview]);

  const slugify = (s: string) =>
    s.trim().replace(/[^A-Za-z0-9._-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "qbo-invoices";

  // Keep filename in sync with batch name unless the user has manually edited it.
  const onBatchNameChange = (v: string) => {
    setBatchName(v);
    setFilename(`${slugify(v)}.csv`);
  };

  const dupeInfo = (g: JobWeekGroup) =>
    g.invoice && g.invoice.csv_export_count > 0
      ? {
          label: `${g.job.name} · week of ${formatDate(g.week_start)}`,
          lastAt: g.invoice.csv_exported_at ?? g.invoice.invoiced_at,
          count: g.invoice.csv_export_count,
        }
      : null;

  const computeTotals = (gs: JobWeekGroup[]) => ({
    invoices: gs.length,
    lines: gs.reduce((s, g) => s + g.entries.length, 0),
    hours: gs.reduce((s, g) => s + g.totalHours, 0),
    jobs: new Set(gs.map((g) => g.job.id)).size,
    weeks: new Set(gs.map((g) => g.week_start)).size,
  });

  // Create CSV from selected READY job-weeks (with option to archive on download).
  const exportSelectedReady = () => {
    const target = selectedGroups.filter((g) => g.stage === "ready" && g.entries.length > 0);
    if (target.length === 0) {
      toast.info("Select at least one ready job-week with logged hours");
      return;
    }
    const duplicates = target.map(dupeInfo).filter(Boolean) as {
      label: string; lastAt: string; count: number;
    }[];
    const today = new Date().toISOString().slice(0, 10);
    const batch = `QBO Invoice Batch — ${today} — ${target.length} invoice${target.length === 1 ? "" : "s"}`;
    setPreview({
      filename: `${slugify(batch)}.csv`,
      rows: [QBO_HEADERS, ...target.map(groupToRow)],
      label: `${target.length} ready job-week${target.length === 1 ? "" : "s"}`,
      archiveAfter: {
        invoiceIds: target.map((g) => g.invoice!.id),
        groupCount: target.length,
      },
      exportedInvoiceIds: target.map((g) => g.invoice!.id),
      duplicates,
      totals: computeTotals(target),
      batchName: batch,
    });
  };

  // Single-row export from expanded card (works in any tab).
  const exportOne = (g: JobWeekGroup) => {
    const dup = dupeInfo(g);
    const batch = `QBO Invoice — ${g.job.name} — week of ${formatDate(g.week_start)}`;
    setPreview({
      filename: `${slugify(batch)}.csv`,
      rows: [QBO_HEADERS, groupToRow(g)],
      label: `${g.job.name} · week of ${formatDate(g.week_start)}`,
      archiveAfter: g.stage === "ready" && g.invoice
        ? { invoiceIds: [g.invoice.id], groupCount: 1 }
        : null,
      exportedInvoiceIds: g.invoice ? [g.invoice.id] : [],
      duplicates: dup ? [dup] : [],
      totals: computeTotals([g]),
      batchName: batch,
    });
  };

  const REQUIRED_COLS = ["InvoiceNo", "Customer", "InvoiceDate", "Item(Product/Service)", "ItemQuantity"];
  const previewValidation = useMemo(() => {
    if (!preview) return { issues: [] as string[], ok: true };
    const issues: string[] = [];
    const header = preview.rows[0] as string[];
    for (let i = 0; i < QBO_HEADERS.length; i++) {
      if (header[i] !== QBO_HEADERS[i]) {
        issues.push(`Header column ${i + 1} should be "${QBO_HEADERS[i]}" but is "${header[i] ?? "(missing)"}"`);
      }
    }
    const qIdx = header.indexOf("ItemQuantity");
    const dIdx = header.indexOf("InvoiceDate");
    const requiredIdx = REQUIRED_COLS.map((c) => header.indexOf(c));
    for (let r = 1; r < preview.rows.length; r++) {
      const row = preview.rows[r];
      REQUIRED_COLS.forEach((col, i) => {
        const idx = requiredIdx[i];
        if (idx < 0) return;
        if (!String(row[idx] ?? "").trim()) issues.push(`Row ${r}: missing required "${col}"`);
      });
      if (qIdx >= 0) {
        const q = Number(row[qIdx]);
        if (!Number.isFinite(q) || q <= 0) {
          issues.push(`Row ${r}: ItemQuantity "${row[qIdx]}" is not a positive number`);
        }
      }
      if (dIdx >= 0) {
        const d = String(row[dIdx] ?? "");
        if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
          issues.push(`Row ${r}: InvoiceDate "${d}" is not YYYY-MM-DD`);
        }
      }
    }
    return { issues, ok: issues.length === 0 };
  }, [preview]);

  const [archiveOnDownload, setArchiveOnDownload] = useState(true);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  useEffect(() => { setArchiveOnDownload(true); setConfirmDuplicate(false); }, [preview]);

  const hasDuplicates = (preview?.duplicates.length ?? 0) > 0;
  const downloadBlocked = hasDuplicates && !confirmDuplicate;

  const confirmDownload = async () => {
    if (!preview) return;
    if (downloadBlocked) {
      toast.error("Confirm the duplicate-billing warning before downloading");
      return;
    }
    const finalName = filename.trim().endsWith(".csv") ? filename.trim() : `${slugify(filename || batchName)}.csv`;
    downloadCsv(finalName, preview.rows);
    const count = preview.rows.length - 1;
    const nowIso = new Date().toISOString();

    // Bump export count + timestamp on every invoice row included in this CSV.
    if (preview.exportedInvoiceIds.length > 0) {
      await Promise.all(
        preview.exportedInvoiceIds.map(async (id) => {
          const inv = invoices.find((i) => i.id === id);
          await supabase
            .from("job_invoices")
            .update({
              csv_exported_at: nowIso,
              csv_export_count: (inv?.csv_export_count ?? 0) + 1,
            })
            .eq("id", id);
        }),
      );
    }

    // Log CSV download for every invoice row in the export.
    const exportedGroups = preview.exportedInvoiceIds
      .map((id) => invoices.find((i) => i.id === id))
      .filter(Boolean)
      .map((inv) => ({
        invoiceId: inv!.id,
        jobId: inv!.job_id,
        weekStart: inv!.week_start,
        weekEnd: inv!.week_end,
      }));
    await logAudit("csv_downloaded", exportedGroups, {
      filename: finalName,
      batch_name: batchName,
      row_count: count,
    });

    if (preview.archiveAfter && archiveOnDownload) {
      const { error } = await supabase
        .from("job_invoices")
        .update({ status: "archived", invoiced_at: nowIso })
        .in("id", preview.archiveAfter.invoiceIds);
      if (error) {
        toast.error(`CSV downloaded, but archiving failed: ${error.message}`);
      } else {
        await logAudit(
          "archived_on_download",
          preview.archiveAfter.invoiceIds
            .map((id) => invoices.find((i) => i.id === id))
            .filter(Boolean)
            .map((inv) => ({
              invoiceId: inv!.id, jobId: inv!.job_id,
              weekStart: inv!.week_start, weekEnd: inv!.week_end,
            })),
          { filename: finalName },
        );
        toast.success(`Exported ${count} invoice${count === 1 ? "" : "s"} and archived ${preview.archiveAfter.groupCount}`);
        setSelected(new Set());
      }
    } else {
      toast.success(`Exported ${count} invoice${count === 1 ? "" : "s"} to CSV`);
    }
    load();
    setPreview(null);
  };

  // ---- Per-tab bulk action bar ----

  const BulkBar = () => {
    if (selected.size === 0) return null;
    return (
      <div className="sticky top-2 z-10 rounded-xl border border-primary/40 bg-card/95 backdrop-blur p-3 shadow-deep flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span>
            <span className="font-semibold">{selected.size}</span> selected
          </span>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline ml-1"
          >
            clear
          </button>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {view === "open" && (
            <Button size="sm" onClick={sendSelectedToReady} disabled={busy} className="font-display tracking-wider">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send to Ready for Invoicing
            </Button>
          )}
          {view === "ready" && (
            <>
              <Button size="sm" onClick={exportSelectedReady} disabled={busy} className="font-display tracking-wider">
                <Download className="h-4 w-4" /> Create CSV from selected
              </Button>
              <Button size="sm" variant="outline" onClick={archiveSelected} disabled={busy} className="font-display tracking-wider">
                <Archive className="h-4 w-4" /> Archive selected
              </Button>
              <Button size="sm" variant="ghost" onClick={sendReadyBackToOpen} disabled={busy} className="font-display tracking-wider">
                <ArrowLeft className="h-4 w-4" /> Back to Open
              </Button>
            </>
          )}
          {view === "archived" && (
            <Button size="sm" variant="outline" onClick={restoreArchivedToReady} disabled={busy} className="font-display tracking-wider">
              <Undo2 className="h-4 w-4" /> Restore to Ready
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4 shadow-deep space-y-2">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-muted-foreground">{t("invoicing.intro")}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={openAuditLog}
            className="font-display tracking-wider shrink-0"
          >
            <History className="h-4 w-4" />
            {t("invoicing.auditLog")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("invoicing.helper")}</p>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as Stage)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="open" className="font-display tracking-wider text-xs sm:text-sm">
            {t("invoicing.open")} ({stageCounts.open})
          </TabsTrigger>
          <TabsTrigger value="ready" className="font-display tracking-wider text-xs sm:text-sm">
            {t("invoicing.ready")} ({stageCounts.ready})
          </TabsTrigger>
          <TabsTrigger value="archived" className="font-display tracking-wider text-xs sm:text-sm">
            {t("invoicing.archived")} ({stageCounts.archived})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-3">
        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px_180px_auto]">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search job, address, worker, or note"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-muted"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          <Select value={jobFilter} onValueChange={setJobFilter}>
            <SelectTrigger><SelectValue placeholder="Job" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All jobs</SelectItem>
              {jobsInGroups.map((j) => (
                <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={rangeFilter} onValueChange={setRangeFilter}>
            <SelectTrigger><SelectValue placeholder="Date range" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="this_week">This week</SelectItem>
              <SelectItem value="last_week">Last week</SelectItem>
              <SelectItem value="last_4">Last 4 weeks</SelectItem>
              <SelectItem value="last_12">Last 12 weeks</SelectItem>
              <SelectItem value="this_month">This month</SelectItem>
              <SelectItem value="last_month">Last month</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest week first</SelectItem>
              <SelectItem value="oldest">Oldest week first</SelectItem>
              <SelectItem value="hours_desc">Most hours</SelectItem>
              <SelectItem value="hours_asc">Fewest hours</SelectItem>
              <SelectItem value="job_az">Job name A→Z</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="font-display tracking-wider sm:col-span-2 lg:col-span-1 justify-center"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          ) : <div className="hidden lg:block" />}
        </div>

        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {filtered.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAll}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-muted"
              >
                <Checkbox
                  checked={allVisibleSelected ? true : (someVisibleSelected ? "indeterminate" : false)}
                  className="pointer-events-none"
                />
                <span>{allVisibleSelected ? "Unselect all" : "Select all visible"}</span>
              </button>
            )}
            <span>
              Showing <span className="font-semibold text-foreground">{filtered.length}</span> of{" "}
              {stageCounts[view]} job-week{filtered.length === 1 ? "" : "s"}
            </span>
          </div>
          {filtered.length > 0 && (
            <span>
              Total: <span className="font-semibold text-foreground">
                {formatHours(filtered.reduce((s, g) => s + g.totalHours, 0))}
              </span> hr
            </span>
          )}
        </div>
      </div>

      <BulkBar />

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground space-y-3">
            <div>
              {hasActiveFilters
                ? "No job-weeks match these filters."
                : view === "open" ? "Nothing waiting to be invoiced."
                : view === "ready" ? "Nothing queued for invoicing yet. Send open job-weeks here when you're ready to bill."
                : "No archived invoices yet."}
            </div>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4" /> Clear filters
              </Button>
            )}
          </div>
        ) : filtered.map((g) => {
          const isOpen = expanded.has(g.key);
          const isSelected = selected.has(g.key);
          const perEmp = new Map<string, number>();
          for (const e of g.entries) {
            perEmp.set(e.user_id, (perEmp.get(e.user_id) ?? 0) + Number(e.hours));
          }
          const byDate = new Map<string, TEntry[]>();
          for (const e of g.entries) {
            const arr = byDate.get(e.work_date) ?? [];
            arr.push(e);
            byDate.set(e.work_date, arr);
          }
          const dates = Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b));

          return (
            <div
              key={g.key}
              className={`rounded-xl border shadow-deep overflow-hidden transition-colors ${
                isSelected ? "border-primary/60 bg-primary/5"
                : g.stage === "archived" ? "border-border bg-muted/30"
                : g.stage === "ready" ? "border-border bg-card"
                : "border-border bg-card"
              }`}
            >
              <div className="flex items-start gap-3 p-3 sm:p-4">
                <div className="pt-1">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(g.key)}
                    aria-label="Select"
                  />
                </div>
                <button
                  onClick={() => toggleExpand(g.key)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-base sm:text-lg uppercase tracking-wide break-words">
                        {g.job.name}
                      </div>
                      {g.job.address && (
                        <div className="text-xs text-muted-foreground break-words">{g.job.address}</div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        Week of {formatDate(g.week_start)} – {formatDate(g.week_end)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 text-right shrink-0">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Hours
                        </div>
                        <div className="font-display text-xl sm:text-2xl">{formatHours(g.totalHours)}</div>
                      </div>
                      <div className="hidden sm:block">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Crew
                        </div>
                        <div className="font-display text-2xl">{g.workerIds.size}</div>
                      </div>
                      {isOpen ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  {g.stage === "ready" && (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                      <Send className="h-3.5 w-3.5" />
                      Ready for invoicing
                    </div>
                  )}
                  {g.stage === "archived" && (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-maple">
                      <FileCheck2 className="h-3.5 w-3.5" />
                      Archived {new Date(g.invoice!.invoiced_at).toLocaleDateString()}
                    </div>
                  )}
                  {g.invoice && g.invoice.csv_export_count > 0 && (
                    <div className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-destructive ml-0 sm:ml-3">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      CSV already exported {g.invoice.csv_export_count}×
                      {g.invoice.csv_exported_at && ` · last ${new Date(g.invoice.csv_exported_at).toLocaleDateString()}`}
                    </div>
                  )}
                </button>
              </div>

              {isOpen && (
                <div className="border-t border-border bg-background/40 p-4 space-y-4">
                  {g.entries.length > 0 && (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => exportOne(g)}
                        className="font-display tracking-wider"
                      >
                        <Download className="h-4 w-4" />
                        Export this one to QuickBooks
                      </Button>
                    </div>
                  )}
                  {perEmp.size > 0 && (
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">
                        Crew totals
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Array.from(perEmp.entries()).map(([uid, hrs]) => (
                          <div
                            key={uid}
                            className="rounded-full border border-border bg-card px-3 py-1 text-xs"
                          >
                            <span className="font-medium">{profileName(uid)}</span>
                            <span className="text-muted-foreground ml-1.5">{formatHours(hrs)} hr</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {dates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No time entries for this job/week (invoice record only).
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {dates.map(([date, items]) => (
                        <div key={date} className="rounded-lg border border-border bg-card/60 p-3">
                          <div className="font-display tracking-wide text-sm mb-1.5">
                            {formatDate(date)}
                          </div>
                          <div className="space-y-1.5">
                            {items.map((it) => (
                              <div
                                key={it.id}
                                className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                              >
                                <div>
                                  <span className="font-medium">{profileName(it.user_id)}</span>
                                  <span className="text-muted-foreground ml-2">
                                    {formatTime12(it.clock_in)} – {formatTime12(it.clock_out)}
                                  </span>
                                  {it.notes && (
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      “{it.notes}”
                                    </div>
                                  )}
                                </div>
                                <div className="font-display">{formatHours(Number(it.hours))} hr</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-5xl w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider text-base sm:text-lg">
              CSV Preview — QuickBooks Online
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm break-words">
              {preview?.label}
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Invoices</div>
                  <div className="font-display text-2xl">{preview.totals.invoices}</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Line items</div>
                  <div className="font-display text-2xl">{preview.totals.lines}</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Total hours</div>
                  <div className="font-display text-2xl">{formatHours(preview.totals.hours)}</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Jobs · Weeks</div>
                  <div className="font-display text-2xl">
                    {preview.totals.jobs}<span className="text-muted-foreground text-base"> · </span>{preview.totals.weeks}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                <label className="block">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                    Batch name
                  </div>
                  <Input
                    value={batchName}
                    onChange={(e) => onBatchNameChange(e.target.value)}
                    placeholder="QBO Invoice Batch — 2026-05-18"
                    className="font-display tracking-wide"
                  />
                </label>
                <div className="text-[11px] text-muted-foreground">
                  Saved as <span className="font-mono break-all text-foreground">{filename || "qbo-invoices.csv"}</span>
                </div>
              </div>
              <div
                className={`rounded-lg border p-3 text-sm flex items-start gap-2 ${
                  previewValidation.ok
                    ? "border-maple/40 bg-maple/10 text-maple"
                    : "border-destructive/40 bg-destructive/10 text-destructive"
                }`}
              >
                {previewValidation.ok ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                )}
                <div className="flex-1">
                  {previewValidation.ok ? (
                    <span>All {QBO_HEADERS.length} columns match the QBO Invoice import format.</span>
                  ) : (
                    <div>
                      <div className="font-semibold mb-1">
                        {previewValidation.issues.length} issue{previewValidation.issues.length === 1 ? "" : "s"} found:
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-xs">
                        {previewValidation.issues.slice(0, 10).map((i, idx) => (
                          <li key={idx}>{i}</li>
                        ))}
                        {previewValidation.issues.length > 10 && (
                          <li>…and {previewValidation.issues.length - 10} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {hasDuplicates && (
                <div className="rounded-lg border-2 border-destructive bg-destructive/10 p-3 text-sm space-y-2">
                  <div className="flex items-start gap-2 text-destructive font-semibold">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      Duplicate billing warning — {preview!.duplicates.length} job-week
                      {preview!.duplicates.length === 1 ? " has" : "s have"} already had a CSV exported:
                    </span>
                  </div>
                  <ul className="list-disc list-inside text-xs text-destructive/90 space-y-0.5 pl-1">
                    {preview!.duplicates.slice(0, 6).map((d, i) => (
                      <li key={i}>
                        <span className="font-medium">{d.label}</span> — exported {d.count}× ·
                        last {new Date(d.lastAt).toLocaleString()}
                      </li>
                    ))}
                    {preview!.duplicates.length > 6 && (
                      <li>…and {preview!.duplicates.length - 6} more</li>
                    )}
                  </ul>
                  <label className="flex items-start gap-2 pt-1 cursor-pointer text-destructive">
                    <Checkbox
                      checked={confirmDuplicate}
                      onCheckedChange={(c) => setConfirmDuplicate(!!c)}
                      className="mt-0.5 border-destructive data-[state=checked]:bg-destructive"
                    />
                    <span className="text-xs font-medium">
                      I understand this will re-bill the customer. Export anyway.
                    </span>
                  </label>
                </div>
              )}

              {preview.archiveAfter && (
                <label className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm cursor-pointer">
                  <Checkbox
                    checked={archiveOnDownload}
                    onCheckedChange={(c) => setArchiveOnDownload(!!c)}
                  />
                  <span>
                    Move {preview.archiveAfter.groupCount} job-week{preview.archiveAfter.groupCount === 1 ? "" : "s"} to{" "}
                    <span className="font-semibold">Archived</span> after download
                  </span>
                </label>
              )}

              <ScrollArea className="h-[50vh] sm:h-[420px] w-full rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left font-display tracking-wider w-10">#</th>
                      {(preview.rows[0] as string[]).map((h, i) => (
                        <th
                          key={i}
                          className={`px-2 py-2 text-left font-display tracking-wider whitespace-nowrap ${
                            h === QBO_HEADERS[i] ? "" : "text-destructive"
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(1).map((row, r) => (
                      <tr key={r} className="border-t border-border align-top">
                        <td className="px-2 py-2 text-muted-foreground">{r + 1}</td>
                        {row.map((cell, c) => (
                          <td key={c} className="px-2 py-2 max-w-[260px]">
                            <div className="whitespace-pre-wrap break-words">
                              {String(cell ?? "")}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          )}

          <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
            <Button variant="outline" onClick={() => setPreview(null)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={confirmDownload}
              disabled={!previewValidation.ok || downloadBlocked}
              variant={hasDuplicates ? "destructive" : "default"}
              className="font-display tracking-wider w-full sm:w-auto"
            >
              <Download className="h-4 w-4" />
              {hasDuplicates ? "Re-export CSV" : "Download CSV"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider flex items-center gap-2">
              <History className="h-5 w-5" /> Invoice audit log
            </DialogTitle>
            <DialogDescription>
              Last 500 actions — who moved invoices between stages and when CSVs were downloaded. Admin-only.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-3">
            {auditLoading ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
              </div>
            ) : auditRows.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No audit entries yet.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {auditRows.map((row) => {
                  const job = jobs.find((j) => j.id === row.job_id);
                  const filename =
                    row.details && typeof (row.details as { filename?: unknown }).filename === "string"
                      ? (row.details as { filename: string }).filename
                      : null;
                  return (
                    <li key={row.id} className="py-3 text-sm flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{AUDIT_LABELS[row.action] ?? row.action}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(row.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.actor_email ?? row.actor_id ?? "Unknown user"}
                        {job ? ` · ${job.name}` : row.job_id ? ` · job ${row.job_id.slice(0, 8)}` : ""}
                        {row.week_start ? ` · week of ${formatDate(row.week_start)}` : ""}
                        {filename ? ` · ${filename}` : ""}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAuditOpen(false)} className="w-full sm:w-auto">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
