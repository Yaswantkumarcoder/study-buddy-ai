import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { NotebookPen, CalendarRange, MessageSquare, Sparkles } from "lucide-react";

const Dashboard = () => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [stats, setStats] = useState({ notes: 0, plans: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: profile }, { count: notes }, { count: plans }] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
        supabase.from("notes").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("study_plans").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      if (profile?.display_name) setName(profile.display_name);
      setStats({ notes: notes || 0, plans: plans || 0 });
    })();
  }, [user]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning"; if (h < 18) return "Good afternoon"; return "Good evening";
  })();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{greeting},</p>
        <h1 className="text-2xl md:text-3xl font-bold">{name || "Student"} 👋</h1>
      </div>

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
