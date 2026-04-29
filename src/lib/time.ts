/**
 * Hours / week helpers — Monday through Sunday work week.
 */

const pad = (n: number) => String(n).padStart(2, "0");

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

/** Returns ISO date for the Monday of the week the given date belongs to. */
export const weekStart = (date: Date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun, 1 = Mon
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const weekEnd = (mondayISO: string) => {
  const [y, m, d] = mondayISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 6);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

/** Compute hours from clock_in/clock_out (HH:MM) and break minutes. */
export const computeHours = (clockIn: string, clockOut: string, breakMinutes: number) => {
  if (!clockIn || !clockOut) return 0;
  const [ih, im] = clockIn.split(":").map(Number);
  const [oh, om] = clockOut.split(":").map(Number);
  let mins = oh * 60 + om - (ih * 60 + im) - (breakMinutes || 0);
  if (mins < 0) mins = 0;
  return Math.round((mins / 60) * 100) / 100;
};

/** Split a total into regular (≤40) and overtime (>40). */
export const splitOvertime = (total: number) => {
  const regular = Math.min(40, total);
  const overtime = Math.max(0, total - 40);
  return { regular: round2(regular), overtime: round2(overtime) };
};

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const formatHours = (n: number) =>
  n.toFixed(2).replace(/\.00$/, ".00");
