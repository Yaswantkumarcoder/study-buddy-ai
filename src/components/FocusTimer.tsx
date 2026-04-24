import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, Pause, RotateCcw, Timer, BellRing } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PRESETS = [15, 25, 45, 60];

export const FocusTimer = () => {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState(25); // minutes
  const [remaining, setRemaining] = useState(25 * 60); // seconds
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const audioRef = useRef<{ ctx: AudioContext | null }>({ ctx: null });

  // Reset remaining when duration changes (only while not running)
  useEffect(() => {
    if (!running) setRemaining(duration * 60);
  }, [duration, running]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = window.setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) {
          window.clearInterval(intervalRef.current!);
          handleComplete();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const playAlarm = () => {
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      const ctx: AudioContext = audioRef.current.ctx || new Ctx();
      audioRef.current.ctx = ctx;
      const now = ctx.currentTime;
      // 3 short beeps
      [0, 0.5, 1].forEach((t) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, now + t);
        gain.gain.setValueAtTime(0.0001, now + t);
        gain.gain.exponentialRampToValueAtTime(0.4, now + t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + t);
        osc.stop(now + t + 0.4);
      });
    } catch {
      // ignore audio errors
    }
  };

  const handleComplete = async () => {
    setRunning(false);
    playAlarm();
    if ("Notification" in window && Notification.permission === "granted") {
      try { new Notification("Focus session complete! 🎉", { body: `${duration} minutes done${subject ? ` · ${subject}` : ""}` }); } catch {}
    }
    toast.success(`Focus session complete · ${duration} min`, { duration: 6000 });

    if (user) {
      await supabase.from("study_sessions").insert({
        user_id: user.id,
        duration_minutes: duration,
        subject: subject.trim() || null,
      });
    }
  };

  const start = async () => {
    if (remaining === 0) setRemaining(duration * 60);
    if ("Notification" in window && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch {}
    }
    // Resume audio context on user gesture
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      audioRef.current.ctx = audioRef.current.ctx || new Ctx();
      if (audioRef.current.ctx.state === "suspended") await audioRef.current.ctx.resume();
    } catch {}
    setRunning(true);
  };
  const pause = () => setRunning(false);
  const reset = () => { setRunning(false); setRemaining(duration * 60); };

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const total = duration * 60;
  const pct = total > 0 ? ((total - remaining) / total) * 100 : 0;

  return (
    <Card className="p-5 bg-gradient-card">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-9 w-9 rounded-xl bg-gradient-soft flex items-center justify-center">
          <Timer className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Focus timer</h3>
          <p className="text-xs text-muted-foreground">Pick a duration, study deep, alarm rings when done.</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-center">
        {/* Timer display */}
        <div className="text-center">
          <div className="text-5xl md:text-6xl font-bold tabular-nums gradient-text">
            {mm}:{ss}
          </div>
          <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-3 flex justify-center gap-2">
            {!running ? (
              <Button onClick={start} className="bg-gradient-primary hover:opacity-90">
                <Play className="h-4 w-4 mr-1.5" />Start
              </Button>
            ) : (
              <Button onClick={pause} variant="secondary">
                <Pause className="h-4 w-4 mr-1.5" />Pause
              </Button>
            )}
            <Button onClick={reset} variant="outline">
              <RotateCcw className="h-4 w-4 mr-1.5" />Reset
            </Button>
          </div>
        </div>

        {/* Settings */}
        <div className="space-y-3 sm:w-56">
          <div className="space-y-1.5">
            <Label className="text-xs">Subject (optional)</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Calculus" disabled={running} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Duration (minutes)</Label>
            <Input
              type="number"
              min={1}
              max={240}
              value={duration}
              onChange={(e) => setDuration(Math.max(1, Math.min(240, parseInt(e.target.value) || 1)))}
              disabled={running}
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={running}
                  onClick={() => setDuration(m)}
                  className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                    duration === m ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"
                  } disabled:opacity-50`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <BellRing className="h-3 w-3" /> Alarm + saved to your sessions.
          </p>
        </div>
      </div>
    </Card>
  );
};
