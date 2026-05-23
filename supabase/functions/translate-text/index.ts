// Translate arbitrary text to English using Lovable AI Gateway.
// Returns { translated: string }. If source is already English (or empty), returns input unchanged.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { text, sourceLang } = await req.json();
    const input = typeof text === "string" ? text.trim() : "";
    if (!input) return json({ translated: "" });
    if (sourceLang && sourceLang.toLowerCase().startsWith("en")) return json({ translated: input });

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ translated: input });

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are a translator. Translate the user's text to natural English. If it is already English, return it unchanged. Reply with ONLY the translated text, no quotes, no explanations." },
          { role: "user", content: input },
        ],
      }),
    });
    if (!res.ok) {
      console.error("translate-text gateway error", res.status, await res.text());
      return json({ translated: input });
    }
    const data = await res.json();
    const translated = (data?.choices?.[0]?.message?.content ?? "").trim() || input;
    return json({ translated });
  } catch (e) {
    console.error("translate-text error", e);
    return json({ translated: "" });
  }
});

function json(obj: unknown) {
  return new Response(JSON.stringify(obj), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
