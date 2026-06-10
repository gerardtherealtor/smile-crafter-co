import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { PortalLayout } from "@/components/PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  formatDate, formatHours, formatTime12, splitOvertime, weekEnd, weekStart,
} from "@/lib/time";
import { Briefcase, ChevronLeft, ChevronRight, ClipboardList, FileDown, Mail, Plus, Receipt, Tag, Trash2, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InvoicingManager } from "@/components/InvoicingManager";
import { PeopleManager } from "@/components/PeopleManager";
import { TableRowSkeleton, StackedSkeleton } from "@/components/Skeletons";
import { Users2, AlertTriangle } from "lucide-react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface Profile { id: string; full_name: string; email: string; phone: string | null; is_active: boolean; is_test: boolean }

// Sort key: last name, first name. Falls back to email local part when name is missing.
const lastFirstKey = (p: { full_name?: string | null; email?: string | null }) => {
  const raw = (p.full_name || (p.email ?? "").split("@")[0] || "").trim();
  if (!raw) return "zzz";
  if (raw.includes(",")) return raw.toLowerCase(); // already "Last, First"
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].toLowerCase();
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(" ");
  return `${last} ${first}`.toLowerCase();
};

// Display name as "Last, First"
const displayLastFirst = (p: { full_name?: string | null; email?: string | null }) => {
  const raw = (p.full_name || (p.email ?? "").split("@")[0] || "").trim();
  if (!raw) return p.email ?? "—";
  if (raw.includes(",")) return raw; // already formatted
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(" ");
  return `${last}, ${first}`;
};
interface Job { id: string; name: string; address: string | null; is_active: boolean }
interface EntryRow { user_id: string; hours: number; work_date: string }
interface ReportRow { id: string; week_start: string; week_end: string; pdf_path: string | null; total_regular_hours: number; total_overtime_hours: number; generated_at: string }
interface RosterRow { id: string; full_name: string; is_active: boolean; linked_profile_id: string | null }

const AdminPortal = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState("week");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Profile | null>(null);


  const monday = useMemo(() => weekStart(), []);
  const [viewWeek, setViewWeek] = useState<string>(monday);
  const viewSunday = useMemo(() => weekEnd(viewWeek), [viewWeek]);
  const isCurrentWeek = viewWeek === monday;
  const [emailingCsv, setEmailingCsv] = useState(false);

  const shiftWeek = (delta: number) => {
    const [y, m, d] = viewWeek.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + delta * 7);
    const pad = (n: number) => String(n).padStart(2, "0");
    setViewWeek(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`);
  };

  const load = async () => {
    setLoading(true);
    const [p, j, e, r, ro] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email,phone,is_active,is_test").order("is_test", { ascending: true }).order("full_name"),
      supabase.from("jobs").select("id,name,address,is_active").order("name"),
      supabase.from("time_entries")
        .select("user_id,hours,work_date")
        .gte("work_date", viewWeek).lte("work_date", viewSunday),
      supabase.from("weekly_reports").select("id,week_start,week_end,pdf_path,total_regular_hours,total_overtime_hours,generated_at")
        .order("week_start", { ascending: false }).limit(20),
      supabase.from("roster").select("id,full_name,is_active,linked_profile_id").order("full_name"),
    ]);
    if (p.data) {
      const sorted = [...p.data].sort((a: any, b: any) => {
        if (!!a.is_test !== !!b.is_test) return a.is_test ? 1 : -1;
        return lastFirstKey(a).localeCompare(lastFirstKey(b));
      });
      setProfiles(sorted as Profile[]);
    }
    if (j.data) {
      const sortedJobs = [...j.data].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
      );
      setJobs(sortedJobs as Job[]);
    }
    if (e.data) setEntries(e.data as EntryRow[]);
    if (r.data) setReports(r.data as ReportRow[]);
    if (ro.data) setRoster(ro.data as RosterRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [viewWeek]);

  // Employees missing any entry for the selected week (active, non-test only).
  const missingEmployees = useMemo(() => {
    const logged = new Set(entries.map((e) => e.user_id));
    return profiles.filter((p) => p.is_active && !p.is_test && !logged.has(p.id));
  }, [entries, profiles]);

  const sendReportNow = async () => {
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-weekly-report", {
      body: { week_start: viewWeek },
    });
    setSending(false);
    if (error) toast.error(error.message);
    else { toast.success(t("admin.weeklyReportSent")); load(); }
  };

  const emailMyCsv = async () => {
    setEmailingCsv(true);
    const { data, error } = await supabase.functions.invoke("email-weekly-csv", {
      body: { week_start: viewWeek, week_end: viewSunday },
    });
    setEmailingCsv(false);
    if (error || (data as any)?.error) {
      toast.error(error?.message || (data as any)?.error || "Failed to send CSV");
    } else {
      toast.success(`CSV emailed${(data as any)?.recipient ? ` to ${(data as any).recipient}` : ""}`);
    }
  };

  // Aggregate per employee for current week
  const perEmployee = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      map.set(e.user_id, (map.get(e.user_id) ?? 0) + Number(e.hours));
    }
    return profiles.map((p) => {
      const total = map.get(p.id) ?? 0;
      const { regular, overtime } = splitOvertime(total);
      return { ...p, total, regular, overtime };
    }).sort((a, b) => {
      if (a.is_test !== b.is_test) return a.is_test ? 1 : -1;
      return lastFirstKey(a).localeCompare(lastFirstKey(b));
    });
  }, [entries, profiles]);

  const grandTotals = useMemo(() => {
    const total = perEmployee.reduce((s, r) => s + r.total, 0);
    const regular = perEmployee.reduce((s, r) => s + r.regular, 0);
    const overtime = perEmployee.reduce((s, r) => s + r.overtime, 0);
    return { total, regular, overtime };
  }, [perEmployee]);


  const downloadReport = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("weekly-reports")
      .createSignedUrl(path, 60 * 10, { download: true });
    if (error || !data) {
      toast.error(t("admin.downloadLink"));
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.rel = "noopener";
    a.target = "_self";
    const filename = path.split("/").pop() || "weekly-report.pdf";
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const [previewReport, setPreviewReport] = useState<ReportRow | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const openPreview = async (r: ReportRow) => {
    if (!r.pdf_path) { toast.error("No PDF available for this week yet. Click 'Send Report Now' to generate it."); return; }
    setPreviewReport(r);
    setPreviewBlob(null);
    const { data, error } = await supabase.storage
      .from("weekly-reports")
      .download(r.pdf_path);
    if (error || !data) {
      toast.error(t("admin.downloadLink"));
      setPreviewReport(null);
      return;
    }
    const blob = data.type === "application/pdf" ? data : new Blob([data], { type: "application/pdf" });
    setPreviewBlob(blob);
  };

  return (
    <PortalLayout
      title={t("admin.title")}
      subtitle={t("employee.subtitle", { range: `${formatDate(viewWeek)} – ${formatDate(viewSunday)}` })}
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 flex-wrap h-auto">
          <TabsTrigger value="week" className="font-display tracking-wider"><Users className="h-4 w-4 mr-1.5" />{t("admin.tabs.week")}</TabsTrigger>
          <TabsTrigger value="invoicing" className="font-display tracking-wider"><Receipt className="h-4 w-4 mr-1.5" />{t("admin.tabs.invoicing")}</TabsTrigger>
          <TabsTrigger value="roster" className="font-display tracking-wider"><ClipboardList className="h-4 w-4 mr-1.5" />{t("admin.tabs.roster")}</TabsTrigger>
          <TabsTrigger value="jobs" className="font-display tracking-wider"><Briefcase className="h-4 w-4 mr-1.5" />{t("admin.tabs.jobs")}</TabsTrigger>
          <TabsTrigger value="categories" className="font-display tracking-wider"><Tag className="h-4 w-4 mr-1.5" />Categories</TabsTrigger>
          <TabsTrigger value="reports" className="font-display tracking-wider"><FileDown className="h-4 w-4 mr-1.5" />{t("admin.tabs.reports")}</TabsTrigger>
          <TabsTrigger value="people" className="font-display tracking-wider"><Users2 className="h-4 w-4 mr-1.5" />People</TabsTrigger>
        </TabsList>

        <TabsContent value="week" className="space-y-5">
          {/* Week selector */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/60 px-3 py-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => shiftWeek(-1)} className="h-9 w-9 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {isCurrentWeek ? "Current week" : "Viewing week"}
              </div>
              <div className="font-display tracking-wide text-sm sm:text-base">
                {formatDate(viewWeek)} – {formatDate(viewSunday)}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!isCurrentWeek && (
                <Button type="button" variant="outline" size="sm" onClick={() => setViewWeek(monday)} className="hidden sm:inline-flex">
                  Today
                </Button>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={() => shiftWeek(1)} disabled={isCurrentWeek} className="h-9 w-9 p-0">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <BigStat label="Total" value={formatHours(grandTotals.total)} />
            <BigStat label="Regular" value={formatHours(grandTotals.regular)} />
            <BigStat label="Overtime" value={formatHours(grandTotals.overtime)} accent />
          </div>

          {/* Missing-timesheet alerts */}
          {!loading && missingEmployees.length > 0 && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-display tracking-wide uppercase text-sm text-destructive">
                    Missing timesheets ({missingEmployees.length})
                  </h3>
                  <p className="text-xs text-muted-foreground mb-2">
                    These employees have no entries for {formatDate(viewWeek)} – {formatDate(viewSunday)}.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {missingEmployees.map((p) => (
                      <span key={p.id} className="inline-flex items-center text-xs px-2 py-1 rounded-md border border-destructive/30 bg-card">
                        {displayLastFirst(p)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card shadow-deep overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 border-b border-border">
              <h2 className="font-display text-lg uppercase tracking-wide">Crew Hours</h2>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={emailMyCsv} disabled={emailingCsv} variant="outline" className="font-display tracking-wider">
                  <Mail className="h-4 w-4 mr-2" />
                  {emailingCsv ? "Sending…" : "Email me CSV"}
                </Button>
                <Button onClick={sendReportNow} disabled={sending} className="bg-maple text-maple-foreground hover:bg-maple/90 font-display tracking-wider">
                  <Mail className="h-4 w-4 mr-2" />
                  {sending ? "Sending…" : "Send Report Now"}
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="hidden sm:table-cell">Phone</TableHead>
                    <TableHead className="text-right">Regular</TableHead>
                    <TableHead className="text-right">OT</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRowSkeleton cols={5} rows={4} />
                  ) : perEmployee.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No employees yet.</TableCell></TableRow>
                  ) : perEmployee.map((p) => (
                    <TableRow
                      key={p.id}
                      onClick={() => setSelectedEmployee(p)}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      title={t("admin.roster.viewHours")}
                    >
                      <TableCell>
                        <div className="font-medium group-hover:text-maple transition-colors flex items-center gap-2">
                          {displayLastFirst(p)}
                          {p.is_test && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">Test</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">{p.email}</div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{p.phone ?? "—"}</TableCell>
                      <TableCell className="text-right font-display">{formatHours(p.regular)}</TableCell>
                      <TableCell className={`text-right font-display ${p.overtime > 0 ? "text-maple" : "text-muted-foreground"}`}>
                        {formatHours(p.overtime)}
                      </TableCell>
                      <TableCell className="text-right font-display text-lg">{formatHours(p.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="invoicing">
          <InvoicingManager jobs={jobs} profiles={profiles} />
        </TabsContent>

        <TabsContent value="roster">
          <RosterManager roster={roster} profiles={profiles} jobs={jobs} reload={load} />
        </TabsContent>

        <TabsContent value="jobs">
          <JobsManager jobs={jobs} reload={load} />
        </TabsContent>

        <TabsContent value="categories">
          <CategoriesManager />
        </TabsContent>


        <TabsContent value="reports">
          <div className="rounded-xl border border-border bg-card shadow-deep">
            <div className="p-4 border-b border-border">
              <h2 className="font-display text-lg uppercase tracking-wide">{t("admin.generatedReports")}</h2>
              <p className="text-sm text-muted-foreground">{t("admin.generatedHelp")}</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.week")}</TableHead>
                  <TableHead className="text-right">{t("admin.regular")}</TableHead>
                  <TableHead className="text-right">{t("admin.overtime")}</TableHead>
                  <TableHead className="text-right">{t("admin.pdf")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t("admin.noReports")}</TableCell></TableRow>
                ) : reports.map((r) => (
                  <TableRow
                    key={r.id}
                    onClick={() => r.pdf_path && openPreview(r)}
                    className={r.pdf_path ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}
                    title={r.pdf_path ? "Click to preview report" : ""}
                  >
                    <TableCell>{formatDate(r.week_start)} – {formatDate(r.week_end)}</TableCell>
                    <TableCell className="text-right font-display">{formatHours(Number(r.total_regular_hours))}</TableCell>
                    <TableCell className="text-right font-display text-maple">{formatHours(Number(r.total_overtime_hours))}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {r.pdf_path ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openPreview(r)}>
                            Preview
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => downloadReport(r.pdf_path!)}>
                            <FileDown className="h-4 w-4 mr-1.5" /> {t("common.download")}
                          </Button>
                        </div>
                      ) : <span className="text-muted-foreground text-sm">{t("common.emDash")}</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="people">
          <PeopleManager profiles={profiles} reload={load} />
        </TabsContent>
      </Tabs>
      {selectedEmployee && (
        <EmployeeWeekDialog profile={selectedEmployee} jobs={jobs} onClose={() => setSelectedEmployee(null)} />
      )}
      <Dialog open={!!previewReport} onOpenChange={(o) => { if (!o) { setPreviewReport(null); setPreviewBlob(null); } }}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="font-display tracking-wide">
              {previewReport && `${formatDate(previewReport.week_start)} – ${formatDate(previewReport.week_end)}`}
            </DialogTitle>
            <DialogDescription className="sr-only">Weekly report PDF preview</DialogDescription>
            {previewReport?.pdf_path && (
              <Button size="sm" variant="outline" className="mr-8" onClick={() => downloadReport(previewReport.pdf_path!)}>
                <FileDown className="h-4 w-4 mr-1.5" /> {t("common.download")}
              </Button>
            )}
          </DialogHeader>
          <PdfPreview file={previewBlob} />
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
};

const PdfPreview = ({ file }: { file: Blob | null }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState("Loading preview…");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";
    if (!file) {
      setStatus("Loading preview…");
      return;
    }

    let cancelled = false;
    setStatus("Rendering preview…");

    const renderPdf = async () => {
      try {
        const data = await file.arrayBuffer();
        const pdf = await getDocument({ data }).promise;
        const wrapperWidth = Math.max(container.clientWidth - 32, 320);
        const pixelRatio = window.devicePixelRatio || 1;

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.min(1.5, Math.max(0.8, wrapperWidth / baseViewport.width));
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) continue;

          canvas.width = Math.floor(viewport.width * pixelRatio);
          canvas.height = Math.floor(viewport.height * pixelRatio);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          canvas.className = "mx-auto my-4 block bg-background shadow-deep";
          context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
          container.appendChild(canvas);

          await page.render({ canvas, canvasContext: context, viewport }).promise;
        }

        if (!cancelled) setStatus("");
      } catch (error) {
        console.error("Report preview failed", error);
        if (!cancelled) setStatus("Preview failed. Please use Download instead.");
      }
    };

    renderPdf();

    return () => {
      cancelled = true;
      container.innerHTML = "";
    };
  }, [file]);

  return (
    <div className="relative flex-1 bg-muted overflow-auto p-4">
      {status && <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">{status}</div>}
      <div ref={containerRef} className="relative z-10 min-h-full" />
    </div>
  );
};

const BigStat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className={`rounded-xl border p-4 sm:p-5 ${accent ? "border-maple/40 bg-maple/10" : "border-border bg-card"}`}>
    <div className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
    <div className={`font-display text-2xl sm:text-4xl mt-1 ${accent ? "text-maple" : ""}`}>{value}</div>
  </div>
);

const JobsManager = ({ jobs, reload }: { jobs: Job[]; reload: () => void }) => {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("jobs").insert({ name: name.trim(), address: address.trim() || null });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setName(""); setAddress(""); toast.success(t("admin.jobs.jobAdded")); reload();
  };

  const toggle = async (j: Job) => {
    const { error } = await supabase.from("jobs").update({ is_active: !j.is_active }).eq("id", j.id);
    if (error) toast.error(error.message); else reload();
  };

  return (
    <div className="space-y-5">
      <form onSubmit={add} className="rounded-xl border border-border bg-card p-5 shadow-deep grid sm:grid-cols-[1fr_1fr_auto] gap-3">
        <Input placeholder={t("admin.jobs.name")} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
        <Input placeholder={t("admin.jobs.address")} value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} />
        <Button type="submit" disabled={busy} className="bg-maple text-maple-foreground hover:bg-maple/90 font-display tracking-wider">
          <Plus className="h-4 w-4 mr-1.5" /> {t("common.add")}
        </Button>
      </form>

      <div className="rounded-xl border border-border bg-card shadow-deep">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.roster.name")}</TableHead>
              <TableHead>{t("admin.jobs.address").replace(" (opcional)", "").replace(" (optional)", "")}</TableHead>
              <TableHead className="text-right">{t("admin.jobs.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">{t("admin.jobs.noJobs")}</TableCell></TableRow>
            ) : jobs.map((j) => (
              <TableRow key={j.id}>
                <TableCell className="font-medium">{j.name}</TableCell>
                <TableCell className="text-muted-foreground">{j.address ?? t("common.emDash")}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant={j.is_active ? "outline" : "secondary"} onClick={() => toggle(j)}>
                    {j.is_active ? t("common.active") : t("common.inactive")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

interface DetailEntry {
  id: string;
  work_date: string;
  clock_in: string;
  clock_out: string;
  hours: number;
  break_minutes: number;
  notes: string | null;
  notes_en: string | null;
  job_id: string | null;
  work_category: string | null;
  work_category_other: string | null;
  work_quantity: number | null;
}

const EmployeeWeekDialog = ({
  profile, jobs, onClose,
}: { profile: Profile; jobs: Job[]; onClose: () => void }) => {
  const { t } = useTranslation();
  const [weekOffset, setWeekOffset] = useState(0);
  const [entries, setEntries] = useState<DetailEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const monday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return weekStart(d);
  }, [weekOffset]);
  const sunday = useMemo(() => weekEnd(monday), [monday]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("time_entries")
        .select("id,work_date,clock_in,clock_out,hours,break_minutes,notes,notes_en,job_id,work_category,work_category_other,work_quantity")
        .eq("user_id", profile.id)
        .gte("work_date", monday)
        .lte("work_date", sunday)
        .order("work_date")
        .order("clock_in");
      if (!cancelled) {
        setEntries((data ?? []) as DetailEntry[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile.id, monday, sunday]);

  const jobName = (id: string | null) => jobs.find((j) => j.id === id)?.name ?? t("common.emDash");
  const total = entries.reduce((s, e) => s + Number(e.hours), 0);
  const { regular, overtime } = splitOvertime(total);

  // Group by date
  const byDate = useMemo(() => {
    const m = new Map<string, DetailEntry[]>();
    for (const e of entries) {
      const arr = m.get(e.work_date) ?? [];
      arr.push(e);
      m.set(e.work_date, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [entries]);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wide">{displayLastFirst(profile)}</DialogTitle>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </DialogHeader>

        <div className="flex items-center justify-between mt-2">
          <Button size="sm" variant="outline" onClick={() => setWeekOffset((w) => w - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> {t("common.prev")}
          </Button>
          <div className="text-sm font-medium">
            {formatDate(monday)} – {formatDate(sunday)}
            {weekOffset === 0 && <span className="ml-2 text-xs text-muted-foreground">{t("common.thisWeek")}</span>}
          </div>
          <Button size="sm" variant="outline" onClick={() => setWeekOffset((w) => w + 1)} disabled={weekOffset >= 0}>
            {t("common.next")} <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-3">
          <BigStat label={t("admin.total")} value={formatHours(total)} />
          <BigStat label={t("admin.regular")} value={formatHours(regular)} />
          <BigStat label={t("admin.ot")} value={formatHours(overtime)} accent />
        </div>

        <div className="mt-4 space-y-4">
          {loading ? (
            <StackedSkeleton rows={3} />
          ) : byDate.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("admin.roster.nothingLogged")}</p>
          ) : byDate.map(([date, dayEntries]) => {
            const dayTotal = dayEntries.reduce((s, e) => s + Number(e.hours), 0);
            return (
              <div key={date} className="rounded-lg border border-border bg-card/50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-display tracking-wide">{formatDate(date)}</div>
                  <div className="text-sm font-display">{formatHours(dayTotal)} {t("common.hours")}</div>
                </div>
                <div className="space-y-2">
                  {dayEntries.map((e) => {
                    const cat = e.work_category === "Other"
                      ? (e.work_category_other || "Other")
                      : e.work_category;
                    return (
                      <div key={e.id} className="text-sm border-l-2 border-maple/40 pl-3">
                        <div className="flex justify-between flex-wrap gap-2">
                          <span className="font-medium">{jobName(e.job_id)}</span>
                          <span className="text-muted-foreground">
                            {formatTime12(e.clock_in)} – {formatTime12(e.clock_out)} · {formatHours(Number(e.hours))} {t("common.hours")}
                            {e.break_minutes ? ` · ${e.break_minutes}m break` : ""}
                          </span>
                        </div>
                        {(cat || e.work_quantity != null) && (
                          <div className="text-xs text-foreground/80 mt-1">
                            {cat}
                            {e.work_quantity != null ? ` · qty ${e.work_quantity}` : ""}
                          </div>
                        )}
                        {(e.notes_en || e.notes) && <div className="text-muted-foreground text-xs mt-1 whitespace-pre-wrap">{e.notes_en || e.notes}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const RosterManager = ({
  roster, profiles, jobs, reload,
}: { roster: RosterRow[]; profiles: Profile[]; jobs: Job[]; reload: () => void }) => {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Profile | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("roster").insert({ full_name: name.trim() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setName(""); toast.success(t("admin.roster.addedToRoster")); reload();
  };

  const toggle = async (r: RosterRow) => {
    const { error } = await supabase.from("roster").update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) toast.error(error.message); else reload();
  };

  const remove = async (r: RosterRow) => {
    if (!confirm(t("admin.roster.confirmRemove", { name: r.full_name }))) return;
    const { error } = await supabase.from("roster").delete().eq("id", r.id);
    if (error) toast.error(error.message); else { toast.success(t("admin.roster.removed")); reload(); }
  };

  // Match roster entry to a signed-up profile by linked_profile_id, or by
  // fuzzy token overlap across the roster name, profile name, and email local part.
  // Handles "Last, First", nicknames in parens, and profiles that only stored a first name.
  const findProfile = (r: RosterRow): Profile | null => {
    if (r.linked_profile_id) {
      return profiles.find((p) => p.id === r.linked_profile_id) ?? null;
    }
    const tokenize = (s: string) =>
      new Set(
        s
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length >= 3 && !["jr", "sr", "the", "and"].includes(w))
      );
    const rosterTokens = tokenize(r.full_name);
    let best: { profile: Profile; score: number } | null = null;
    for (const p of profiles) {
      const emailLocal = (p.email ?? "").split("@")[0] ?? "";
      const profileTokens = tokenize(`${p.full_name ?? ""} ${emailLocal}`);
      let score = 0;
      for (const t of rosterTokens) {
        if (profileTokens.has(t)) { score += 2; continue; }
        // partial match within email/name (e.g. roster "hughes" inside "coryhughes1991")
        for (const pt of profileTokens) {
          if (pt.includes(t) || t.includes(pt)) { score += 1; break; }
        }
      }
      if (score > 0 && (!best || score > best.score)) best = { profile: p, score };
    }
    // Require at least 2 points (one strong match, or two partials) to avoid false hits.
    return best && best.score >= 2 ? best.profile : null;
  };


  const openDetail = (r: RosterRow) => {
    const p = findProfile(r);
    if (!p) {
      toast.error(t("admin.roster.notSignedUpYet", { name: r.full_name }));
      return;
    }
    setSelected(p);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4 shadow-deep">
        <p className="text-sm text-muted-foreground mb-3">
          {t("admin.roster.helper")}
        </p>
        <form onSubmit={add} className="grid sm:grid-cols-[1fr_auto] gap-3">
          <Input placeholder={t("admin.roster.placeholder")} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
          <Button type="submit" disabled={busy} className="bg-maple text-maple-foreground hover:bg-maple/90 font-display tracking-wider">
            <Plus className="h-4 w-4 mr-1.5" /> Add
          </Button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-deep overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.roster.name")}</TableHead>
              <TableHead className="text-right">{t("admin.jobs.status")}</TableHead>
              <TableHead className="text-right">{t("admin.roster.remove")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roster.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">{t("admin.roster.empty")}</TableCell></TableRow>
            ) : [...roster].sort((a, b) => {
              const aTest = findProfile(a)?.is_test ? 1 : 0;
              const bTest = findProfile(b)?.is_test ? 1 : 0;
              if (aTest !== bTest) return aTest - bTest;
              return lastFirstKey({ full_name: a.full_name }).localeCompare(lastFirstKey({ full_name: b.full_name }));
            }).map((r) => {
              const linked = findProfile(r);
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <button
                      onClick={() => openDetail(r)}
                      className="font-medium text-left hover:text-maple transition-colors disabled:opacity-50 disabled:hover:text-foreground"
                      disabled={!linked}
                      title={linked ? t("admin.roster.viewHours") : t("admin.roster.notSignedUp")}
                    >
                      {r.full_name}
                    </button>
                    {linked?.is_test && <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border align-middle">Test</span>}
                    {!linked && <div className="text-xs text-muted-foreground">{t("admin.roster.notSignedUp")}</div>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant={r.is_active ? "outline" : "secondary"} onClick={() => toggle(r)}>
                      {r.is_active ? t("common.active") : t("common.inactive")}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => remove(r)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {selected && (
        <EmployeeWeekDialog profile={selected} jobs={jobs} onClose={() => setSelected(null)} />
      )}
    </div>
  );
};

interface WorkCategory { id: string; name: string; sort_order: number; is_active: boolean }

const CategoriesManager = () => {
  const [cats, setCats] = useState<WorkCategory[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("work_categories")
      .select("id,name,sort_order,is_active")
      .order("sort_order")
      .order("name");
    setCats((data ?? []) as WorkCategory[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    const maxOrder = cats.reduce((m, c) => Math.max(m, c.sort_order), 0);
    const { error } = await supabase
      .from("work_categories")
      .insert({ name: trimmed, sort_order: maxOrder + 10 });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setName(""); toast.success("Category added"); load();
  };

  const toggle = async (c: WorkCategory) => {
    const { error } = await supabase
      .from("work_categories")
      .update({ is_active: !c.is_active })
      .eq("id", c.id);
    if (error) toast.error(error.message); else load();
  };

  const rename = async (c: WorkCategory) => {
    const next = window.prompt("Rename category", c.name);
    if (!next || next.trim() === c.name) return;
    const { error } = await supabase
      .from("work_categories")
      .update({ name: next.trim() })
      .eq("id", c.id);
    if (error) toast.error(error.message); else { toast.success("Renamed"); load(); }
  };

  const remove = async (c: WorkCategory) => {
    if (!confirm(`Remove "${c.name}"? Past time entries keep this category as text.`)) return;
    const { error } = await supabase.from("work_categories").delete().eq("id", c.id);
    if (error) toast.error(error.message); else { toast.success("Removed"); load(); }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4 shadow-deep">
        <p className="text-sm text-muted-foreground mb-3">
          Categories show up in the "What did you work on" dropdown on the My Time screen. Add new ones as work types come up.
        </p>
        <form onSubmit={add} className="grid sm:grid-cols-[1fr_auto] gap-3">
          <Input
            placeholder="New category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            required
          />
          <Button
            type="submit"
            disabled={busy}
            className="bg-maple text-maple-foreground hover:bg-maple/90 font-display tracking-wider"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add
          </Button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-deep overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Status</TableHead>
              <TableHead className="text-right">Rename</TableHead>
              <TableHead className="text-right">Remove</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRowSkeleton cols={4} rows={3} />
            ) : cats.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No categories yet.</TableCell></TableRow>
            ) : cats.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant={c.is_active ? "outline" : "secondary"} onClick={() => toggle(c)}>
                    {c.is_active ? "Active" : "Hidden"}
                  </Button>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => rename(c)}>Edit</Button>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => remove(c)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminPortal;
