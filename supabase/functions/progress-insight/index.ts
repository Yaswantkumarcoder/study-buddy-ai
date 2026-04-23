import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { stats } = await req.json();
    if (!stats) {
      return new Response(JSON.stringify({ error: "stats required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const summary = `
Last 14 days study minutes per day: ${JSON.stringify(stats.dailyMinutes)}
Total study minutes (all time): ${stats.totalMinutes}
Total sessions logged: ${stats.sessionCount}
Average focus score (1-10): ${stats.avgFocus}
Notes created: ${stats.notesCount}
Study plans created: ${stats.plansCount}
Plan tasks completed: ${stats.tasksCompleted} / ${stats.tasksTotal}
Top subjects (minutes): ${JSON.stringify(stats.topSubjects)}
Current daily streak: ${stats.streak} days
Daily goal: ${stats.goalMinutes} minutes
`.trim();

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a friendly, motivating study coach. Based on a student's stats, give an honest text-based assessment: are they progressing well or not? Be specific, point out trends, give 2-3 concrete suggestions. Keep it under 120 words. Use a warm tone, no markdown headings." },
          { role: "user", content: summary },
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_insight",
            description: "Return progress insight",
            parameters: {
              type: "object",
              properties: {
                verdict: { type: "string", enum: ["excellent", "good", "okay", "needs_work", "just_starting"], description: "Overall progress verdict" },
                headline: { type: "string", description: "One short headline (max 60 chars)" },
                message: { type: "string", description: "Warm, motivating text assessment (60-120 words)" },
                suggestions: { type: "array", items: { type: "string" }, description: "2-3 concrete next-step suggestions" },
              },
              required: ["verdict", "headline", "message", "suggestions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_insight" } },
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
    if (!tc) throw new Error("No insight generated");
    const args = JSON.parse(tc.function.arguments);
    return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
