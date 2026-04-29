import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PortalLayout } from "@/components/PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  computeHours, formatDate, formatHours, splitOvertime,
  todayISO, weekEnd, weekStart,
} from "@/lib/time";
import { Clock, Save, Calendar } from "lucide-react";

interface Job { id: string; name: string }
interface Entry {
  id: string; work_date: string; clock_in: string; clock_out: string;
  break_minutes: number; hours: number; job_id: string | null; notes: string | null;
}

const EmployeePortal = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const monday = useMemo(() => weekStart(), []);
  const sunday = useMemo(() => weekEnd(monday), [monday]);

  // form
  const [date, setDate] = useState(todayISO());
  const [clockIn, setClockIn] = useState("07:00");
  const [clockOut, setClockOut] = useState("16:00");
  const [breakMin, setBreakMin] = useState(30);
  const [jobId, setJobId] = useState<string>("");
  const [notes, setNotes] = useState("");

  const liveHours = computeHours(clockIn, clockOut, breakMin);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const [jobsRes, entriesRes] = await Promise.all([
      supabase.from("jobs").select("id,name").eq("is_active", true).order("name"),
      supabase.from("time_entries")
        .select("id,work_date,clock_in,clock_out,break_minutes,hours,job_id,notes")
        .eq("user_id", user.id)
        .gte("work_date", monday)
        .lte("work_date", sunday)
        .order("work_date", { ascending: false }),
    ]);
    if (jobsRes.data) {
      setJobs(jobsRes.data);
      if (!jobId && jobsRes.data.length) setJobId(jobsRes.data[0].id);
    }
    if (entriesRes.data) setEntries(entriesRes.data as Entry[]);
    setLoading(false);
  };

  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, [user]);

  // Pre-fill form if today's entry already exists
  useEffect(() => {
    const existing = entries.find((e) => e.work_date === date);
    if (existing) {
      setClockIn(existing.clock_in.slice(0, 5));
      setClockOut(existing.clock_out.slice(0, 5));
      setBreakMin(existing.break_minutes);
      setJobId(existing.job_id ?? jobId);
      setNotes(existing.notes ?? "");
    }
    // eslint-disable-next-line
  }, [date, entries]);

  const totals = useMemo(() => {
    const total = entries.reduce((sum, e) => sum + Number(e.hours), 0);
    return { total, ...splitOvertime(total) };
  }, [entries]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!clockIn || !clockOut) {
      toast.error("Enter clock in and clock out times.");
      return;
    }
    if (liveHours <= 0) {
      toast.error("Clock out must be after clock in.");
      return;
    }
    setSaving(true);
    const payload = {
      user_id: user.id,
      job_id: jobId || null,
      work_date: date,
      clock_in: `${clockIn}:00`,
      clock_out: `${clockOut}:00`,
      break_minutes: breakMin,
      hours: liveHours,
      notes: notes.trim() || null,
    };
    const { error } = await supabase
      .from("time_entries")
      .upsert(payload, { onConflict: "user_id,work_date" });
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Saved");
      setNotes("");
      await loadData();
    }
  };

  return (
    <PortalLayout
      title="My Time"
      subtitle={`Week of ${formatDate(monday)} – ${formatDate(sunday)}`}
    >
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Entry form */}
        <form
          onSubmit={submit}
          className="lg:col-span-3 rounded-xl border border-border bg-card p-5 sm:p-6 shadow-deep"
        >
          <div className="flex items-center gap-2 mb-5">
            <Clock className="h-5 w-5 text-maple" />
            <h2 className="font-display text-xl uppercase tracking-wide">Today's Entry</h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} max={todayISO()}
                     onChange={(e) => setDate(e.target.value)} className="mt-1.5" required />
            </div>
            <div>
              <Label>Job Site</Label>
              <Select value={jobId} onValueChange={setJobId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Pick a job" /></SelectTrigger>
                <SelectContent>
                  {jobs.map((j) => (
                    <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ci">Clock In</Label>
              <Input id="ci" type="time" value={clockIn}
                     onChange={(e) => setClockIn(e.target.value)} className="mt-1.5 text-lg" required />
            </div>
            <div>
              <Label htmlFor="co">Clock Out</Label>
              <Input id="co" type="time" value={clockOut}
                     onChange={(e) => setClockOut(e.target.value)} className="mt-1.5 text-lg" required />
            </div>
            <div>
              <Label htmlFor="brk">Break (minutes)</Label>
              <Input id="brk" type="number" min={0} max={480} value={breakMin}
                     onChange={(e) => setBreakMin(Number(e.target.value) || 0)} className="mt-1.5" />
            </div>
            <div className="rounded-lg bg-gradient-maple/10 border border-maple/30 p-3 flex flex-col justify-center">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Hours Today</div>
              <div className="font-display text-3xl text-maple">{formatHours(liveHours)}</div>
            </div>
          </div>

          <div className="mt-4">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}
                      maxLength={500} placeholder="What did you work on today?" className="mt-1.5" rows={2} />
          </div>

          <Button type="submit" disabled={saving}
                  className="w-full mt-5 h-12 bg-maple text-maple-foreground hover:bg-maple/90 font-display tracking-wider text-base">
            <Save className="h-5 w-5 mr-2" />
            {saving ? "Saving…" : "Save Today's Hours"}
          </Button>
        </form>

        {/* Week summary */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-xl border border-border bg-card p-5 shadow-deep">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-maple" />
              <h2 className="font-display text-xl uppercase tracking-wide">This Week</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Total" value={formatHours(totals.total)} />
              <Stat label="Regular" value={formatHours(totals.regular)} />
              <Stat label="Overtime" value={formatHours(totals.overtime)} accent />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-deep">
            <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground mb-3">Daily Log</h3>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : entries.length === 0 ? (
              <div className="text-sm text-muted-foreground">No hours entered yet this week.</div>
            ) : (
              <ul className="divide-y divide-border">
                {entries.map((e) => {
                  const job = jobs.find((j) => j.id === e.job_id);
                  return (
                    <li key={e.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{formatDate(e.work_date)}</div>
                        <div className="text-xs text-muted-foreground">
                          {e.clock_in.slice(0,5)}–{e.clock_out.slice(0,5)} · {job?.name ?? "—"}
                        </div>
                      </div>
                      <div className="font-display text-lg text-maple">{formatHours(Number(e.hours))}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
};

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className={`rounded-lg border p-3 ${accent ? "border-maple/40 bg-maple/10" : "border-border bg-background/60"}`}>
    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    <div className={`font-display text-2xl ${accent ? "text-maple" : "text-foreground"}`}>{value}</div>
  </div>
);

export default EmployeePortal;
