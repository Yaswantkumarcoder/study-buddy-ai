import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, BarChart3, Clock, Target, Sparkles, Loader2, NotebookPen, CheckCircle2, Flame } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from "recharts";
import { toast } from "sonner";

const verdictStyles: Record<string, { bg: string; label: string; emoji: string }> = {
  excellent: { bg: "from-emerald-500 to-teal-500", label: "Excellent progress", emoji: "🚀" },
  good: { bg: "from-cyan-500 to-blue-500", label: "Good progress", emoji: "✨" },
  okay: { bg: "from-amber-500 to-orange-500", label: "Okay, keep pushing", emoji: "💪" },
  needs_work: { bg: "from-rose-500 to-red-500", label: "Needs more focus", emoji: "🎯" },
  just_starting: { bg: "from-violet-500 to-fuchsia-500", label: "Just getting started", emoji: "🌱" },
};

const Progress = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [notesCount, setNotesCount] = useState(0);
  const [plansCount, setPlansCount] = useState(0);
  const [tasks, setTasks] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [profile, setProfile] = useState<{ daily_goal_minutes: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState(30);
  const [focus, setFocus] = useState(7);
  const [insight, setInsight] = useState<{ verdict: string; headline: string; message: string; suggestions: string[] } | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  const load = async () => {
    if (!user) return;
    const [{ data: s }, { count: nc }, { count: pc }, { data: pt }, { data: prof }] = await Promise.all([
      supabase.from("study_sessions").select("*").eq("user_id", user.id).order("studied_at", { ascending: false }),
      supabase.from("notes").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("study_plans").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("plan_tasks").select("completed").eq("user_id", user.id),
      supabase.from("profiles").select("daily_goal_minutes").eq("user_id", user.id).maybeSingle(),
    ]);
    setSessions(s || []);
    setNotesCount(nc || 0);
    setPlansCount(pc || 0);
    const all = pt || [];
    setTasks({ done: all.filter((t: any) => t.completed).length, total: all.length });
    setProfile(prof as any);
  };
  useEffect(() => { load(); }, [user]);

  const log = async () => {
    if (!user) return;
    if (duration < 1) { toast.error("Duration must be > 0"); return; }
    const { error } = await supabase.from("study_sessions").insert({
      user_id: user.id, subject: subject.trim() || "General", duration_minutes: duration, focus_score: focus,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Session logged!");
    setOpen(false); setSubject(""); setDuration(30); setFocus(7);
    load();
  };

  // Build last 14 days chart data
  const days: { date: string; minutes: number; label: string }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
    days.push({ date: d.toDateString(), minutes: 0, label: d.toLocaleDateString(undefined, { weekday: "short" }) });
  }
  sessions.forEach(s => {
    const day = new Date(s.studied_at).toDateString();
    const slot = days.find(d => d.date === day);
    if (slot) slot.minutes += s.duration_minutes;
  });

  // Subject breakdown
  const bySubject: Record<string, number> = {};
  sessions.forEach(s => { bySubject[s.subject || "General"] = (bySubject[s.subject || "General"] || 0) + s.duration_minutes; });
  const subjects = Object.entries(bySubject).map(([name, minutes]) => ({ name, minutes })).sort((a,b)=>b.minutes-a.minutes).slice(0,6);

  const totalMin = sessions.reduce((a, s) => a + s.duration_minutes, 0);
  const avgFocus = sessions.length ? (sessions.reduce((a, s) => a + (s.focus_score || 0), 0) / sessions.length).toFixed(1) : "—";

  // Streak
  const dayKeys = new Set(sessions.map(s => new Date(s.studied_at).toDateString()));
  let streak = 0;
  const today = new Date(); today.setHours(0,0,0,0);
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    if (dayKeys.has(d.toDateString())) streak++; else if (i > 0) break;
  }

  const generateInsight = async () => {
    setInsightLoading(true);
    setInsight(null);
    try {
      const { data, error } = await supabase.functions.invoke("progress-insight", {
        body: {
          stats: {
            dailyMinutes: days.map(d => ({ day: d.label, minutes: d.minutes })),
            totalMinutes: totalMin,
            sessionCount: sessions.length,
            avgFocus,
            notesCount,
            plansCount,
            tasksCompleted: tasks.done,
            tasksTotal: tasks.total,
            topSubjects: subjects,
            streak,
            goalMinutes: profile?.daily_goal_minutes ?? 60,
          },
        },
      });
      if (error) {
        const status = (error as any).context?.status;
        if (status === 429) toast.error("Rate limit reached, try again shortly.");
        else if (status === 402) toast.error("AI credits exhausted. Add credits in Settings.");
        else toast.error("Couldn't generate insight");
        return;
      }
      setInsight(data);
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally { setInsightLoading(false); }
  };

  const verdict = insight ? verdictStyles[insight.verdict] || verdictStyles.okay : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Performance</h1>
          <p className="text-sm text-muted-foreground">Auto-tracked from your notes, plans & sessions.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary hover:opacity-90"><Plus className="h-4 w-4 mr-1.5" />Log session</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Log a study session</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5"><Label>Subject</Label><Input value={subject} onChange={(e)=>setSubject(e.target.value)} placeholder="Physics, History…" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Duration (min)</Label><Input type="number" min={1} max={600} value={duration} onChange={(e)=>setDuration(parseInt(e.target.value)||0)} /></div>
                <div className="space-y-1.5"><Label>Focus (1-10)</Label><Input type="number" min={1} max={10} value={focus} onChange={(e)=>setFocus(parseInt(e.target.value)||1)} /></div>
              </div>
              <Button onClick={log} className="w-full bg-gradient-primary">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* AI text-based progress insight */}
      <Card className="p-5 bg-gradient-card border-primary/20">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${verdict?.bg || "from-violet-500 to-fuchsia-500"} flex items-center justify-center text-xl`}>
              {verdict?.emoji || "🤖"}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-primary font-semibold flex items-center gap-1.5"><Sparkles className="h-3 w-3" />AI Progress Check</p>
              <p className="font-semibold">{insight?.headline || (verdict?.label || "See how you're really doing")}</p>
            </div>
          </div>
          <Button onClick={generateInsight} disabled={insightLoading} variant="outline" size="sm">
            {insightLoading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Analyzing…</> : <><Sparkles className="h-4 w-4 mr-1.5" />{insight ? "Re-analyze" : "Analyze my progress"}</>}
          </Button>
        </div>
        {insight && (
          <div className="mt-4 space-y-3">
            <p className="text-sm leading-relaxed">{insight.message}</p>
            {insight.suggestions?.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Next steps</p>
                <ul className="space-y-1.5">
                  {insight.suggestions.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm"><span className="text-primary mt-0.5">→</span><span>{s}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {!insight && !insightLoading && (
          <p className="text-sm text-muted-foreground mt-3">
            Click to get a written assessment of your study habits — strengths, weaknesses, and what to do next.
          </p>
        )}
      </Card>

      {/* Auto-tracked stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4 bg-gradient-card hover-lift">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mb-2"><Flame className="h-5 w-5 text-white" /></div>
          <p className="text-xs text-muted-foreground">Streak</p>
          <p className="text-2xl font-bold">{streak}d</p>
        </Card>
        <Card className="p-4 bg-gradient-card hover-lift">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mb-2"><Clock className="h-5 w-5 text-white" /></div>
          <p className="text-xs text-muted-foreground">Total min</p>
          <p className="text-2xl font-bold">{totalMin}</p>
        </Card>
        <Card className="p-4 bg-gradient-card hover-lift">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mb-2"><NotebookPen className="h-5 w-5 text-white" /></div>
          <p className="text-xs text-muted-foreground">Notes</p>
          <p className="text-2xl font-bold">{notesCount}</p>
        </Card>
        <Card className="p-4 bg-gradient-card hover-lift">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-2"><CheckCircle2 className="h-5 w-5 text-white" /></div>
          <p className="text-xs text-muted-foreground">Tasks done</p>
          <p className="text-2xl font-bold">{tasks.done}<span className="text-sm text-muted-foreground">/{tasks.total}</span></p>
        </Card>
        <Card className="p-4 bg-gradient-card hover-lift col-span-2 md:col-span-1">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-2"><Target className="h-5 w-5 text-white" /></div>
          <p className="text-xs text-muted-foreground">Avg focus</p>
          <p className="text-2xl font-bold">{avgFocus}</p>
        </Card>
      </div>

      <Card className="p-5 bg-gradient-card">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Last 14 days</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={days}>
              <defs>
                <linearGradient id="gradMin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              <Area type="monotone" dataKey="minutes" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gradMin)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-5 bg-gradient-card">
        <h3 className="font-semibold mb-4">Time per subject</h3>
        {subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Log a session or finish plan tasks to see your breakdown.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjects} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={80} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Progress;
