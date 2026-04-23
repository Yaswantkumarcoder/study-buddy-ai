import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Sparkles, CalendarRange, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Plan {
  id: string;
  title: string;
  goal: string;
  duration_days: number;
  hours_per_day: number;
  plan: { overview: string; days: { day: number; topic: string; tasks: string[] }[] };
  created_at: string;
}

interface Task { id: string; plan_id: string; day_index: number; task_index: number; completed: boolean }

const Planner = () => {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tasks, setTasks] = useState<Record<string, Task[]>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [goal, setGoal] = useState("");
  const [days, setDays] = useState(7);
  const [hpd, setHpd] = useState(2);
  const [level, setLevel] = useState("intermediate");
  const [active, setActive] = useState<Plan | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: p } = await supabase.from("study_plans").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    const planList = (p as any) || [];
    setPlans(planList);
    if (planList.length) {
      const { data: t } = await supabase.from("plan_tasks").select("*").in("plan_id", planList.map((x: Plan) => x.id));
      const grouped: Record<string, Task[]> = {};
      (t || []).forEach((row: any) => { (grouped[row.plan_id] ||= []).push(row); });
      setTasks(grouped);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const create = async () => {
    if (!user) return;
    if (!goal.trim()) { toast.error("Add a goal"); return; }
    setBusy(true);
    try {
      const { data: ai, error } = await supabase.functions.invoke("generate-study-plan", {
        body: { goal: goal.trim(), durationDays: days, hoursPerDay: hpd, level },
      });
      if (error) {
        const status = (error as any).context?.status;
        if (status === 429) toast.error("Rate limit reached, try again shortly.");
        else if (status === 402) toast.error("AI credits exhausted. Add credits in Settings.");
        else toast.error("Plan generation failed");
        return;
      }
      const { error: insErr } = await supabase.from("study_plans").insert({
        user_id: user.id, title: ai.title, goal: goal.trim(), duration_days: days, hours_per_day: hpd, plan: ai,
      });
      if (insErr) throw insErr;
      toast.success("Plan generated!");
      setOpen(false); setGoal("");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally { setBusy(false); }
  };

  const toggle = async (plan: Plan, dayIdx: number, taskIdx: number) => {
    if (!user) return;
    const existing = (tasks[plan.id] || []).find(t => t.day_index === dayIdx && t.task_index === taskIdx);
    const completed = !(existing?.completed);
    if (existing) {
      await supabase.from("plan_tasks").update({ completed, completed_at: completed ? new Date().toISOString() : null }).eq("id", existing.id);
    } else {
      await supabase.from("plan_tasks").insert({ plan_id: plan.id, user_id: user.id, day_index: dayIdx, task_index: taskIdx, completed, completed_at: completed ? new Date().toISOString() : null });
    }
    // Log a study session when checking off (rough estimate per task)
    if (completed) {
      const minutes = Math.round((plan.hours_per_day * 60) / Math.max(1, plan.plan.days[dayIdx]?.tasks.length || 1));
      await supabase.from("study_sessions").insert({ user_id: user.id, subject: plan.plan.days[dayIdx]?.topic || plan.title, duration_minutes: minutes });
    }
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("study_plans").delete().eq("id", id);
    if (active?.id === id) setActive(null);
    toast.success("Plan deleted");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Study Planner</h1>
          <p className="text-sm text-muted-foreground">AI-generated, day-by-day plans tailored to your goal.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary hover:opacity-90"><Plus className="h-4 w-4 mr-1.5" />New plan</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Generate a study plan</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>What do you want to learn?</Label>
                <Textarea value={goal} onChange={(e)=>setGoal(e.target.value)} placeholder="e.g. Pass my AP Calculus exam covering derivatives & integrals" rows={3} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label>Days</Label><Input type="number" min={1} max={60} value={days} onChange={(e)=>setDays(parseInt(e.target.value)||1)} /></div>
                <div className="space-y-1.5"><Label>Hours/day</Label><Input type="number" min={0.5} step={0.5} max={12} value={hpd} onChange={(e)=>setHpd(parseFloat(e.target.value)||1)} /></div>
                <div className="space-y-1.5">
                  <Label>Level</Label>
                  <select value={level} onChange={(e)=>setLevel(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
              <Button onClick={create} disabled={busy} className="w-full bg-gradient-primary hover:opacity-90">
                {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</> : <><Sparkles className="h-4 w-4 mr-2" />Generate plan</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">{[...Array(2)].map((_, i) => <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : plans.length === 0 ? (
        <Card className="p-12 text-center bg-gradient-card">
          <div className="h-16 w-16 rounded-2xl bg-gradient-soft flex items-center justify-center mx-auto mb-4">
            <CalendarRange className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-semibold text-lg mb-1">No study plans yet</h3>
          <p className="text-sm text-muted-foreground mb-5">Generate your first AI-powered study plan in seconds.</p>
          <Button onClick={() => setOpen(true)} className="bg-gradient-primary"><Plus className="h-4 w-4 mr-1.5" />Create plan</Button>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {plans.map((p) => {
            const all = p.plan.days.reduce((acc, d) => acc + d.tasks.length, 0);
            const done = (tasks[p.id] || []).filter(t => t.completed).length;
            const pct = Math.round((done / Math.max(1, all)) * 100);
            return (
              <Card key={p.id} className="p-5 hover-lift bg-gradient-card cursor-pointer" onClick={() => setActive(p)}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{p.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{p.duration_days} days · {p.hours_per_day}h/day</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={(e)=>{e.stopPropagation(); remove(p.id);}}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs mb-1.5"><span className="text-muted-foreground">{done}/{all} tasks</span><span className="font-semibold gradient-text">{pct}%</span></div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!active} onOpenChange={(o)=>!o && setActive(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{active?.title}</DialogTitle></DialogHeader>
          {active && (
            <div className="space-y-4">
              <Card className="p-4 bg-gradient-soft border-primary/20">
                <p className="text-xs uppercase tracking-wide text-primary font-semibold mb-2 flex items-center gap-1.5"><Sparkles className="h-3 w-3" />Strategy</p>
                <p className="text-sm">{active.plan.overview}</p>
              </Card>
              <div className="space-y-3">
                {active.plan.days.map((d, di) => (
                  <Card key={di} className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-8 w-8 rounded-lg bg-gradient-primary text-primary-foreground flex items-center justify-center font-bold text-sm">{d.day}</div>
                      <h4 className="font-semibold">{d.topic}</h4>
                    </div>
                    <ul className="space-y-2">
                      {d.tasks.map((task, ti) => {
                        const checked = (tasks[active.id] || []).some(t => t.day_index === di && t.task_index === ti && t.completed);
                        return (
                          <li key={ti} className="flex items-start gap-2.5">
                            <Checkbox checked={checked} onCheckedChange={() => toggle(active, di, ti)} className="mt-0.5" />
                            <span className={`text-sm ${checked ? "line-through text-muted-foreground" : ""}`}>{task}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Planner;
