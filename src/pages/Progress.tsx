import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, BarChart3, Clock, Target } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from "recharts";
import { toast } from "sonner";

const Progress = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState(30);
  const [focus, setFocus] = useState(7);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("study_sessions").select("*").eq("user_id", user.id).order("studied_at", { ascending: false });
    setSessions(data || []);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Performance</h1>
          <p className="text-sm text-muted-foreground">Track your study habits and focus over time.</p>
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

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 bg-gradient-card hover-lift">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mb-2"><Clock className="h-5 w-5 text-white" /></div>
          <p className="text-xs text-muted-foreground">Total minutes</p>
          <p className="text-2xl font-bold">{totalMin}</p>
        </Card>
        <Card className="p-4 bg-gradient-card hover-lift">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mb-2"><BarChart3 className="h-5 w-5 text-white" /></div>
          <p className="text-xs text-muted-foreground">Sessions</p>
          <p className="text-2xl font-bold">{sessions.length}</p>
        </Card>
        <Card className="p-4 bg-gradient-card hover-lift">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-2"><Target className="h-5 w-5 text-white" /></div>
          <p className="text-xs text-muted-foreground">Avg focus</p>
          <p className="text-2xl font-bold">{avgFocus}</p>
        </Card>
      </div>

      <Card className="p-5 bg-gradient-card">
        <h3 className="font-semibold mb-4">Last 14 days</h3>
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
          <p className="text-sm text-muted-foreground text-center py-8">Log a session to see your breakdown.</p>
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
