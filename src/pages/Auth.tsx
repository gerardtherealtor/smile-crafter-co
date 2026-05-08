import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, HardHat } from "lucide-react";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Min 6 characters").max(100),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(1, "Required").max(100),
  phone: z.string().trim().min(7, "Enter a valid phone").max(25),
});

const AuthPage = () => {
  const navigate = useNavigate();
  const { user, role, loading, roleLoading } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    // If role lookup is still pending, wait. Otherwise navigate — default to employee.
    if (roleLoading) return;
    navigate(role === "admin" ? "/admin" : "/employee", { replace: true });
  }, [user, role, loading, roleLoading, navigate]);

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
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Welcome back");
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
      toast.success("Account created! Signing you in…");
      // Notify admins (fire-and-forget; never block the user)
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
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="text-center mb-8">
          <div className="h-14 w-14 mx-auto rounded-xl bg-gradient-maple grid place-items-center shadow-maple mb-4">
            <HardHat className="h-7 w-7 text-maple-foreground" />
          </div>
          <h1 className="font-display text-3xl uppercase tracking-wide">Crew Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">Dwayne Noe Construction</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="login" className="font-display tracking-wider">Sign In</TabsTrigger>
            <TabsTrigger value="signup" className="font-display tracking-wider">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-deep">
              <div>
                <Label htmlFor="login-email">Email</Label>
                <Input id="login-email" name="email" type="email" autoComplete="email" required className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="login-password">Password</Label>
                <Input id="login-password" name="password" type="password" autoComplete="current-password" required className="mt-1.5" />
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-primary hover:bg-primary/90 font-display tracking-wider">
                {busy ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-deep">
              <div>
                <Label htmlFor="su-name">Full Name</Label>
                <Input id="su-name" name="fullName" required className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="su-phone">Phone</Label>
                <Input id="su-phone" name="phone" type="tel" autoComplete="tel" required className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="su-email">Email</Label>
                <Input id="su-email" name="email" type="email" autoComplete="email" required className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="su-password">Password</Label>
                <Input id="su-password" name="password" type="password" autoComplete="new-password" required className="mt-1.5" />
                <p className="text-xs text-muted-foreground mt-1">At least 6 characters.</p>
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-maple text-maple-foreground hover:bg-maple/90 font-display tracking-wider">
                {busy ? "Creating account…" : "Create Account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AuthPage;
