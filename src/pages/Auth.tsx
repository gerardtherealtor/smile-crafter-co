import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, HardHat, Fingerprint } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { LanguageToggle } from "@/components/LanguageToggle";
import {
  isBiometricAvailable,
  hasSavedCredentials,
  saveCredentials,
  clearCredentials,
  verifyAndGetCredentials,
} from "@/lib/biometric";

const AuthPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, role, loading, roleLoading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [bioReady, setBioReady] = useState(false);
  const [bioSupported, setBioSupported] = useState(false);
  const [bioChecking, setBioChecking] = useState(true);
  const [bioAuthenticating, setBioAuthenticating] = useState(false);
  const [remember, setRemember] = useState(() => {
    try {
      return localStorage.getItem("dnc_ephemeral") !== "1";
    } catch {
      return true;
    }
  });

  // Localized schemas (rebuilt on each render so messages follow language switch).
  const loginSchema = z.object({
    email: z.string().trim().email(t("auth.validEmail")).max(255),
    password: z.string().min(6, t("auth.minPwd")).max(100),
  });
  const signupSchema = loginSchema.extend({
    fullName: z.string().trim().min(1, t("auth.required")).max(100),
    phone: z.string().trim().min(7, t("auth.validPhone")).max(25),
  });

  // Friendly label for the platform's biometric method.
  const bioLabel = (() => {
    if (typeof navigator === "undefined") return "Face ID / Fingerprint";
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod|Mac/i.test(ua)) return "Face ID / Touch ID";
    if (/Android/i.test(ua)) return "Fingerprint";
    return "Face ID / Fingerprint";
  })();

  useEffect(() => {
    if (loading || !user) return;
    if (roleLoading) return;
    navigate(role === "admin" ? "/admin" : "/employee", { replace: true });
  }, [user, role, loading, roleLoading, navigate]);

  useEffect(() => {
    (async () => {
      setBioChecking(true);
      const supported = await isBiometricAvailable();
      setBioSupported(supported);
      const saved = supported && (await hasSavedCredentials());
      setBioReady(saved);
      if (saved) setRemember(true);
      setBioChecking(false);
    })();
  }, []);

  const doLogin = async (email: string, password: string, persistBio: boolean) => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success(t("auth.welcomeBack"));
    try {
      if (persistBio) {
        localStorage.removeItem("dnc_ephemeral");
      } else {
        localStorage.setItem("dnc_ephemeral", "1");
      }
      sessionStorage.setItem("dnc_session_alive", "1");
    } catch {}
    if (persistBio && bioSupported) {
      await saveCredentials(email, password);
    } else if (bioSupported) {
      await clearCredentials();
    }
    return true;
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({
      email: fd.get("email"),
      password: fd.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    await doLogin(parsed.data.email, parsed.data.password, remember);
  };

  const handleBiometric = async () => {
    setBioAuthenticating(true);
    try {
      const creds = await verifyAndGetCredentials();
      if (!creds) {
        toast.error(t("auth.bioCancelled"));
        return;
      }
      await doLogin(creds.username, creds.password, false);
    } finally {
      setBioAuthenticating(false);
    }
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse({
      email: fd.get("email"),
      password: fd.get("password"),
      fullName: fd.get("fullName"),
      phone: fd.get("phone"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: parsed.data.fullName,
          phone: parsed.data.phone,
        },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("auth.accountCreated"));
      supabase.functions.invoke("notify-admins", {
        body: {
          templateName: "admin-new-signup",
          idempotencyKey: `signup-${parsed.data.email}-${Date.now()}`,
          templateData: {
            fullName: parsed.data.fullName,
            email: parsed.data.email,
            phone: parsed.data.phone,
            signupAt: new Date().toLocaleString("en-US"),
          },
        },
      }).catch(() => {});
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {t("common.back")}
          </Link>
          <LanguageToggle variant="compact" />
        </div>

        <div className="text-center mb-8">
          <div className="h-14 w-14 mx-auto rounded-xl bg-gradient-maple grid place-items-center shadow-maple mb-4">
            <HardHat className="h-7 w-7 text-maple-foreground" />
          </div>
          <h1 className="font-display text-3xl uppercase tracking-wide">{t("auth.crewPortal")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("auth.brand")}</p>
          <p className="text-xs text-muted-foreground mt-2">{t("auth.languagePrompt")}</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="login" className="font-display tracking-wider">{t("auth.signInTab")}</TabsTrigger>
            <TabsTrigger value="signup" className="font-display tracking-wider">{t("auth.signUpTab")}</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-deep">
              <div>
                <Label htmlFor="login-email">{t("auth.email")}</Label>
                <Input id="login-email" name="email" type="email" autoComplete="email" required className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="login-password">{t("auth.password")}</Label>
                <Input id="login-password" name="password" type="password" autoComplete="current-password" required className="mt-1.5" />
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer select-none rounded-md border border-border bg-background/50 p-3">
                <Checkbox
                  id="remember"
                  checked={remember}
                  onCheckedChange={(v) => setRemember(v === true)}
                  className="mt-0.5 data-[state=checked]:bg-maple data-[state=checked]:border-maple"
                />
                <span className="text-sm leading-snug">
                  <span className="font-medium">{t("auth.rememberMe")}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {bioSupported ? t("auth.rememberMeBio", { bio: bioLabel }) : `${t("auth.rememberMeHelp")}.`}
                  </span>
                </span>
              </label>
              <Button type="submit" disabled={busy || bioAuthenticating} className="w-full bg-primary hover:bg-primary/90 font-display tracking-wider">
                {busy ? t("common.signingIn") : t("common.signIn")}
              </Button>

              {bioChecking ? (
                <p className="text-xs text-center text-muted-foreground pt-1">
                  {t("auth.checkingBio", { bio: bioLabel })}
                </p>
              ) : bioReady ? (
                <>
                  <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                    <div className="relative flex justify-center text-xs uppercase tracking-wider">
                      <span className="bg-card px-2 text-muted-foreground">{t("common.or")}</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={handleBiometric}
                    disabled={busy || bioAuthenticating}
                    variant="outline"
                    className="w-full border-maple/40 bg-maple/10 text-maple hover:bg-maple hover:text-maple-foreground font-display tracking-wider"
                  >
                    <Fingerprint className={`h-4 w-4 mr-2 ${bioAuthenticating ? "animate-pulse" : ""}`} />
                    {bioAuthenticating
                      ? t("auth.bioAuthenticating", { bio: bioLabel })
                      : busy
                        ? t("common.signingIn")
                        : t("auth.bioSignIn", { bio: bioLabel })}
                  </Button>
                  <p className="text-[11px] text-center text-muted-foreground">
                    {t("auth.bioReadyHelp")}
                  </p>
                </>
              ) : bioSupported ? (
                <p className="text-xs text-center text-muted-foreground pt-1">
                  {t("auth.bioNotReady", { bio: bioLabel })}
                </p>
              ) : null}
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-deep">
              <div>
                <Label htmlFor="su-name">{t("auth.fullName")}</Label>
                <Input id="su-name" name="fullName" required className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="su-phone">{t("auth.phone")}</Label>
                <Input id="su-phone" name="phone" type="tel" autoComplete="tel" required className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="su-email">{t("auth.email")}</Label>
                <Input id="su-email" name="email" type="email" autoComplete="email" required className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="su-password">{t("auth.password")}</Label>
                <Input id="su-password" name="password" type="password" autoComplete="new-password" required className="mt-1.5" />
                <p className="text-xs text-muted-foreground mt-1">{t("auth.passwordHint")}</p>
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-maple text-maple-foreground hover:bg-maple/90 font-display tracking-wider">
                {busy ? t("auth.creatingAccount") : t("auth.createAccount")}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AuthPage;
