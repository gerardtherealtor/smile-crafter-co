import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

function cmpVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(/[.-]/).map((p) => parseInt(p, 10) || 0);
  const pb = b.replace(/^v/, "").split(/[.-]/).map((p) => parseInt(p, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

const DISMISS_KEY = "dnc-update-dismissed-version";

export const UpdateAvailableBanner = () => {
  const [latest, setLatest] = useState<string | null>(null);
  const [updateUrl, setUpdateUrl] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!Capacitor.isNativePlatform()) return;
        const info = await App.getInfo();
        const installed = info.version;
        const platform = Capacitor.getPlatform();

        const { data, error } = await supabase
          .from("app_release_config")
          .select("latest_version, ios_update_url, android_update_url")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error || !data || cancelled) return;

        if (cmpVersions(installed, data.latest_version) >= 0) return;

        const dismissed = localStorage.getItem(DISMISS_KEY);
        if (dismissed === data.latest_version) return;

        setLatest(data.latest_version);
        setUpdateUrl(platform === "ios" ? data.ios_update_url : data.android_update_url);
        setVisible(true);
      } catch {
        // silently ignore — never block app
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible || !latest) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, latest);
    setVisible(false);
  };

  const handleUpdate = () => {
    if (updateUrl) window.open(updateUrl, "_blank");
  };

  return (
    <div
      className="fixed top-0 inset-x-0 z-[100] bg-maple text-maple-foreground border-b border-maple-deep shadow-lg"
      style={{ paddingTop: "max(env(safe-area-inset-top), 0px)" }}
      role="alert"
    >
      <div className="container flex items-center justify-between gap-3 py-2.5">
        <p className="text-sm font-medium flex-1 min-w-0">
          A new version of the app is available
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            onClick={handleUpdate}
            size="sm"
            variant="outline"
            className="border-maple-foreground/40 bg-maple-foreground/10 text-maple-foreground hover:bg-maple-foreground/20 font-display tracking-wider h-8"
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Update
          </Button>
          <Button
            onClick={handleDismiss}
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-maple-foreground hover:bg-maple-foreground/10"
            aria-label="Dismiss update banner"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
