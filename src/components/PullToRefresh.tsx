import { useRef, useState, ReactNode, TouchEvent } from "react";
import { Loader2, ArrowDown } from "lucide-react";
import { haptics } from "@/lib/haptics";

const THRESHOLD = 70;
const MAX_PULL = 110;

/**
 * Native-feeling pull-to-refresh wrapper. Only engages when the container is
 * scrolled to the top, so it never fights normal scrolling.
 */
export const PullToRefresh = ({
  onRefresh,
  children,
  className = "",
}: {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  className?: string;
}) => {
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const armed = useRef(false);

  const atTop = () => {
    // Find nearest scrollable ancestor: use window scroll.
    return (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
  };

  const onTouchStart = (e: TouchEvent) => {
    if (refreshing) return;
    if (!atTop()) return;
    startY.current = e.touches[0].clientY;
    armed.current = true;
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!armed.current || startY.current == null || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) {
      setPull(0);
      return;
    }
    // Rubber-band
    const eased = Math.min(MAX_PULL, dy * 0.55);
    setPull(eased);
  };

  const onTouchEnd = async () => {
    if (!armed.current) return;
    armed.current = false;
    startY.current = null;
    if (pull >= THRESHOLD) {
      setRefreshing(true);
      haptics.medium();
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  };

  const indicatorOpacity = Math.min(1, pull / THRESHOLD);
  const ready = pull >= THRESHOLD;

  return (
    <div
      className={className}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div
        className="flex items-center justify-center overflow-hidden text-muted-foreground transition-[height] duration-150"
        style={{ height: refreshing ? 44 : pull, opacity: refreshing ? 1 : indicatorOpacity }}
        aria-hidden={!refreshing && pull === 0}
      >
        {refreshing ? (
          <Loader2 className="h-5 w-5 animate-spin text-maple" />
        ) : (
          <ArrowDown
            className={`h-5 w-5 transition-transform duration-150 ${ready ? "rotate-180 text-maple" : ""}`}
          />
        )}
      </div>
      <div
        style={{ transform: refreshing ? "translateY(0)" : `translateY(${pull * 0.2}px)`, transition: armed.current ? "none" : "transform 200ms ease-out" }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
