import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
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
  computeHours, formatDate, formatHours, formatTime12, splitOvertime,
  todayISO, weekEnd, weekStart,
} from "@/lib/time";
import { Clock, Save, Calendar, FileDown, FileText, Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import jsPDF from "jspdf";

interface Job { id: string; name: string }
interface Entry {
  id: string; work_date: string; clock_in: string; clock_out: string;
  break_minutes: number; hours: number; job_id: string | null; notes: string | null;
  work_category?: string | null; work_category_other?: string | null; work_quantity?: number | null;
}

// Categories are loaded from the work_categories table (admins can edit them)

const EmployeePortal = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const monday = useMemo(() => weekStart(), []);
  const sunday = useMemo(() => weekEnd(monday), [monday]);
  const [viewWeek, setViewWeek] = useState<string>(monday);
  const viewSunday = useMemo(() => weekEnd(viewWeek), [viewWeek]);
  const isCurrentWeek = viewWeek === monday;

  // form — date editable in case employee forgot to log a previous day
  const [date, setDate] = useState<string>(todayISO());
  const maxDate = todayISO();
  const [defaultJobId, setDefaultJobId] = useState<string>("");
  

  type Shift = {
    clockIn: string; clockOut: string; jobId: string; notes: string;
    breakMinutes: string; category: string; categoryOther: string; quantity: string;
  };
  const blankShift = (): Shift => ({
    clockIn: "", clockOut: "", jobId: "", notes: "",
    breakMinutes: "", category: "", categoryOther: "", quantity: "",
  });
  const [shifts, setShifts] = useState<Shift[]>([blankShift()]);

  const updateShift = (i: number, patch: Partial<Shift>) =>
    setShifts((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const addShift = () =>
    setShifts((prev) => (prev.length >= 5 ? prev : [...prev, blankShift()]));
  const removeShift = (i: number) =>
    setShifts((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));

  const shiftHours = (s: Shift) =>
    computeHours(s.clockIn, s.clockOut, Math.max(0, parseInt(s.breakMinutes || "0", 10) || 0));
  const liveHours = shifts.reduce((sum, s) => sum + shiftHours(s), 0);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const [jobsRes, entriesRes, catsRes] = await Promise.all([
      supabase.from("jobs").select("id,name").eq("is_active", true).order("name"),
      supabase.from("time_entries")
        .select("id,work_date,clock_in,clock_out,break_minutes,hours,job_id,notes,work_category,work_category_other,work_quantity")
        .eq("user_id", user.id)
        .gte("work_date", viewWeek)
        .lte("work_date", viewSunday)
        .order("work_date", { ascending: false }),
      supabase.from("work_categories").select("name,sort_order").eq("is_active", true).order("sort_order"),
    ]);
    if (catsRes.data) setCategories(catsRes.data.map((c) => c.name));
    if (jobsRes.data) {
      // Natural sort so Hamilton Lot # 2 comes before # 10
      const sorted = [...jobsRes.data].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
      );
      setJobs(sorted);
      if (!defaultJobId && sorted.length) {
        setDefaultJobId(sorted[0].id);
      }
    }
    if (entriesRes.data) setEntries(entriesRes.data as Entry[]);
    setLoading(false);
  };

  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, [user, viewWeek]);

  const deleteEntry = async (entryId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("time_entries")
      .delete()
      .eq("id", entryId)
      .eq("user_id", user.id);
    if (error) { toast.error(error.message); }
    else { toast.success("Entry removed"); await loadData(); }
  };

  const dateEntries = entries.filter((e) => e.work_date === date);

  const totals = useMemo(() => {
    const total = entries.reduce((sum, e) => sum + Number(e.hours), 0);
    return { total, ...splitOvertime(total) };
  }, [entries]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const valid = shifts.filter((s) => s.clockIn && s.clockOut);
    if (valid.length === 0) {
      toast.error(t("employee.addOne"));
      return;
    }
    for (const s of valid) {
      if (shiftHours(s) <= 0) {
        toast.error(t("employee.afterIn"));
        return;
      }
    }
    setSaving(true);
    // If the employee is using Spanish, translate notes to English for admin reports.
    const lang = (i18n.language || "en").toLowerCase();
    const translateNotes = async (txt: string): Promise<string | null> => {
      const trimmed = txt.trim();
      if (!trimmed) return null;
      if (lang.startsWith("en")) return trimmed;
      try {
        const { data, error } = await supabase.functions.invoke("translate-text", {
          body: { text: trimmed, sourceLang: lang },
        });
        if (error) return trimmed;
        return (data?.translated as string) || trimmed;
      } catch {
        return trimmed;
      }
    };
    const categoryLabel = (s: Shift) => {
      if (!s.category) return null;
      if (s.category === "__other__") return s.categoryOther.trim() || "Other";
      return s.category;
    };
    const rows = await Promise.all(valid.map(async (s) => {
      const breakMin = Math.max(0, parseInt(s.breakMinutes || "0", 10) || 0);
      const qty = s.quantity.trim() === "" ? null : Number(s.quantity);
      const isOther = s.category === "__other__";
      const otherDetail = isOther ? s.categoryOther.trim() : "";
      const otherDetailEn = isOther ? await translateNotes(otherDetail) : null;
      return {
        user_id: user.id,
        job_id: s.jobId || null,
        work_date: date,
        clock_in: `${s.clockIn}:00`,
        clock_out: `${s.clockOut}:00`,
        break_minutes: breakMin,
        hours: shiftHours(s),
        notes: s.notes.trim() || null,
        notes_en: await translateNotes(s.notes),
        work_category: isOther ? "Other" : (s.category || null),
        work_category_other: otherDetailEn || (isOther ? otherDetail || null : null),
        work_quantity: qty !== null && !Number.isNaN(qty) ? qty : null,
      };
    }));
    const { error } = await supabase.from("time_entries").insert(rows);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("employee.saved"));
      // Notify admins once with summary
      const jobNames = valid
        .map((s) => jobs.find((j) => j.id === s.jobId)?.name ?? "—")
        .join(", ");
      const first = valid[0];
      const last = valid[valid.length - 1];
      const summaryParts = rows.map((r, i) => {
        const bits: string[] = [];
        const cat = r.work_category === "Other" ? (r.work_category_other || "Other") : r.work_category;
        if (cat) bits.push(cat);
        if (r.work_quantity != null) bits.push(`qty ${r.work_quantity}`);
        if (r.break_minutes) bits.push(`${r.break_minutes}m break`);
        if (r.notes_en) bits.push(r.notes_en);
        return bits.length ? `Job ${i + 1}: ${bits.join(" — ")}` : null;
      }).filter(Boolean).join(" | ");
      supabase.functions.invoke("notify-admins", {
        body: {
          templateName: "admin-hours-submitted",
          idempotencyKey: `hours-${user.id}-${date}-${Date.now()}`,
          templateData: {
            employeeName: employeeName,
            workDate: formatDate(date),
            jobName: jobNames,
            clockIn: formatTime12(`${first.clockIn}:00`),
            clockOut: formatTime12(`${last.clockOut}:00`),
            breakMinutes: rows.reduce((sum, r) => sum + (r.break_minutes || 0), 0),
            hours: liveHours.toFixed(2),
            notes: summaryParts || undefined,
          },
        },
      }).catch(() => {});
      setShifts([blankShift()]);
      await loadData();
    }
  };

  const employeeName = (user?.user_metadata as { full_name?: string } | undefined)?.full_name || user?.email || "Employee";
  const weekLabel = `${formatDate(monday)} – ${formatDate(sunday)}`;
  const fileBase = `timesheet_${monday}_to_${sunday}`;

  const buildRows = () =>
    [...entries]
      .sort((a, b) => a.work_date.localeCompare(b.work_date))
      .map((e) => {
        const cat = e.work_category === "Other"
          ? (e.work_category_other || "Other")
          : (e.work_category ?? "");
        return {
          date: formatDate(e.work_date),
          clockIn: formatTime12(e.clock_in),
          clockOut: formatTime12(e.clock_out),
          breakMin: e.break_minutes,
          job: jobs.find((j) => j.id === e.job_id)?.name ?? "—",
          category: cat,
          quantity: e.work_quantity != null ? String(e.work_quantity) : "",
          notes: e.notes ?? "",
          hours: Number(e.hours),
        };
      });

  const exportCsv = () => {
    if (entries.length === 0) { toast.error(t("employee.nothingToExport")); return; }
    const rows = buildRows();
    const esc = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [t("employee.date"), t("employee.clockIn"), t("employee.clockOut"), "Break (min)", t("employee.jobSite"), "Work Category", "Quantity", t("common.notes"), t("employee.total")];
    const lines = [
      `${t("employee.employeeLabel")},${esc(employeeName)}`,
      `${t("employee.weekLabel")},${esc(weekLabel)}`,
      "",
      header.join(","),
      ...rows.map((r) => [r.date, r.clockIn, r.clockOut, r.breakMin, r.job, r.category, r.quantity, r.notes, r.hours.toFixed(2)].map(esc).join(",")),
      "",
      `,,,,,,,${t("employee.regular")},${totals.regular.toFixed(2)}`,
      `,,,,,,,${t("employee.overtime")},${totals.overtime.toFixed(2)}`,
      `,,,,,,,${t("employee.total")},${totals.total.toFixed(2)}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${fileBase}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(t("employee.csvDownloaded"));
  };

  const exportPdf = () => {
    if (entries.length === 0) { toast.error(t("employee.nothingToExport")); return; }
    const rows = buildRows();
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 40;
    let y = margin;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Dwayne Noe Construction", margin, y);
    y += 20;
    doc.setFontSize(12);
    doc.text(t("employee.weeklyTimesheet"), margin, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`${t("employee.employeeLabel")}: ${employeeName}`, margin, y); y += 14;
    doc.text(`${t("employee.weekLabel")}: ${weekLabel}`, margin, y); y += 18;

    const cols = [
      { label: t("employee.date"), w: 100 },
      { label: t("employee.clockIn"), w: 70 },
      { label: t("employee.clockOut"), w: 70 },
      { label: "Brk", w: 35 },
      { label: t("employee.jobSite"), w: 130 },
      { label: t("common.hours"), w: 40 },
    ];
    doc.setFont("helvetica", "bold");
    doc.setFillColor(230, 230, 235);
    doc.rect(margin, y - 11, pageW - margin * 2, 16, "F");
    let x = margin + 4;
    cols.forEach((c) => { doc.text(c.label, x, y); x += c.w; });
    y += 10;
    doc.setFont("helvetica", "normal");

    rows.forEach((r) => {
      if (y > 720) { doc.addPage(); y = margin; }
      x = margin + 4;
      const vals = [r.date, r.clockIn, r.clockOut, String(r.breakMin), r.job, r.hours.toFixed(2)];
      vals.forEach((v, i) => {
        const text = doc.splitTextToSize(v, cols[i].w - 6)[0] ?? "";
        doc.text(text, x, y + 12);
        x += cols[i].w;
      });
      y += 16;
      if (r.notes) {
        const noteLines = doc.splitTextToSize(`${t("common.notes")}: ${r.notes}`, pageW - margin * 2 - 8);
        doc.setTextColor(90); doc.setFontSize(9);
        noteLines.forEach((ln: string) => {
          if (y > 740) { doc.addPage(); y = margin; }
          doc.text(ln, margin + 8, y + 10); y += 12;
        });
        doc.setTextColor(0); doc.setFontSize(10);
        y += 2;
      }
      doc.setDrawColor(220);
      doc.line(margin, y, pageW - margin, y);
      y += 4;
    });

    if (y > 680) { doc.addPage(); y = margin; }
    y += 14;
    doc.setFont("helvetica", "bold");
    doc.text(`${t("employee.regular")}: ${totals.regular.toFixed(2)} ${t("common.hours")}`, margin, y); y += 14;
    doc.text(`${t("employee.overtime")}: ${totals.overtime.toFixed(2)} ${t("common.hours")}`, margin, y); y += 14;
    doc.text(`${t("employee.total")}: ${totals.total.toFixed(2)} ${t("common.hours")}`, margin, y);

    doc.save(`${fileBase}.pdf`);
    toast.success(t("employee.pdfDownloaded"));
  };

  return (
    <PortalLayout
      title={t("employee.title")}
      subtitle={t("employee.subtitle", { range: `${formatDate(monday)} – ${formatDate(sunday)}` })}
    >
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Entry form */}
        {!isCurrentWeek ? (
          <div className="lg:col-span-3 rounded-xl border border-maple/40 bg-maple/10 p-6 shadow-deep flex items-center justify-center text-center">
            <div>
              <div className="font-display text-lg uppercase tracking-wide text-maple mb-1">
                Viewing {formatDate(viewWeek)} – {formatDate(viewSunday)}
              </div>
              <div className="text-sm text-muted-foreground">Past weeks are read-only</div>
            </div>
          </div>
        ) : (
        <form
          onSubmit={submit}
          className="lg:col-span-3 rounded-xl border border-border bg-card p-5 sm:p-6 shadow-deep"
        >
          <div className="flex items-center gap-2 mb-5">
            <Clock className="h-5 w-5 text-maple" />
            <h2 className="font-display text-xl uppercase tracking-wide">{t("employee.todaysEntry")}</h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <Label>{t("employee.date")}</Label>
              <Input
                type="date"
                value={date}
                min={monday}
                max={maxDate}
                onChange={(e) => setDate(e.target.value || todayISO())}
                className="mt-1.5"
              />
              <div className="text-xs text-muted-foreground mt-1">{formatDate(date)}</div>
            </div>
            <div className="rounded-lg bg-gradient-maple/10 border border-maple/30 p-3 flex flex-col justify-center">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">{t("employee.totalToday")}</div>
              <div className="font-display text-3xl text-maple">{formatHours(liveHours)}</div>
            </div>
          </div>

          <div className="space-y-4">
            {shifts.map((s, i) => (
              <div key={i} className="rounded-lg border border-border bg-background/40 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-display text-sm uppercase tracking-widest text-muted-foreground">
                    {t("employee.shift", { n: i + 1 })}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-maple font-display">
                      {formatHours(shiftHours(s))} {t("common.hours")}
                    </div>
                    {shifts.length > 1 && (
                      <Button type="button" variant="ghost" size="sm"
                              onClick={() => removeShift(i)}
                              className="h-8 px-2 text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-3">
                    <Label>{t("employee.jobSite")}</Label>
                    <select
                      value={s.jobId}
                      onChange={(e) => updateShift(i, { jobId: e.target.value })}
                      className="mt-1.5 flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none bg-no-repeat bg-[right_0.75rem_center] bg-[length:1em_1em]"
                      style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' opacity='0.5'><polyline points='6 9 12 15 18 9'/></svg>\")", paddingRight: "2.25rem" }}
                    >
                      <option value="" disabled>{t("employee.pickJob")}</option>
                      {jobs.map((j) => (
                        <option key={j.id} value={j.id}>{j.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>{t("employee.clockIn")}</Label>
                    <Input type="time" value={s.clockIn}
                           onChange={(e) => updateShift(i, { clockIn: e.target.value })}
                           className="mt-1.5 text-lg" required />
                  </div>
                  <div>
                    <Label>{t("employee.clockOut")}</Label>
                    <Input type="time" value={s.clockOut}
                           onChange={(e) => updateShift(i, { clockOut: e.target.value })}
                           className="mt-1.5 text-lg" required />
                  </div>
                  <div>
                    <Label>{t("employee.breakMinutes")} <span className="text-muted-foreground font-normal">{t("common.optional")}</span></Label>
                    <Input type="number" inputMode="numeric" min={0} max={480} step={5}
                           value={s.breakMinutes}
                           onChange={(e) => updateShift(i, { breakMinutes: e.target.value })}
                           placeholder={t("employee.breakPlaceholder")}
                           className="mt-1.5" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>{t("employee.workCategory")}</Label>
                    <select
                      value={s.category}
                      onChange={(e) => updateShift(i, { category: e.target.value })}
                      className="mt-1.5 flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 appearance-none bg-no-repeat bg-[right_0.75rem_center] bg-[length:1em_1em]"
                      style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' opacity='0.5'><polyline points='6 9 12 15 18 9'/></svg>\")", paddingRight: "2.25rem" }}
                    >
                      <option value="">{t("employee.pickCategory")}</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="__other__">{t("employee.otherCategory")}…</option>
                    </select>
                  </div>
                  {s.category === "__other__" && (
                    <div className="sm:col-span-3">
                      <Label>{t("employee.otherDetail")}</Label>
                      <Input value={s.categoryOther}
                             onChange={(e) => updateShift(i, { categoryOther: e.target.value })}
                             maxLength={120}
                             className="mt-1.5" />
                    </div>
                  )}
                  <div className="sm:col-span-3">
                    <Label>{t("employee.quantity")}</Label>
                    <Input type="number" inputMode="decimal" min={0} step="any"
                           value={s.quantity}
                           onChange={(e) => updateShift(i, { quantity: e.target.value })}
                           placeholder={t("employee.quantityPlaceholder")}
                           className="mt-1.5" />
                  </div>
                  <div className="sm:col-span-3">
                    <Label>{t("employee.notesForJob")}</Label>
                    <Textarea value={s.notes}
                              onChange={(e) => updateShift(i, { notes: e.target.value })}
                              maxLength={500}
                              placeholder={t("employee.notesPlaceholder", { n: i + 1 })}
                              className="mt-1.5" rows={2} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {shifts.length < 5 && (
            <Button type="button" variant="outline" onClick={addShift}
                    className="w-full mt-4 font-display tracking-wider">
              <Plus className="h-4 w-4 mr-2" /> {t("employee.addAnother", { n: shifts.length })}
            </Button>
          )}


          <Button type="submit" disabled={saving}
                  className="w-full mt-5 h-12 bg-maple text-maple-foreground hover:bg-maple/90 font-display tracking-wider text-base">
            <Save className="h-5 w-5 mr-2" />
            {saving ? t("employee.saving") : t("employee.saveHours")}
          </Button>
        </form>

        {/* Week summary */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-xl border border-border bg-card p-5 shadow-deep">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-maple" />
              <h2 className="font-display text-xl uppercase tracking-wide">{t("employee.thisWeek")}</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Stat label={t("employee.total")} value={formatHours(totals.total)} />
              <Stat label={t("employee.regular")} value={formatHours(totals.regular)} />
              <Stat label={t("employee.overtime")} value={formatHours(totals.overtime)} accent />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Button type="button" variant="outline" onClick={exportCsv} disabled={entries.length === 0} className="font-display tracking-wider">
                <FileDown className="h-4 w-4 mr-1.5" /> {t("employee.csv")}
              </Button>
              <Button type="button" variant="outline" onClick={exportPdf} disabled={entries.length === 0} className="font-display tracking-wider">
                <FileText className="h-4 w-4 mr-1.5" /> {t("employee.pdf")}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-deep">
            <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground mb-3">{t("employee.dailyLog")}</h3>
            {loading ? (
              <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
            ) : entries.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t("employee.nothingThisWeek")}</div>
            ) : (
              <ul className="divide-y divide-border">
                {entries.map((e) => {
                  const job = jobs.find((j) => j.id === e.job_id);
                  return (
                    <li key={e.id} className="py-2.5 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm">{formatDate(e.work_date)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatTime12(e.clock_in)} – {formatTime12(e.clock_out)} · {job?.name ?? "—"}
                          {e.break_minutes ? ` · ${e.break_minutes}m break` : ""}
                        </div>
                        {(e.work_category || e.work_quantity != null) && (
                          <div className="text-xs text-foreground/80 mt-1">
                            {e.work_category === "Other" ? (e.work_category_other || "Other") : e.work_category}
                            {e.work_quantity != null ? ` · qty ${e.work_quantity}` : ""}
                          </div>
                        )}
                        {e.notes && (
                          <div className="text-xs text-foreground/80 mt-1 italic break-words">
                            “{e.notes}”
                          </div>
                        )}
                      </div>
                      <div className="font-display text-lg text-maple shrink-0">{formatHours(Number(e.hours))}</div>
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
