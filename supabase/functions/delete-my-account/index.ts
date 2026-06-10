import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } =
      await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Best-effort cleanup of user-owned rows. Continue even on error so we
    // never block a deletion request from succeeding for the user.
    const cleanup = async (label: string, p: Promise<any>) => {
      try {
        const { error } = await p;
        if (error) console.error(`[delete-my-account] ${label}:`, error.message);
      } catch (e) {
        console.error(`[delete-my-account] ${label} threw:`, e);
      }
    };

    await cleanup(
      "time_entries",
      admin.from("time_entries").delete().eq("user_id", userId),
    );
    await cleanup(
      "support_tickets",
      admin.from("support_tickets").delete().eq("user_id", userId),
    );
    await cleanup(
      "user_roles",
      admin.from("user_roles").delete().eq("user_id", userId),
    );
    await cleanup(
      "roster_unlink",
      admin
        .from("roster")
        .update({ linked_profile_id: null })
        .eq("linked_profile_id", userId),
    );
    await cleanup(
      "profiles",
      admin.from("profiles").delete().eq("id", userId),
    );

    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      console.error("[delete-my-account] auth delete failed:", delErr.message);
      return new Response(
        JSON.stringify({ error: delErr.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[delete-my-account] unexpected:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
