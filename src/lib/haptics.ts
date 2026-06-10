// Safe haptics wrapper — no-ops on web / when plugin unavailable.
import { Capacitor } from "@capacitor/core";

type Impact = "light" | "medium" | "heavy";
type Notify = "success" | "warning" | "error";

let hapticsMod: typeof import("@capacitor/haptics") | null = null;
let loadPromise: Promise<void> | null = null;

const isNative = () => {
  try {
    return Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
};

const ensureLoaded = async () => {
  if (!isNative()) return;
  if (hapticsMod) return;
  if (!loadPromise) {
    loadPromise = import("@capacitor/haptics")
      .then((m) => {
        hapticsMod = m;
      })
      .catch(() => {
        hapticsMod = null;
      });
  }
  await loadPromise;
};

export const impact = (style: Impact = "light") => {
  if (!isNative()) return;
  ensureLoaded().then(() => {
    try {
      const Style = hapticsMod?.ImpactStyle;
      const map: Record<Impact, any> = {
        light: Style?.Light,
        medium: Style?.Medium,
        heavy: Style?.Heavy,
      };
      hapticsMod?.Haptics.impact({ style: map[style] }).catch(() => {});
    } catch {
      /* noop */
    }
  });
};

export const notify = (type: Notify = "success") => {
  if (!isNative()) return;
  ensureLoaded().then(() => {
    try {
      const Type = hapticsMod?.NotificationType;
      const map: Record<Notify, any> = {
        success: Type?.Success,
        warning: Type?.Warning,
        error: Type?.Error,
      };
      hapticsMod?.Haptics.notification({ type: map[type] }).catch(() => {});
    } catch {
      /* noop */
    }
  });
};

export const haptics = {
  light: () => impact("light"),
  medium: () => impact("medium"),
  heavy: () => impact("heavy"),
  success: () => notify("success"),
  warning: () => notify("warning"),
  error: () => notify("error"),
};
