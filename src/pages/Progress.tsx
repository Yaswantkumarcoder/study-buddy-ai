import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, BarChart3, Trophy, Target, Sparkles, Loader2, TrendingUp, TrendingDown, Trash2, GraduationCap } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid, ReferenceLine } from "recharts";
import { toast } from "sonner";

const verdictStyles: Record<string, { bg: string; label: string; emoji: string }> = {
  excellent: { bg: "from-emerald-500 to-teal-500", label: "Excellent performance", emoji: "🏆" },
  good: { bg: "from-cyan-500 to-blue-500", label: "Good performance", emoji: "✨" },
  okay: { bg: "from-amber-500 to-orange-500", label: "Okay, room to grow", emoji: "💪" },
  needs_work: { bg: "from-rose-500 to-red-500", label: "Needs more practice", emoji: "🎯" },
  just_starting: { bg: "from-violet-500 to-fuchsia-500", label: "Just getting started", emoji: "🌱" },
};

const typeColors: Record<string, string> = {
  quiz: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  test: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
  exam: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
};

type TestRow = {
  id: string;
  subject: string;
  test_type: string;
  title: string | null;
  score: number;
  max_score: number;
  percentage: number;
  difficulty: number | null;
  taken_at: string;
};

const Progress = () => {
  const { user } = useAuth();
  const [tests, setTests] = useState<TestRow[]>([]);
  const [notesCount, setNotesCount] = useState(0);
  const [tasks, setTasks] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [testType, setTestType] = useState("quiz");
  const [title, setTitle] = useState("");
  const [score, setScore] = useState<number | "">("");
  const [maxScore, setMaxScore] = useState<number | "">(100);
  const [difficulty, setDifficulty] = useState(3);
  const [insight, setInsight] = useState<{ verdict: string; headline: string; message: string; suggestions: string[] } | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  const load = async () => {
    if (!user) return;
    const [{ data: t }, { count: nc }, { data: pt }] = await Promise.all([
      supabase.from("test_results").select("*").eq("user_id", user.id).order("taken_at", { ascending: false }),
      supabase.from("notes").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("plan_tasks").select("completed").eq("user_id", user.id),
    ]);
    setTests((t as TestRow[]) || []);
    setNotesCount(nc || 0);
    const all = pt || [];
    setTasks({ done: all.filter((x: any) => x.completed).length, total: all.length });
  };
  useEffect(() => { load(); }, [user]);

  const saveTest = async () => {
    if (!user) return;
    if (!subject.trim()) { toast.error("Subject is required"); return; }
    const s = Number(score), m = Number(maxScore);
    if (!m || m <= 0) { toast.error("Max score must be > 0"); return; }
    if (s < 0 || s > m) { toast.error("Score must be between 0 and max"); return; }
    const { error } = await supabase.from("test_results").insert({
      user_id: user.id,
      subject: subject.trim(),
      test_type: testType,
      title: title.trim() || null,
      score: s,
      max_score: m,
      difficulty,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Test result saved!");
    setOpen(false);
    setSubject(""); setTitle(""); setScore(""); setMaxScore(100); setDifficulty(3); setTestType("quiz");
    load();
  };

  const deleteTest = async (id: string) => {
    const { error } = await supabase.from("test_results").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    load();
  };

  // Stats derived from tests (newest first in `tests`)
  const totalTests = tests.length;
  const quizCount = tests.filter(t => t.test_type === "quiz").length;
  const testCount = tests.filter(t => t.test_type === "test").length;
  const examCount = tests.filter(t => t.test_type === "exam").length;
  const percents = tests.map(t => Number(t.percentage));
  const avgPercent = totalTests ? Number((percents.reduce((a, b) => a + b, 0) / totalTests).toFixed(1)) : 0;
  const bestPercent = totalTests ? Math.max(...percents) : 0;
  const worstPercent = totalTests ? Math.min(...percents) : 0;

  const recent5 = tests.slice(0, 5);
  const earlier = tests.slice(5, 15);
  const recentAvg = recent5.length ? Number((recent5.reduce((a, b) => a + Number(b.percentage), 0) / recent5.length).toFixed(1)) : 0;
  const earlierAvg = earlier.length ? Number((earlier.reduce((a, b) => a + Number(b.percentage), 0) / earlier.length).toFixed(1)) : 0;
  const trendDelta = recentAvg - earlierAvg;
  const trend = !earlier.length ? "not_enough_data" : trendDelta > 3 ? "improving" : trendDelta < -3 ? "declining" : "steady";

  // Subject averages
  const bySubjectMap: Record<string, { sum: number; count: number }> = {};
  tests.forEach(t => {
    const k = t.subject || "General";
    if (!bySubjectMap[k]) bySubjectMap[k] = { sum: 0, count: 0 };
    bySubjectMap[k].sum += Number(t.percentage);
    bySubjectMap[k].count += 1;
  });
  const bySubject = Object.entries(bySubjectMap)
    .map(([name, v]) => ({ name, avg: Number((v.sum / v.count).toFixed(1)), count: v.count }))
    .sort((a, b) => b.avg - a.avg);

  // Score over time chart data (oldest -> newest)
  const chartData = [...tests].reverse().map((t, i) => ({
    idx: i + 1,
    label: new Date(t.taken_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    percent: Number(t.percentage),
    subject: t.subject,
  }));

  const generateInsight = async () => {
    if (totalTests === 0) { toast.error("Log at least one test first"); return; }
    setInsightLoading(true);
    setInsight(null);
    try {
      const { data, error } = await supabase.functions.invoke("progress-insight", {
        body: {
          stats: {
            totalTests, quizCount, testCount, examCount,
            avgPercent, bestPercent, worstPercent,
            recentAvg, earlierAvg, trend,
            bySubject,
            recent: tests.slice(0, 10).map(t => ({
              subject: t.subject, type: t.test_type, percent: Number(t.percentage),
              date: new Date(t.taken_at).toLocaleDateString(),
            })),
            notesCount,
            tasksCompleted: tasks.done,
            tasksTotal: tasks.total,
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
          <p className="text-sm text-muted-foreground">Track your quizzes, tests & exams — see your real progress.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary hover:opacity-90"><Plus className="h-4 w-4 mr-1.5" />Log test result</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Log a quiz / test / exam</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={testType} onValueChange={setTestType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quiz">Quiz</SelectItem>
                      <SelectItem value="test">Test</SelectItem>
                      <SelectItem value="exam">Exam</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Subject *</Label><Input value={subject} onChange={(e)=>setSubject(e.target.value)} placeholder="Physics, Maths…" /></div>
              </div>
              <div className="space-y-1.5"><Label>Title (optional)</Label><Input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Chapter 5 quiz, Mid-term…" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Your score</Label><Input type="number" min={0} value={score} onChange={(e)=>setScore(e.target.value === "" ? "" : Number(e.target.value))} placeholder="78" /></div>
                <div className="space-y-1.5"><Label>Max score</Label><Input type="number" min={1} value={maxScore} onChange={(e)=>setMaxScore(e.target.value === "" ? "" : Number(e.target.value))} placeholder="100" /></div>
              </div>
              <div className="space-y-1.5"><Label>Difficulty (1-5)</Label><Input type="number" min={1} max={5} value={difficulty} onChange={(e)=>setDifficulty(parseInt(e.target.value)||3)} /></div>
              <Button onClick={saveTest} className="w-full bg-gradient-primary">Save result</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* AI text insight */}
      <Card className="p-5 bg-gradient-card border-primary/20">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${verdict?.bg || "from-violet-500 to-fuchsia-500"} flex items-center justify-center text-xl`}>
              {verdict?.emoji || "🤖"}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-primary font-semibold flex items-center gap-1.5"><Sparkles className="h-3 w-3" />AI Performance Check</p>
              <p className="font-semibold">{insight?.headline || (verdict?.label || "See how your scores are really trending")}</p>
            </div>
          </div>
          <Button onClick={generateInsight} disabled={insightLoading || totalTests === 0} variant="outline" size="sm">
            {insightLoading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Analyzing…</> : <><Sparkles className="h-4 w-4 mr-1.5" />{insight ? "Re-analyze" : "Analyze my scores"}</>}
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
            {totalTests === 0
              ? "Log at least one quiz, test or exam result and the AI will tell you exactly where you stand and what to focus on."
              : "Click to get an honest written assessment of your test performance — strengths, weaknesses, and what to revise next."}
          </p>
        )}
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4 bg-gradient-card hover-lift">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mb-2"><GraduationCap className="h-5 w-5 text-primary-foreground" /></div>
          <p className="text-xs text-muted-foreground">Tests taken</p>
          <p className="text-2xl font-bold">{totalTests}</p>
        </Card>
        <Card className="p-4 bg-gradient-card hover-lift">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mb-2"><Target className="h-5 w-5 text-primary-foreground" /></div>
          <p className="text-xs text-muted-foreground">Average</p>
          <p className="text-2xl font-bold">{avgPercent}%</p>
        </Card>
        <Card className="p-4 bg-gradient-card hover-lift">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-2"><Trophy className="h-5 w-5 text-primary-foreground" /></div>
          <p className="text-xs text-muted-foreground">Best</p>
          <p className="text-2xl font-bold">{bestPercent}%</p>
        </Card>
        <Card className="p-4 bg-gradient-card hover-lift">
          <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${trend === "improving" ? "from-emerald-500 to-teal-500" : trend === "declining" ? "from-rose-500 to-red-500" : "from-amber-500 to-orange-500"} flex items-center justify-center mb-2`}>
            {trend === "declining" ? <TrendingDown className="h-5 w-5 text-primary-foreground" /> : <TrendingUp className="h-5 w-5 text-primary-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground">Recent trend</p>
          <p className="text-2xl font-bold">{trend === "not_enough_data" ? "—" : `${trendDelta > 0 ? "+" : ""}${trendDelta.toFixed(1)}%`}</p>
        </Card>
        <Card className="p-4 bg-gradient-card hover-lift col-span-2 md:col-span-1">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-2"><BarChart3 className="h-5 w-5 text-primary-foreground" /></div>
          <p className="text-xs text-muted-foreground">Recent avg</p>
          <p className="text-2xl font-bold">{recent5.length ? `${recentAvg}%` : "—"}</p>
        </Card>
      </div>

      {/* Score trend */}
      <Card className="p-5 bg-gradient-card">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Score trend</h3>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Log your first test to see your trend.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} unit="%" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <ReferenceLine y={avgPercent} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: `avg ${avgPercent}%`, fill: "hsl(var(--muted-foreground))", fontSize: 11, position: "right" }} />
                <Line type="monotone" dataKey="percent" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Subject avg */}
      <Card className="p-5 bg-gradient-card">
        <h3 className="font-semibold mb-4">Average by subject</h3>
        {bySubject.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No subject data yet.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bySubject} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} unit="%" />
                <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={90} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Recent results list */}
      <Card className="p-5 bg-gradient-card">
        <h3 className="font-semibold mb-4">Recent results</h3>
        {tests.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Log your first quiz, test or exam to start tracking real performance.</p>
        ) : (
          <div className="space-y-2">
            {tests.slice(0, 10).map(t => {
              const p = Number(t.percentage);
              const tone = p >= 80 ? "text-emerald-500" : p >= 60 ? "text-amber-500" : "text-rose-500";
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-background/50 border border-border">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={typeColors[t.test_type] || ""}>{t.test_type}</Badge>
                      <p className="font-medium truncate">{t.title || t.subject}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.subject} · {new Date(t.taken_at).toLocaleDateString()} · {t.score}/{t.max_score}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${tone}`}>{p}%</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteTest(t.id)} aria-label="Delete"><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Progress;
