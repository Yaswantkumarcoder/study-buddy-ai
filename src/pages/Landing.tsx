import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, Sparkles, NotebookPen, CalendarRange, BarChart3, MessageSquare, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const features = [
  { icon: NotebookPen, title: "AI Notes Summarizer", desc: "Paste your notes and get clear summaries with key takeaways in seconds." },
  { icon: CalendarRange, title: "Smart Study Planner", desc: "Tell us your goal and we'll generate a day-by-day plan tailored to you." },
  { icon: BarChart3, title: "Progress Dashboard", desc: "Track study time, streaks and focus across subjects with beautiful charts." },
  { icon: MessageSquare, title: "AI Tutor Chat", desc: "Stuck? Chat with an AI tutor that explains concepts step-by-step." },
];

const Landing = () => {
  const { user } = useAuth();
  const cta = user ? "/app" : "/auth";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg gradient-text">StudyMind</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="bg-gradient-primary hover:opacity-90">
              <Link to={cta}>Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-1/4 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute top-40 right-1/4 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        </div>
        <div className="max-w-6xl mx-auto px-4 py-20 md:py-32 text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            Powered by AI · Free to start
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
            Study smarter with your <br className="hidden md:block" />
            <span className="gradient-text">personal AI companion</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Summarize notes, build study plans, track your progress, and get unstuck with an AI tutor — all in one beautifully simple app.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-gradient-primary hover:opacity-90 shadow-glow">
              <Link to={cta}>
                Start studying free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-success" /> No credit card required
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Everything you need to ace your studies</h2>
          <p className="text-muted-foreground">Four powerful tools that work together.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f) => (
            <div key={f.title} className="hover-lift p-6 rounded-2xl bg-gradient-card border border-border">
              <div className="h-11 w-11 rounded-xl bg-gradient-soft flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 pb-24">
        <div className="rounded-3xl bg-gradient-hero p-10 md:p-16 text-center text-primary-foreground shadow-elevated">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to level up your learning?</h2>
          <p className="opacity-90 mb-8 max-w-xl mx-auto">Join students using StudyMind to study less and learn more.</p>
          <Button asChild size="lg" variant="secondary" className="hover:scale-105 transition-transform">
            <Link to={cta}>Get started — it's free</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} StudyMind. Built with ❤️ for students.
      </footer>
    </div>
  );
};

export default Landing;
