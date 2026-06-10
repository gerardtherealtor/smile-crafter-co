import { useEffect } from "react";

/**
 * Animated checkmark overlay shown briefly after a successful submit.
 * Auto-dismisses after ~1.2s.
 */
export const SuccessCheck = ({
  show,
  onDone,
  label,
}: {
  show: boolean;
  onDone: () => void;
  label?: string;
}) => {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onDone, 1200);
    return () => clearTimeout(t);
  }, [show, onDone]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/40 backdrop-blur-sm animate-fade-in"
      onClick={onDone}
      role="status"
      aria-live="polite"
    >
      <div className="success-pop flex flex-col items-center gap-3 rounded-2xl bg-card border border-border px-8 py-7 shadow-deep">
        <svg
          className="success-check"
          xmlns="http://www.w3.org/2000/svg"
          width="84"
          height="84"
          viewBox="0 0 52 52"
        >
          <circle
            className="success-check__circle"
            cx="26"
            cy="26"
            r="24"
            fill="none"
            stroke="hsl(var(--maple))"
            strokeWidth="3"
          />
          <path
            className="success-check__path"
            d="M14 27 l8 8 l16 -18"
            fill="none"
            stroke="hsl(var(--maple))"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {label && (
          <p className="font-display uppercase tracking-wider text-sm text-foreground">
            {label}
          </p>
        )}
      </div>
    </div>
  );
};

export default SuccessCheck;
