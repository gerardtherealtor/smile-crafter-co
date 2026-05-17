import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  formatDate, formatHours, formatTime12, weekEnd, weekStart,
} from "@/lib/time";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Download, FileCheck2, Search } from "lucide-react";

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
  const [view, setView] = useState<"open" | "archived">("open");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter((g) => {
      const isInvoiced = !!g.invoice;
      if (view === "open" && isInvoiced) return false;
      if (view === "archived" && !isInvoiced) return false;
      if (!q) return true;
      return (
        g.job.name.toLowerCase().includes(q) ||
        (g.job.address ?? "").toLowerCase().includes(q)
      );
    });
  }, [groups, view, search]);

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
      if (error) { toast.error(error.message); return; }
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

  const exportOne = (g: JobWeekGroup) => {
    const rows = [QBO_HEADERS, groupToRow(g)];
    const fname = `qbo-invoice-${g.job.name.replace(/[^A-Za-z0-9]+/g, "_")}-${g.week_start}.csv`;
    downloadCsv(fname, rows);
    toast.success("CSV downloaded");
  };

  const exportAllOpen = () => {
    const open = groups.filter((g) => !g.invoice && g.entries.length > 0);
    if (open.length === 0) { toast.info("No open job-weeks to export"); return; }
    const rows: (string | number)[][] = [QBO_HEADERS, ...open.map(groupToRow)];
    downloadCsv(`qbo-invoices-open-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success(`Exported ${open.length} invoice${open.length === 1 ? "" : "s"}`);
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

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <Tabs value={view} onValueChange={(v) => setView(v as "open" | "archived")}>
          <TabsList>
            <TabsTrigger value="open" className="font-display tracking-wider">
              Open ({groups.filter((g) => !g.invoice).length})
            </TabsTrigger>
            <TabsTrigger value="archived" className="font-display tracking-wider">
              Archived ({groups.filter((g) => g.invoice).length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportAllOpen}
            className="font-display tracking-wider"
          >
            <Download className="h-4 w-4" />
            Export all open to QuickBooks
          </Button>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search job or address"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            {view === "open" ? "Nothing waiting to be invoiced." : "No archived invoices yet."}
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
    </div>
  );
};
