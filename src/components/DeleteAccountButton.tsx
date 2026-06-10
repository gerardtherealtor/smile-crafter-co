import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const DeleteAccountButton = () => {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const canConfirm = confirmText.trim().toUpperCase() === "DELETE" && !loading;

  const handleDelete = async () => {
    if (!canConfirm) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "delete-my-account",
        { method: "POST" },
      );
      if (error || (data && (data as any).error)) {
        throw new Error(
          (error?.message as string) ||
            (data as any)?.error ||
            t("account.deleteFailed"),
        );
      }
      try {
        await signOut();
      } catch {}
      toast.success(t("account.deleteSuccess"));
      setOpen(false);
      navigate("/auth", { replace: true });
    } catch (e) {
      toast.error((e as Error).message || t("account.deleteFailed"));
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (loading) return;
        setOpen(o);
        if (!o) setConfirmText("");
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground font-display tracking-wider"
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          {t("account.deleteButton")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>{t("account.deleteTitle")}</DialogTitle>
          <DialogDescription className="space-y-2 pt-2">
            <span className="block">{t("account.deleteBody")}</span>
            <span className="block">{t("account.typeDeleteInstr")}</span>
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={t("account.typeDeletePlaceholder")}
          disabled={loading}
          aria-label={t("account.typeDeleteInstr")}
        />
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canConfirm}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                {t("account.deleting")}
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-1.5" />
                {t("account.deleteForever")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
