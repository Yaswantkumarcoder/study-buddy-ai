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
Total tests/quizzes/exams taken: ${stats.totalTests}
  - Quizzes: ${stats.quizCount}
  - Tests: ${stats.testCount}
  - Exams: ${stats.examCount}
Overall average score: ${stats.avgPercent}%
Best score: ${stats.bestPercent}%
Worst score: ${stats.worstPercent}%
Recent average (last 5): ${stats.recentAvg}%
Earlier average (before that): ${stats.earlierAvg}%
Trend: ${stats.trend}
Average score per subject: ${JSON.stringify(stats.bySubject)}
Last 10 results (newest first): ${JSON.stringify(stats.recent)}
Notes created: ${stats.notesCount}
Plan tasks completed: ${stats.tasksCompleted} / ${stats.tasksTotal}
`.trim();

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a friendly, motivating academic coach. Based on a student's TEST/QUIZ/EXAM scores, give an honest written assessment: are they actually improving? Compare recent vs earlier scores, call out weak subjects vs strong ones, and give 2-3 concrete next steps (which subjects to revise, what kind of test to try next, etc). Keep it under 130 words. Warm tone, no markdown headings." },
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
                verdict: { type: "string", enum: ["excellent", "good", "okay", "needs_work", "just_starting"], description: "Overall progress verdict based on test performance" },
                headline: { type: "string", description: "One short headline (max 60 chars)" },
                message: { type: "string", description: "Warm, motivating text assessment focused on test scores (70-130 words)" },
                suggestions: { type: "array", items: { type: "string" }, description: "2-3 concrete next-step suggestions (which subject to revise, etc)" },
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
