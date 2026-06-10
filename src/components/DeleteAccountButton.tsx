import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
            "Failed to delete account",
        );
      }
      try {
        await signOut();
      } catch {}
      toast.success("Your account has been deleted.");
      setOpen(false);
      navigate("/auth", { replace: true });
    } catch (e) {
      toast.error(
        (e as Error).message ||
          "Could not delete your account. Please try again.",
      );
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
          Delete Account
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription className="space-y-2 pt-2">
            <span className="block">
              This will <strong>permanently delete</strong> your account and all
              of your data, including time entries, profile, support tickets,
              and role assignments. This cannot be undone.
            </span>
            <span className="block">
              Type <strong>DELETE</strong> below to confirm.
            </span>
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE"
          disabled={loading}
          aria-label="Type DELETE to confirm"
        />
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canConfirm}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-1.5" />
                Delete forever
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
