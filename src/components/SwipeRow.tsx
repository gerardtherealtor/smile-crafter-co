import { useRef, useState, ReactNode, TouchEvent, useEffect } from "react";
import { Trash2, Pencil } from "lucide-react";
import { haptics } from "@/lib/haptics";

const ACTION_THRESHOLD = 80;
const MAX_TRAVEL = 140;

/**
 * Swipeable list row. Touch-only — buttons remain clickable for desktop/mouse.
 * - Swipe left  → reveal & trigger delete action (with confirm).
 * - Swipe right → reveal & trigger edit action.
 * Includes spring snap-back and haptic feedback at the threshold.
 */
export const SwipeRow = ({
  children,
  onDelete,
  onEdit,
  deleteConfirmMessage = "Delete this entry?",
  className = "",
}: {
  children: ReactNode;
  onDelete?: () => void | Promise<void>;
  onEdit?: () => void;
  deleteConfirmMessage?: string;
  className?: string;
}) => {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const locked = useRef<"h" | "v" | null>(null);
  const [dx, setDx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const passedThreshold = useRef<"left" | "right" | null>(null);

  useEffect(() => {
    if (Math.abs(dx) >= ACTION_THRESHOLD) {
      const dir = dx < 0 ? "left" : "right";
      if (passedThreshold.current !== dir) {
        passedThreshold.current = dir;
        haptics.light();
      }
    } else {
      passedThreshold.current = null;
    }
  }, [dx]);

  const reset = () => {
    setAnimating(true);
    setDx(0);
    setTimeout(() => setAnimating(false), 220);
  };

  const onTouchStart = (e: TouchEvent) => {
    if (!onDelete && !onEdit) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    locked.current = null;
    setAnimating(false);
  };

  const onTouchMove = (e: TouchEvent) => {
    if (startX.current == null || startY.current == null) return;
    const x = e.touches[0].clientX - startX.current;
    const y = e.touches[0].clientY - startY.current;
    if (!locked.current) {
      if (Math.abs(x) > 8 || Math.abs(y) > 8) {
        locked.current = Math.abs(x) > Math.abs(y) ? "h" : "v";
      }
    }
    if (locked.current !== "h") return;
    const clamped = Math.max(-MAX_TRAVEL, Math.min(MAX_TRAVEL, x));
    // Disable directions without handlers
    if (clamped < 0 && !onDelete) return;
    if (clamped > 0 && !onEdit) return;
    setDx(clamped);
  };

  const onTouchEnd = async () => {
    const movement = dx;
    startX.current = null;
    startY.current = null;
    locked.current = null;
    if (movement <= -ACTION_THRESHOLD && onDelete) {
      reset();
      // Defer slightly so the snap-back doesn't fight the confirm dialog
      setTimeout(async () => {
        const ok = window.confirm(deleteConfirmMessage);
        if (ok) {
          haptics.medium();
          await onDelete();
        }
      }, 80);
      return;
    }
    if (movement >= ACTION_THRESHOLD && onEdit) {
      reset();
      setTimeout(() => {
        haptics.medium();
        onEdit();
      }, 80);
      return;
    }
    reset();
  };

  const showLeft = dx > 0; // user pulled right → edit panel slides from left
  const showRight = dx < 0; // user pulled left → delete panel slides from right
  const intensity = Math.min(1, Math.abs(dx) / ACTION_THRESHOLD);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Action background */}
      <div className="absolute inset-0 flex items-stretch pointer-events-none">
        {showLeft && onEdit && (
          <div
            className="flex items-center justify-start pl-4 flex-1 bg-primary/15 text-primary"
            style={{ opacity: intensity }}
          >
            <Pencil className="h-5 w-5" />
            <span className="ml-2 font-display uppercase tracking-wider text-xs">Edit</span>
          </div>
        )}
        {showRight && onDelete && (
          <div
            className="ml-auto flex items-center justify-end pr-4 flex-1 bg-destructive/20 text-destructive"
            style={{ opacity: intensity }}
          >
            <span className="mr-2 font-display uppercase tracking-wider text-xs">Delete</span>
            <Trash2 className="h-5 w-5" />
          </div>
        )}
      </div>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={{
          transform: `translateX(${dx}px)`,
          transition: animating ? "transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)" : "none",
          background: "hsl(var(--card))",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeRow;
