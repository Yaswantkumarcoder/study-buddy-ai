import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { content, title } = await req.json();
    if (!content || typeof content !== "string") {
      return new Response(JSON.stringify({ error: "content required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an expert study assistant. Summarize student notes clearly and extract key takeaways." },
          { role: "user", content: `Title: ${title || "Untitled"}\n\nNotes:\n${content}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_summary",
            description: "Return the summarized notes",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string", description: "A clear concise summary of the notes (2-4 short paragraphs)" },
                key_points: { type: "array", items: { type: "string" }, description: "5-8 key bullet point takeaways" },
              },
              required: ["summary", "key_points"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_summary" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded, try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await resp.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = tc ? JSON.parse(tc.function.arguments) : { summary: data.choices?.[0]?.message?.content || "", key_points: [] };
    return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
