import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { goal, durationDays, hoursPerDay, level } = await req.json();
    if (!goal || !durationDays) {
      return new Response(JSON.stringify({ error: "goal and durationDays required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an expert academic coach. Build realistic, day-by-day study plans tailored to the learner's goal, level, and available time." },
          { role: "user", content: `Goal: ${goal}\nDuration: ${durationDays} days\nHours per day: ${hoursPerDay || 2}\nLevel: ${level || "intermediate"}\nGenerate a structured plan.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_plan",
            description: "Return the study plan",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                overview: { type: "string", description: "Short overview of strategy" },
                days: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      day: { type: "number" },
                      topic: { type: "string" },
                      tasks: { type: "array", items: { type: "string" }, description: "3-5 concrete tasks" },
                    },
                    required: ["day", "topic", "tasks"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["title", "overview", "days"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_plan" } },
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
    if (!tc) throw new Error("No plan generated");
    const args = JSON.parse(tc.function.arguments);
    return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
