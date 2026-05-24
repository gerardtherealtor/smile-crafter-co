import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LifeBuoy, Loader2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export const SupportTicketButton = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [area, setArea] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const reset = () => {
    setArea("");
    setDescription("");
    setFile(null);
  };

  const onPick = (f: File | null) => {
    if (!f) return setFile(null);
    if (!f.type.startsWith("image/")) {
      toast.error(t("support.imagesOnly"));
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error(t("support.tooLarge"));
      return;
    }
    setFile(f);
  };

  const onSubmit = async () => {
    if (!user) {
      toast.error(t("support.mustSignIn"));
      return;
    }
    const desc = description.trim();
    if (desc.length < 5) {
      toast.error(t("support.describeMore"));
      return;
    }
    setSubmitting(true);
    try {
      let screenshotPath: string | null = null;

      if (file) {
        const ext = (file.name.split(".").pop() || "png").toLowerCase().slice(0, 8);
        const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("support-screenshots")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        screenshotPath = path;
      }

      const userName =
        (user.user_metadata as any)?.full_name || user.email?.split("@")[0] || null;

      const { error: insertErr } = await supabase.from("support_tickets").insert({
        user_id: user.id,
        user_email: user.email,
        user_name: userName,
        description: desc,
        function_area: area.trim() || null,
        screenshot_path: screenshotPath,
      });
      if (insertErr) throw insertErr;

      let screenshotUrl: string | undefined;
      if (screenshotPath) {
        const { data: signed } = await supabase.storage
          .from("support-screenshots")
          .createSignedUrl(screenshotPath, 60 * 60 * 24 * 30); // 30 days
        screenshotUrl = signed?.signedUrl;
      }

      // If submitting in Spanish, translate to English for the admin email.
      const { i18n } = await import("@/i18n");
      let descForAdmin = desc;
      let areaForAdmin = area.trim() || null;
      if (i18n.language?.startsWith("es")) {
        try {
          const { data: tDesc } = await supabase.functions.invoke("translate-text", {
            body: { text: desc },
          });
          if (tDesc?.translated) descForAdmin = tDesc.translated;
          if (areaForAdmin) {
            const { data: tArea } = await supabase.functions.invoke("translate-text", {
              body: { text: areaForAdmin },
            });
            if (tArea?.translated) areaForAdmin = tArea.translated;
          }
        } catch {
          // Fall back to original text if translation fails.
        }
      }

      // Fire-and-forget email to admins.
      supabase.functions
        .invoke("notify-admins", {
          body: {
            templateName: "admin-support-ticket",
            idempotencyKey: `support-${user.id}-${Date.now()}`,
            templateData: {
              userName,
              userEmail: user.email,
              functionArea: areaForAdmin,
              description: descForAdmin,
              screenshotUrl,
              submittedAt: new Date().toLocaleString(),
            },
          },
        })
        .catch(() => {});

      toast.success(t("support.sent"));
      reset();
      setOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || t("support.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("support.openLabel")}
        className="fixed z-40 bottom-5 right-5 sm:bottom-6 sm:right-6 inline-flex items-center gap-2 rounded-full bg-maple text-maple-foreground shadow-lg shadow-maple/30 px-4 py-3 font-display tracking-wider uppercase text-sm hover:scale-105 active:scale-95 transition-transform"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
      >
        <LifeBuoy className="h-5 w-5" />
        <span className="hidden sm:inline">{t("support.button")}</span>
      </button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider uppercase">
              {t("support.title")}
            </DialogTitle>
            <DialogDescription>{t("support.subtitle")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="support-area">{t("support.areaLabel")}</Label>
              <Input
                id="support-area"
                value={area}
                onChange={(e) => setArea(e.target.value.slice(0, 80))}
                placeholder={t("support.areaPlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="support-desc">{t("support.descLabel")}</Label>
              <Textarea
                id="support-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
                placeholder={t("support.descPlaceholder")}
                rows={5}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("support.screenshotLabel")}</Label>
              {file ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={t("common.remove")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer rounded-md border border-dashed border-border bg-muted/30 px-3 py-3 text-sm text-muted-foreground hover:bg-muted/50">
                  <Upload className="h-4 w-4" />
                  <span>{t("support.screenshotHint")}</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => onPick(e.target.files?.[0] || null)}
                  />
                </label>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              {t("common.cancel")}
            </Button>
            <Button onClick={onSubmit} disabled={submitting}>
              {submitting ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> {t("support.sending")}</>
              ) : (
                t("support.send")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SupportTicketButton;
