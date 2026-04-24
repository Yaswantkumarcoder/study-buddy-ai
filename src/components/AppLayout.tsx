import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, NotebookPen, CalendarRange, MessageSquare, LogOut, GraduationCap, BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const nav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/notes", label: "Notes", icon: NotebookPen },
  { to: "/app/planner", label: "Planner", icon: CalendarRange },
  { to: "/app/progress", label: "Progress", icon: BarChart3 },
  { to: "/app/chat", label: "AI Tutor", icon: MessageSquare },
];

export const AppLayout = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name,avatar_url").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data?.display_name) setName(data.display_name);
    });
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-border bg-sidebar">
        <div className="p-6 flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg gradient-text">Oneprep</span>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-gradient-primary text-primary-foreground shadow-soft"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{name || user?.email?.split("@")[0]}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <GraduationCap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold gradient-text">Oneprep</span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <main className="md:ml-64 pb-20 md:pb-0">
        <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur-xl">
        <div className="grid grid-cols-5">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center py-2 gap-1 text-xs",
                  isActive ? "text-primary" : "text-muted-foreground"
                )
              }
            >
              <item.icon className="h-5 w-5" />
              <span className="truncate text-[10px]">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};
