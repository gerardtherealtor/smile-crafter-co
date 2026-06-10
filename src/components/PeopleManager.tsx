import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { TableRowSkeleton } from "@/components/Skeletons";
import { toast } from "sonner";
import { Mail, Trash2, UserCheck, UserX, KeyRound, Shield, HardHat } from "lucide-react";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  is_test: boolean;
}
interface RoleRow { user_id: string; role: "admin" | "employee" | "moderator" }

export const PeopleManager = ({
  profiles, reload,
}: { profiles: Profile[]; reload: () => Promise<void> | void }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [roles, setRoles] = useState<Map<string, RoleRow["role"]>>(new Map());
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);
  const [typed, setTyped] = useState("");

  const loadRoles = async () => {
    setLoadingRoles(true);
    const { data, error } = await supabase
      .from("user_roles")
      .select("user_id,role");
    if (!error && data) {
      const m = new Map<string, RoleRow["role"]>();
      for (const r of data as RoleRow[]) m.set(r.user_id, r.role);
      setRoles(m);
    }
    setLoadingRoles(false);
  };

  useEffect(() => { loadRoles(); }, []);

  const toggleActive = async (p: Profile) => {
    setBusyId(p.id);
    // Optimistic
    const next = !p.is_active;
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: next })
      .eq("id", p.id);
    setBusyId(null);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(next ? t("people.reactivated") : t("people.deactivated"));
      await reload();
    }
  };

  const sendResetEmail = async (p: Profile) => {
    setBusyId(p.id);
    const redirectTo = `${window.location.origin}/auth`;
    const { error } = await supabase.auth.resetPasswordForEmail(p.email, { redirectTo });
    setBusyId(null);
    if (error) toast.error(error.message);
    else toast.success(t("people.resetSent", { email: p.email }));
  };

  const performDelete = async () => {
    if (!confirmDelete) return;
    if (typed.trim() !== "DELETE") {
      toast.error(t("people.typeDeleteFirst"));
      return;
    }
    setBusyId(confirmDelete.id);
    const { data, error } = await supabase.functions.invoke("admin-delete-user", {
      body: { target_user_id: confirmDelete.id },
    });
    setBusyId(null);
    if (error || (data && (data as any).error)) {
      toast.error(error?.message || (data as any)?.error || t("people.deleteFailed"));
      return;
    }
    toast.success(t("people.userDeleted"));
    setConfirmDelete(null);
    setTyped("");
    await reload();
    await loadRoles();
  };

  const sorted = useMemo(() => {
    return [...profiles].sort((a, b) => {
      if (!!a.is_test !== !!b.is_test) return a.is_test ? 1 : -1;
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      return (a.full_name || a.email).localeCompare(b.full_name || b.email);
    });
  }, [profiles]);

  return (
    <div className="rounded-xl border border-border bg-card shadow-deep overflow-hidden">
      <div className="p-4 border-b border-border">
        <h2 className="font-display text-lg uppercase tracking-wide">{t("people.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("people.subtitle")}
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("people.user")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("people.role")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("people.status")}</TableHead>
              <TableHead className="text-right">{t("people.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingRoles ? (
              <TableRowSkeleton cols={4} rows={4} />
            ) : sorted.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t("people.empty")}</TableCell></TableRow>
            ) : sorted.map((p) => {
              const role = roles.get(p.id) || "employee";
              const isSelf = user?.id === p.id;
              const busy = busyId === p.id;
              return (
                <TableRow key={p.id} className={!p.is_active ? "opacity-60" : ""}>
                  <TableCell>
                    <div className="font-medium flex items-center gap-2 flex-wrap">
                      {p.full_name || p.email}
                      {p.is_test && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                          {t("people.test")}
                        </span>
                      )}
                      {isSelf && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
                          {t("people.you")}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{p.email}</div>
                    <div className="md:hidden mt-1 flex items-center gap-1.5 text-xs">
                      {role === "admin" ? (
                        <><Shield className="h-3 w-3 text-maple" /> {t("people.admin")}</>
                      ) : (
                        <><HardHat className="h-3 w-3 text-muted-foreground" /> {t("people.employee")}</>
                      )}
                      <span className="mx-1 text-muted-foreground">·</span>
                      <span className={p.is_active ? "text-green-500" : "text-muted-foreground"}>
                        {p.is_active ? t("people.active") : t("people.inactive")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {role === "admin" ? (
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <Shield className="h-3.5 w-3.5 text-maple" /> {t("people.admin")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <HardHat className="h-3.5 w-3.5" /> {t("people.employee")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${
                      p.is_active
                        ? "border-green-500/40 bg-green-500/10 text-green-500"
                        : "border-border bg-muted text-muted-foreground"
                    }`}>
                      {p.is_active ? t("people.active") : t("people.inactive")}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        haptic="light"
                        disabled={busy}
                        onClick={() => sendResetEmail(p)}
                        title={t("people.resetTitle")}
                      >
                        <KeyRound className="h-3.5 w-3.5 sm:mr-1.5" />
                        <span className="hidden sm:inline">{t("people.reset")}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant={p.is_active ? "outline" : "secondary"}
                        haptic="medium"
                        disabled={busy || isSelf}
                        onClick={() => toggleActive(p)}
                        title={isSelf ? t("people.cantSelfStatus") : (p.is_active ? t("people.deactivate") : t("people.reactivate"))}
                      >
                        {p.is_active ? (
                          <><UserX className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">{t("people.deactivate")}</span></>
                        ) : (
                          <><UserCheck className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">{t("people.reactivate")}</span></>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        haptic="medium"
                        disabled={busy || isSelf}
                        onClick={() => { setConfirmDelete(p); setTyped(""); }}
                        title={isSelf ? t("people.cantSelfDelete") : t("people.deleteUser")}
                      >
                        <Trash2 className="h-3.5 w-3.5 sm:mr-1.5" />
                        <span className="hidden sm:inline">{t("common.delete")}</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!confirmDelete} onOpenChange={(v) => { if (!v) { setConfirmDelete(null); setTyped(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-wider text-destructive">
              {t("people.deleteTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("people.deleteBody", { email: confirmDelete?.email ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-delete">{t("people.typeDeleteLabel")}</Label>
            <Input
              id="confirm-delete"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              placeholder="DELETE"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setConfirmDelete(null); setTyped(""); }}>{t("common.cancel")}</Button>
            <Button
              variant="destructive"
              disabled={typed.trim() !== "DELETE" || busyId === confirmDelete?.id}
              onClick={performDelete}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              {busyId === confirmDelete?.id ? t("people.deleting") : t("people.deleteUser")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PeopleManager;
