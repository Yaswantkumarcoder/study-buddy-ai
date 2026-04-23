import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { NotebookPen, CalendarRange, MessageSquare, Flame, Clock, Target, TrendingUp, Sparkles } from "lucide-react";

const Dashboard = () => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [stats, setStats] = useState({ notes: 0, plans: 0, todayMin: 0, weekMin: 0, goalMin: 60, streak: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: profile }, { count: notes }, { count: plans }, { data: sessions }] = await Promise.all([
        supabase.from("profiles").select("display_name,daily_goal_minutes").eq("user_id", user.id).maybeSingle(),
        supabase.from("notes").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("study_plans").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("study_sessions").select("duration_minutes,studied_at").eq("user_id", user.id).order("studied_at", { ascending: false }).limit(60),
      ]);
      if (profile?.display_name) setName(profile.display_name);
      const goalMin = profile?.daily_goal_minutes ?? 60;
      const today = new Date(); today.setHours(0,0,0,0);
      const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 6);
      let todayMin = 0, weekMin = 0;
      const days = new Set<string>();
      (sessions || []).forEach(s => {
        const d = new Date(s.studied_at); const day = d.toDateString();
        if (d >= today) todayMin += s.duration_minutes;
        if (d >= weekAgo) weekMin += s.duration_minutes;
        days.add(day);
      });
      // streak: count back consecutive days with >=1 session
      let streak = 0;
      const dayKeys = new Set(Array.from(days));
      for (let i = 0; i < 365; i++) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        if (dayKeys.has(d.toDateString())) streak++; else if (i > 0) break;
      }
      setStats({ notes: notes || 0, plans: plans || 0, todayMin, weekMin, goalMin, streak });
    })();
  }, [user]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning"; if (h < 18) return "Good afternoon"; return "Good evening";
  })();

  const goalPct = Math.min(100, Math.round((stats.todayMin / Math.max(1, stats.goalMin)) * 100));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{greeting},</p>
        <h1 className="text-2xl md:text-3xl font-bold">{name || "Student"} 👋</h1>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Flame} label="Day streak" value={`${stats.streak}`} accent="from-orange-500 to-red-500" />
        <StatCard icon={Clock} label="Today" value={`${stats.todayMin}m`} accent="from-violet-500 to-fuchsia-500" />
        <StatCard icon={TrendingUp} label="This week" value={`${stats.weekMin}m`} accent="from-cyan-500 to-blue-500" />
        <StatCard icon={Target} label="Daily goal" value={`${stats.goalMin}m`} accent="from-emerald-500 to-teal-500" />
      </div>

      <Card className="p-6 bg-gradient-card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium">Today's goal progress</p>
            <p className="text-xs text-muted-foreground">{stats.todayMin} / {stats.goalMin} min</p>
          </div>
          <span className="text-2xl font-bold gradient-text">{goalPct}%</span>
        </div>
        <Progress value={goalPct} className="h-2" />
      </Card>

      {/* Quick actions */}
      <div>
        <h2 className="font-semibold mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Quick actions</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ActionCard to="/app/notes" icon={NotebookPen} title="Summarize notes" desc={`${stats.notes} notes`} />
          <ActionCard to="/app/planner" icon={CalendarRange} title="New study plan" desc={`${stats.plans} plans`} />
          <ActionCard to="/app/chat" icon={MessageSquare} title="Ask the AI tutor" desc="Get unstuck instantly" />
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, accent }: any) => (
  <Card className="p-4 hover-lift bg-gradient-card">
    <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center mb-3`}>
      <Icon className="h-5 w-5 text-white" />
    </div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-2xl font-bold">{value}</p>
  </Card>
);

const ActionCard = ({ to, icon: Icon, title, desc }: any) => (
  <Link to={to}>
    <Card className="p-5 hover-lift bg-gradient-card h-full">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-soft flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
      </div>
    </Card>
  </Link>
);

export default Dashboard;
