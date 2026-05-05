import { useEffect, useMemo, useState } from "react";
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
import { Briefcase, ChevronLeft, ChevronRight, ClipboardList, FileDown, Mail, Plus, Trash2, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Profile { id: string; full_name: string; email: string; phone: string | null; is_active: boolean }
interface Job { id: string; name: string; address: string | null; is_active: boolean }
interface EntryRow { user_id: string; hours: number; work_date: string }
interface ReportRow { id: string; week_start: string; week_end: string; pdf_path: string | null; total_regular_hours: number; total_overtime_hours: number; generated_at: string }
interface RosterRow { id: string; full_name: string; is_active: boolean; linked_profile_id: string | null }

const AdminPortal = () => {
  const [tab, setTab] = useState("week");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const monday = useMemo(() => weekStart(), []);
  const sunday = useMemo(() => weekEnd(monday), [monday]);

  const load = async () => {
    setLoading(true);
    const [p, j, e, r, ro] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email,phone,is_active").order("full_name"),
      supabase.from("jobs").select("id,name,address,is_active").order("name"),
      supabase.from("time_entries")
        .select("user_id,hours,work_date")
        .gte("work_date", monday).lte("work_date", sunday),
      supabase.from("weekly_reports").select("id,week_start,week_end,pdf_path,total_regular_hours,total_overtime_hours,generated_at")
        .order("week_start", { ascending: false }).limit(20),
      supabase.from("roster").select("id,full_name,is_active,linked_profile_id").order("full_name"),
    ]);
    if (p.data) setProfiles(p.data as Profile[]);
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

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

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
    });
  }, [entries, profiles]);

  const grandTotals = useMemo(() => {
    const total = perEmployee.reduce((s, r) => s + r.total, 0);
    const regular = perEmployee.reduce((s, r) => s + r.regular, 0);
    const overtime = perEmployee.reduce((s, r) => s + r.overtime, 0);
    return { total, regular, overtime };
  }, [perEmployee]);

  const sendReportNow = async () => {
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-weekly-report", {
      body: { week_start: monday },
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Weekly report sent");
      load();
    }
  };

  const downloadReport = async (path: string) => {
    const { data, error } = await supabase.storage.from("weekly-reports").createSignedUrl(path, 60 * 10);
    if (error || !data) {
      toast.error("Could not generate download link.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <PortalLayout
      title="Admin Dashboard"
      subtitle={`Week of ${formatDate(monday)} – ${formatDate(sunday)}`}
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 flex-wrap h-auto">
          <TabsTrigger value="week" className="font-display tracking-wider"><Users className="h-4 w-4 mr-1.5" />Crew Week</TabsTrigger>
          <TabsTrigger value="roster" className="font-display tracking-wider"><ClipboardList className="h-4 w-4 mr-1.5" />Roster</TabsTrigger>
          <TabsTrigger value="jobs" className="font-display tracking-wider"><Briefcase className="h-4 w-4 mr-1.5" />Jobs</TabsTrigger>
          <TabsTrigger value="reports" className="font-display tracking-wider"><FileDown className="h-4 w-4 mr-1.5" />Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="week" className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <BigStat label="Total" value={formatHours(grandTotals.total)} />
            <BigStat label="Regular" value={formatHours(grandTotals.regular)} />
            <BigStat label="Overtime" value={formatHours(grandTotals.overtime)} accent />
          </div>

          <div className="rounded-xl border border-border bg-card shadow-deep overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-display text-lg uppercase tracking-wide">Crew Hours</h2>
              <Button onClick={sendReportNow} disabled={sending} className="bg-maple text-maple-foreground hover:bg-maple/90 font-display tracking-wider">
                <Mail className="h-4 w-4 mr-2" />
                {sending ? "Sending…" : "Send Report Now"}
              </Button>
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
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                  ) : perEmployee.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No employees yet.</TableCell></TableRow>
                  ) : perEmployee.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.full_name || p.email}</div>
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

        <TabsContent value="roster">
          <RosterManager roster={roster} profiles={profiles} jobs={jobs} reload={load} />
        </TabsContent>

        <TabsContent value="jobs">
          <JobsManager jobs={jobs} reload={load} />
        </TabsContent>

        <TabsContent value="reports">
          <div className="rounded-xl border border-border bg-card shadow-deep">
            <div className="p-4 border-b border-border">
              <h2 className="font-display text-lg uppercase tracking-wide">Generated Reports</h2>
              <p className="text-sm text-muted-foreground">Auto-generated every Friday at 6 PM. Click to download the PDF.</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week</TableHead>
                  <TableHead className="text-right">Regular</TableHead>
                  <TableHead className="text-right">Overtime</TableHead>
                  <TableHead className="text-right">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No reports yet.</TableCell></TableRow>
                ) : reports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.week_start)} – {formatDate(r.week_end)}</TableCell>
                    <TableCell className="text-right font-display">{formatHours(Number(r.total_regular_hours))}</TableCell>
                    <TableCell className="text-right font-display text-maple">{formatHours(Number(r.total_overtime_hours))}</TableCell>
                    <TableCell className="text-right">
                      {r.pdf_path ? (
                        <Button size="sm" variant="outline" onClick={() => downloadReport(r.pdf_path!)}>
                          <FileDown className="h-4 w-4 mr-1.5" /> Download
                        </Button>
                      ) : <span className="text-muted-foreground text-sm">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </PortalLayout>
  );
};

const BigStat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className={`rounded-xl border p-4 sm:p-5 ${accent ? "border-maple/40 bg-maple/10" : "border-border bg-card"}`}>
    <div className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
    <div className={`font-display text-2xl sm:text-4xl mt-1 ${accent ? "text-maple" : ""}`}>{value}</div>
  </div>
);

const JobsManager = ({ jobs, reload }: { jobs: Job[]; reload: () => void }) => {
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
    setName(""); setAddress(""); toast.success("Job added"); reload();
  };

  const toggle = async (j: Job) => {
    const { error } = await supabase.from("jobs").update({ is_active: !j.is_active }).eq("id", j.id);
    if (error) toast.error(error.message); else reload();
  };

  return (
    <div className="space-y-5">
      <form onSubmit={add} className="rounded-xl border border-border bg-card p-5 shadow-deep grid sm:grid-cols-[1fr_1fr_auto] gap-3">
        <Input placeholder="Job name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
        <Input placeholder="Address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} />
        <Button type="submit" disabled={busy} className="bg-maple text-maple-foreground hover:bg-maple/90 font-display tracking-wider">
          <Plus className="h-4 w-4 mr-1.5" /> Add
        </Button>
      </form>

      <div className="rounded-xl border border-border bg-card shadow-deep">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No jobs yet.</TableCell></TableRow>
            ) : jobs.map((j) => (
              <TableRow key={j.id}>
                <TableCell className="font-medium">{j.name}</TableCell>
                <TableCell className="text-muted-foreground">{j.address ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant={j.is_active ? "outline" : "secondary"} onClick={() => toggle(j)}>
                    {j.is_active ? "Active" : "Inactive"}
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
  notes: string | null;
  job_id: string | null;
}

const EmployeeWeekDialog = ({
  profile, jobs, onClose,
}: { profile: Profile; jobs: Job[]; onClose: () => void }) => {
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
        .select("id,work_date,clock_in,clock_out,hours,notes,job_id")
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

  const jobName = (id: string | null) => jobs.find((j) => j.id === id)?.name ?? "—";
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
          <DialogTitle className="font-display tracking-wide">{profile.full_name || profile.email}</DialogTitle>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </DialogHeader>

        <div className="flex items-center justify-between mt-2">
          <Button size="sm" variant="outline" onClick={() => setWeekOffset((w) => w - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Prev
          </Button>
          <div className="text-sm font-medium">
            {formatDate(monday)} – {formatDate(sunday)}
            {weekOffset === 0 && <span className="ml-2 text-xs text-muted-foreground">(this week)</span>}
          </div>
          <Button size="sm" variant="outline" onClick={() => setWeekOffset((w) => w + 1)} disabled={weekOffset >= 0}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-3">
          <BigStat label="Total" value={formatHours(total)} />
          <BigStat label="Regular" value={formatHours(regular)} />
          <BigStat label="OT" value={formatHours(overtime)} accent />
        </div>

        <div className="mt-4 space-y-4">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading…</p>
          ) : byDate.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hours logged this week.</p>
          ) : byDate.map(([date, dayEntries]) => {
            const dayTotal = dayEntries.reduce((s, e) => s + Number(e.hours), 0);
            return (
              <div key={date} className="rounded-lg border border-border bg-card/50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-display tracking-wide">{formatDate(date)}</div>
                  <div className="text-sm font-display">{formatHours(dayTotal)} hrs</div>
                </div>
                <div className="space-y-2">
                  {dayEntries.map((e) => (
                    <div key={e.id} className="text-sm border-l-2 border-maple/40 pl-3">
                      <div className="flex justify-between flex-wrap gap-2">
                        <span className="font-medium">{jobName(e.job_id)}</span>
                        <span className="text-muted-foreground">
                          {formatTime12(e.clock_in)} – {formatTime12(e.clock_out)} · {formatHours(Number(e.hours))} hrs
                        </span>
                      </div>
                      {e.notes && <div className="text-muted-foreground text-xs mt-1 whitespace-pre-wrap">{e.notes}</div>}
                    </div>
                  ))}
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
    setName(""); toast.success("Added to roster"); reload();
  };

  const toggle = async (r: RosterRow) => {
    const { error } = await supabase.from("roster").update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) toast.error(error.message); else reload();
  };

  const remove = async (r: RosterRow) => {
    if (!confirm(`Remove ${r.full_name} from the roster?`)) return;
    const { error } = await supabase.from("roster").delete().eq("id", r.id);
    if (error) toast.error(error.message); else { toast.success("Removed"); reload(); }
  };

  // Match roster entry to a signed-up profile (by linked_profile_id or name)
  const findProfile = (r: RosterRow): Profile | null => {
    if (r.linked_profile_id) {
      return profiles.find((p) => p.id === r.linked_profile_id) ?? null;
    }
    const norm = r.full_name.trim().toLowerCase();
    return profiles.find((p) => (p.full_name ?? "").trim().toLowerCase() === norm) ?? null;
  };

  const openDetail = (r: RosterRow) => {
    const p = findProfile(r);
    if (!p) {
      toast.error(`${r.full_name} hasn't signed up yet — no hours to show.`);
      return;
    }
    setSelected(p);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4 shadow-deep">
        <p className="text-sm text-muted-foreground mb-3">
          Click a name to view their weekly hours and job history. Each employee still needs to sign up at <span className="text-foreground font-mono">/auth</span> using their own email + password to clock in.
        </p>
        <form onSubmit={add} className="grid sm:grid-cols-[1fr_auto] gap-3">
          <Input placeholder="Last, First" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
          <Button type="submit" disabled={busy} className="bg-maple text-maple-foreground hover:bg-maple/90 font-display tracking-wider">
            <Plus className="h-4 w-4 mr-1.5" /> Add
          </Button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-deep overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Status</TableHead>
              <TableHead className="text-right">Remove</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roster.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No roster entries.</TableCell></TableRow>
            ) : roster.map((r) => {
              const linked = findProfile(r);
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <button
                      onClick={() => openDetail(r)}
                      className="font-medium text-left hover:text-maple transition-colors disabled:opacity-50 disabled:hover:text-foreground"
                      disabled={!linked}
                      title={linked ? "View weekly hours" : "Not signed up yet"}
                    >
                      {r.full_name}
                    </button>
                    {!linked && <div className="text-xs text-muted-foreground">Not signed up yet</div>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant={r.is_active ? "outline" : "secondary"} onClick={() => toggle(r)}>
                      {r.is_active ? "Active" : "Inactive"}
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

export default AdminPortal;
