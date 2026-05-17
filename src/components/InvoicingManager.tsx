import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Download, FileCheck2, Search, X } from "lucide-react";

// Build a QuickBooks Online Invoice Import CSV.
// Headers match QBO's Invoice import format (Settings → Import data → Invoices).
const QBO_HEADERS = [
  "InvoiceNo",
  "Customer",
  "InvoiceDate",
  "DueDate",
  "Terms",
  "Item(Product/Service)",
  "ItemDescription",
  "ItemQuantity",
  "ItemRate",
  "ItemAmount",
  "Memo",
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
  id: string;
  user_id: string;
  job_id: string | null;
  work_date: string;
  clock_in: string;
  clock_out: string;
  hours: number;
  notes: string | null;
}
interface InvoiceRecord {
  id: string;
  job_id: string;
  week_start: string;
  week_end: string;
  invoiced_at: string;
  notes: string | null;
}

interface JobWeekGroup {
  key: string;
  job: Job;
  week_start: string;
  week_end: string;
  entries: TEntry[];
  totalHours: number;
  workerIds: Set<string>;
  invoice?: InvoiceRecord;
}

// Compute the Monday for any given ISO date.
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
  const [entries, setEntries] = useState<TEntry[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"open" | "archived" | "all">("open");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [rangeFilter, setRangeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");

  const load = async () => {
    setLoading(true);
    const [e, inv] = await Promise.all([
      supabase
        .from("time_entries")
        .select("id,user_id,job_id,work_date,clock_in,clock_out,hours,notes")
        .order("work_date", { ascending: false }),
      supabase
        .from("job_invoices")
        .select("id,job_id,week_start,week_end,invoiced_at,notes")
        .order("week_start", { ascending: false }),
    ]);
    if (e.data) setEntries(e.data as TEntry[]);
    if (inv.data) setInvoices(inv.data as InvoiceRecord[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const profileName = (id: string) =>
    profiles.find((p) => p.id === id)?.full_name ||
    profiles.find((p) => p.id === id)?.email ||
    "Unknown";

  // Group time entries by (job_id, week_start)
  const groups = useMemo<JobWeekGroup[]>(() => {
    const map = new Map<string, JobWeekGroup>();

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
          key,
          job,
          week_start: wkStart,
          week_end: wkEnd,
          entries: [],
          totalHours: 0,
          workerIds: new Set(),
        };
        map.set(key, g);
      }
      g.entries.push(e);
      g.totalHours += Number(e.hours);
      g.workerIds.add(e.user_id);
    }

    // Attach invoice records
    for (const inv of invoices) {
      const key = `${inv.job_id}__${inv.week_start}`;
      const g = map.get(key);
      if (g) {
        g.invoice = inv;
      } else {
        // Invoice exists with no current entries — still surface in archived view
        const job = jobs.find((j) => j.id === inv.job_id);
        if (!job) continue;
        map.set(key, {
          key,
          job,
          week_start: inv.week_start,
          week_end: inv.week_end,
          entries: [],
          totalHours: 0,
          workerIds: new Set(),
          invoice: inv,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.week_start !== b.week_start) return b.week_start.localeCompare(a.week_start);
      return a.job.name.localeCompare(b.job.name, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [entries, invoices, jobs]);

  // Date-range presets (compared against week_start).
  const rangeBounds = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfThisWeek = new Date(weekStart(today));
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const minus = (d: Date, days: number) => {
      const n = new Date(d); n.setDate(n.getDate() - days); return n;
    };
    switch (rangeFilter) {
      case "this_week":
        return { from: iso(startOfThisWeek), to: null as string | null };
      case "last_week": {
        const last = minus(startOfThisWeek, 7);
        return { from: iso(last), to: iso(minus(startOfThisWeek, 1)) };
      }
      case "last_4":
        return { from: iso(minus(startOfThisWeek, 21)), to: null };
      case "last_12":
        return { from: iso(minus(startOfThisWeek, 77)), to: null };
      case "this_month": {
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        return { from: iso(first), to: null };
      }
      case "last_month": {
        const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const last = new Date(today.getFullYear(), today.getMonth(), 0);
        return { from: iso(first), to: iso(last) };
      }
      default:
        return { from: null, to: null };
    }
  }, [rangeFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = groups.filter((g) => {
      const isInvoiced = !!g.invoice;
      if (view === "open" && isInvoiced) return false;
      if (view === "archived" && !isInvoiced) return false;
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
        sorted.sort((a, b) => b.totalHours - a.totalHours);
        break;
      case "hours_asc":
        sorted.sort((a, b) => a.totalHours - b.totalHours);
        break;
      case "job_az":
        sorted.sort((a, b) => a.job.name.localeCompare(b.job.name, undefined, { numeric: true, sensitivity: "base" }) ||
          b.week_start.localeCompare(a.week_start));
        break;
      default: // newest
        sorted.sort((a, b) => b.week_start.localeCompare(a.week_start) ||
          a.job.name.localeCompare(b.job.name, undefined, { numeric: true, sensitivity: "base" }));
    }
    return sorted;
  }, [groups, view, search, jobFilter, rangeBounds, sortBy, profiles]);

  const hasActiveFilters = search !== "" || jobFilter !== "all" || rangeFilter !== "all" || sortBy !== "newest";
  const clearFilters = () => {
    setSearch(""); setJobFilter("all"); setRangeFilter("all"); setSortBy("newest");
  };

  // Jobs that actually appear in groups — keeps dropdown short and relevant.
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

  const markInvoiced = async (g: JobWeekGroup, checked: boolean) => {
    if (checked) {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("job_invoices").insert({
        job_id: g.job.id,
        week_start: g.week_start,
        week_end: g.week_end,
        invoiced_by: user.user?.id ?? null,
      });
      if (error) {
        const isDuplicate = error.code === "23505" || /duplicate key/i.test(error.message);
        if (isDuplicate) {
          toast.info(`${g.job.name} is already invoiced for this week`);
        } else {
          toast.error(error.message);
        }
        await load();
        return;
      }
      toast.success(`${g.job.name} marked invoiced`);
    } else {
      if (!g.invoice) return;
      const { error } = await supabase.from("job_invoices").delete().eq("id", g.invoice.id);
      if (error) { toast.error(error.message); return; }
      toast.success(`${g.job.name} restored to open`);
    }
    load();
  };

  // Build a description block summarizing the week's work for this job.
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
      invNo,                                  // InvoiceNo
      g.job.name,                             // Customer (map to QBO customer)
      g.week_end,                             // InvoiceDate (end of week)
      "",                                     // DueDate (fill in QBO)
      "",                                     // Terms
      "Labor",                                // Item
      buildDescription(g),                    // ItemDescription
      g.totalHours.toFixed(2),                // ItemQuantity
      "",                                     // ItemRate (fill in QBO)
      "",                                     // ItemAmount (QBO computes)
      `Week ${formatDate(g.week_start)} – ${formatDate(g.week_end)}${g.job.address ? ` · ${g.job.address}` : ""}`, // Memo
    ];
  };

  // Preview state — opened before download so admin can verify QBO column mapping.
  const [preview, setPreview] = useState<{
    filename: string;
    rows: (string | number)[][];
    label: string;
  } | null>(null);

  const exportOne = (g: JobWeekGroup) => {
    setPreview({
      filename: `qbo-invoice-${g.job.name.replace(/[^A-Za-z0-9]+/g, "_")}-${g.week_start}.csv`,
      rows: [QBO_HEADERS, groupToRow(g)],
      label: `${g.job.name} · week of ${formatDate(g.week_start)}`,
    });
  };

  const exportFiltered = () => {
    const target = filtered.filter((g) => g.entries.length > 0);
    if (target.length === 0) { toast.info("No job-weeks match your current filters"); return; }
    setPreview({
      filename: `qbo-invoices-${new Date().toISOString().slice(0, 10)}.csv`,
      rows: [QBO_HEADERS, ...target.map(groupToRow)],
      label: `${target.length} job-week${target.length === 1 ? "" : "s"} (filtered)`,
    });
  };

  // QBO column requirements — must be present on every data row.
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

  const confirmDownload = () => {
    if (!preview) return;
    downloadCsv(preview.filename, preview.rows);
    const count = preview.rows.length - 1;
    toast.success(`Exported ${count} invoice${count === 1 ? "" : "s"} to CSV`);
    setPreview(null);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4 shadow-deep space-y-2">
        <p className="text-sm text-muted-foreground">
          Every job site with logged hours is grouped by week. Check off the box once you've created the
          invoice in QuickBooks — it'll move to <span className="font-semibold">Archived</span>.
        </p>
        <p className="text-xs text-muted-foreground">
          Use <span className="font-semibold">Export to QuickBooks</span> to download a CSV in QBO's
          Invoice import format. In QuickBooks Online: <span className="italic">Settings → Import data → Invoices</span>,
          upload the file, map the columns, then review & import. Rate/Due Date can be filled in QBO.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
            <TabsList>
              <TabsTrigger value="open" className="font-display tracking-wider">
                Open ({groups.filter((g) => !g.invoice).length})
              </TabsTrigger>
              <TabsTrigger value="archived" className="font-display tracking-wider">
                Archived ({groups.filter((g) => g.invoice).length})
              </TabsTrigger>
              <TabsTrigger value="all" className="font-display tracking-wider">
                All ({groups.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportFiltered}
            className="font-display tracking-wider self-start lg:self-auto"
          >
            <Download className="h-4 w-4" />
            Export filtered to QuickBooks
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px_180px_auto]">
          <div className="relative">
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
              className="font-display tracking-wider"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          ) : <div />}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing <span className="font-semibold text-foreground">{filtered.length}</span> of{" "}
            {groups.filter((g) =>
              view === "open" ? !g.invoice : view === "archived" ? !!g.invoice : true
            ).length} job-week{filtered.length === 1 ? "" : "s"}
          </span>
          {filtered.length > 0 && (
            <span>
              Total: <span className="font-semibold text-foreground">
                {formatHours(filtered.reduce((s, g) => s + g.totalHours, 0))}
              </span> hr
            </span>
          )}
        </div>
      </div>

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
                : view === "archived" ? "No archived invoices yet."
                : "No job-weeks yet."}
            </div>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4" /> Clear filters
              </Button>
            )}
          </div>
        ) : filtered.map((g) => {
          const isOpen = expanded.has(g.key);
          const invoiced = !!g.invoice;
          // Per-employee totals within this group
          const perEmp = new Map<string, number>();
          for (const e of g.entries) {
            perEmp.set(e.user_id, (perEmp.get(e.user_id) ?? 0) + Number(e.hours));
          }
          // Entries by date
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
              className={`rounded-xl border shadow-deep overflow-hidden ${
                invoiced ? "border-border bg-muted/30" : "border-border bg-card"
              }`}
            >
              <div className="flex items-start gap-3 p-4">
                <div className="pt-1">
                  <Checkbox
                    checked={invoiced}
                    onCheckedChange={(c) => markInvoiced(g, !!c)}
                    aria-label="Mark invoiced"
                  />
                </div>
                <button
                  onClick={() => toggleExpand(g.key)}
                  className="flex-1 text-left"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <div className="font-display text-lg uppercase tracking-wide">
                        {g.job.name}
                      </div>
                      {g.job.address && (
                        <div className="text-xs text-muted-foreground">{g.job.address}</div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        Week of {formatDate(g.week_start)} – {formatDate(g.week_end)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Hours
                        </div>
                        <div className="font-display text-2xl">{formatHours(g.totalHours)}</div>
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
                  {invoiced && (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-maple">
                      <FileCheck2 className="h-3.5 w-3.5" />
                      Invoiced {new Date(g.invoice!.invoiced_at).toLocaleDateString()}
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
                        Export to QuickBooks
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
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider">
              CSV Preview — QuickBooks Online
            </DialogTitle>
            <DialogDescription>
              {preview?.label} · {preview ? preview.rows.length - 1 : 0} invoice row(s) ·{" "}
              <span className="font-mono">{preview?.filename}</span>
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <div className="space-y-3">
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

              <ScrollArea className="h-[420px] w-full rounded-lg border border-border">
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

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPreview(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmDownload}
              disabled={!previewValidation.ok}
              className="font-display tracking-wider"
            >
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
