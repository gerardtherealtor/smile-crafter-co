import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Info } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";


// Web fallback version — bump when shipping web changes.
const WEB_APP_VERSION = "1.0.4";

type VersionInfo = {
  label: string; // e.g. "1.0.4 (build 12)" or "1.0.4 (web)"
};

async function readVersionInfo(): Promise<VersionInfo> {
  try {
    if (Capacitor?.isNativePlatform?.()) {
      const info = await App.getInfo();
      const version = info?.version ?? "unknown";
      const build = info?.build ?? "?";
      return { label: `${version} (build ${build})` };
    }
  } catch {
    // fall through to web fallback
  }
  return { label: `${WEB_APP_VERSION} (web)` };
}

export const SettingsSheet = ({
  open,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) => {
  const [version, setVersion] = useState<string>("Loading…");
  const platform =
    typeof Capacitor !== "undefined" && Capacitor?.getPlatform
      ? Capacitor.getPlatform()
      : "web";

  useEffect(() => {
    let cancelled = false;
    readVersionInfo().then((info) => {
      if (!cancelled) setVersion(info.label);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>

      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-display tracking-wider uppercase">
            Settings
          </SheetTitle>
          <SheetDescription>
            Manage your account and view app information.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-6 space-y-8">
          <section>
            <h3 className="font-display tracking-wider uppercase text-sm text-muted-foreground mb-3 flex items-center gap-2">
              <Info className="h-4 w-4" /> About
            </h3>
            <div className="rounded-lg border border-border bg-card p-4 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">App</span>
                <span className="font-medium">Dwayne Noe Construction</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Version</span>
                <span className="font-medium" data-testid="app-version">
                  {version}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Platform</span>
                <span className="font-medium capitalize">{platform}</span>
              </div>
            </div>
          </section>
        </div>

        <div className="border-t border-border pt-4 mt-auto">
          <h3 className="font-display tracking-wider uppercase text-sm text-muted-foreground mb-3">
            Danger Zone
          </h3>
          <DeleteAccountButton />
        </div>
      </SheetContent>
    </Sheet>
  );
};
