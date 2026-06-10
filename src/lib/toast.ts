// Wrapped sonner toast that fires haptics on success/error.
// Drop-in: `import { toast } from "sonner"` keeps working, but new code
// can also `import { toast } from "@/lib/toast"`.
import { toast as sonnerToast } from "sonner";
import { haptics } from "@/lib/haptics";

type ToastFn = typeof sonnerToast;

let patched = false;
export const installToastHaptics = () => {
  if (patched) return;
  patched = true;
  const orig: any = sonnerToast as any;
  const wrap = (key: "success" | "error" | "warning", fire: () => void) => {
    const fn = orig[key];
    if (typeof fn !== "function" || fn.__hapticsWrapped) return;
    const wrapped = function (...args: any[]) {
      try { fire(); } catch { /* noop */ }
      return fn.apply(orig, args);
    };
    (wrapped as any).__hapticsWrapped = true;
    orig[key] = wrapped;
  };
  wrap("success", haptics.success);
  wrap("error", haptics.error);
  wrap("warning", haptics.warning);
};

export const toast: ToastFn = sonnerToast;
