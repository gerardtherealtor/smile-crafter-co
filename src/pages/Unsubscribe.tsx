import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MailX, CheckCircle2, AlertCircle } from "lucide-react";
import logo from "@/assets/logo.png";

type State = "loading" | "ready" | "already" | "invalid" | "submitting" | "done" | "error";

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const validate = async () => {
      if (!token) { setState("invalid"); return; }
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`;
        const res = await fetch(url, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        const json = await res.json();
        if (!res.ok) { setState("invalid"); setErrorMsg(json.error || "Invalid link"); return; }
        if (json.valid === false && json.reason === "already_unsubscribed") { setState("already"); return; }
        setState("ready");
      } catch (e) {
        setState("invalid");
        setErrorMsg((e as Error).message);
      }
    };
    validate();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState("submitting");
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });
    if (error) {
      setState("error");
      setErrorMsg(error.message);
      return;
    }
    if (data?.success === false && data?.reason === "already_unsubscribed") {
      setState("already");
      return;
    }
    setState("done");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-deep text-center">
        <img src={logo} alt="Dwayne Noe Construction" className="h-16 w-auto mx-auto [filter:brightness(0)_invert(1)] mb-6" />

        {state === "loading" && (
          <>
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-maple mb-3" />
            <p className="text-muted-foreground">Checking your link…</p>
          </>
        )}

        {state === "ready" && (
          <>
            <MailX className="h-10 w-10 mx-auto text-maple mb-3" />
            <h1 className="font-display text-2xl uppercase tracking-wide mb-2">Unsubscribe</h1>
            <p className="text-muted-foreground mb-6">
              Stop receiving notifications from Dwayne Noe Construction at this address?
            </p>
            <Button onClick={confirm} className="bg-maple text-maple-foreground hover:bg-maple/90 font-display tracking-wider w-full">
              Confirm Unsubscribe
            </Button>
          </>
        )}

        {state === "submitting" && (
          <>
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-maple mb-3" />
            <p className="text-muted-foreground">Processing…</p>
          </>
        )}

        {state === "done" && (
          <>
            <CheckCircle2 className="h-10 w-10 mx-auto text-maple mb-3" />
            <h1 className="font-display text-2xl uppercase tracking-wide mb-2">You're Unsubscribed</h1>
            <p className="text-muted-foreground">You won't receive any more notifications at this address.</p>
          </>
        )}

        {state === "already" && (
          <>
            <CheckCircle2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h1 className="font-display text-2xl uppercase tracking-wide mb-2">Already Unsubscribed</h1>
            <p className="text-muted-foreground">This address has already been removed.</p>
          </>
        )}

        {(state === "invalid" || state === "error") && (
          <>
            <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
            <h1 className="font-display text-2xl uppercase tracking-wide mb-2">Link Invalid</h1>
            <p className="text-muted-foreground">{errorMsg || "This unsubscribe link is invalid or expired."}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
