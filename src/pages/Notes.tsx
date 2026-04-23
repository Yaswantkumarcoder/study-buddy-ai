import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Sparkles, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";

interface Note {
  id: string;
  title: string;
  content: string;
  subject: string | null;
  summary: string | null;
  key_points: string[] | null;
  created_at: string;
}

const Notes = () => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [active, setActive] = useState<Note | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("notes").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setNotes((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const create = async () => {
    if (!user) return;
    if (!title.trim() || !content.trim()) { toast.error("Title and notes required"); return; }
    setBusy(true);
    try {
      // Call AI summarizer
      const { data: ai, error: aiErr } = await supabase.functions.invoke("summarize-notes", { body: { title, content } });
      if (aiErr) {
        if ((aiErr as any).context?.status === 429) toast.error("Rate limit reached, try again shortly.");
        else if ((aiErr as any).context?.status === 402) toast.error("AI credits exhausted. Add credits in Settings.");
        else toast.error("AI summary failed");
      }
      const summary = ai?.summary ?? null;
      const key_points = ai?.key_points ?? null;

      const { error } = await supabase.from("notes").insert({
        user_id: user.id, title: title.trim(), content, subject: subject.trim() || null, summary, key_points,
      });
      if (error) throw error;
      toast.success("Note saved & summarized!");
      setOpen(false); setTitle(""); setSubject(""); setContent("");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    await supabase.from("notes").delete().eq("id", id);
    toast.success("Note deleted");
    if (active?.id === id) setActive(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Notes</h1>
          <p className="text-sm text-muted-foreground">Paste your notes — AI will summarize and pull out key points.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary hover:opacity-90"><Plus className="h-4 w-4 mr-1.5" />New note</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>New note</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Title</Label><Input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Photosynthesis chapter" /></div>
                <div className="space-y-1.5"><Label>Subject (optional)</Label><Input value={subject} onChange={(e)=>setSubject(e.target.value)} placeholder="Biology" /></div>
              </div>
              <div className="space-y-1.5">
                <Label>Notes content</Label>
                <Textarea value={content} onChange={(e)=>setContent(e.target.value)} placeholder="Paste your notes here…" rows={10} />
              </div>
              <Button onClick={create} disabled={busy} className="w-full bg-gradient-primary hover:opacity-90">
                {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Summarizing…</> : <><Sparkles className="h-4 w-4 mr-2" />Save & summarize</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <SkeletonGrid /> : notes.length === 0 ? (
        <EmptyState onCreate={() => setOpen(true)} />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((n) => (
            <Card key={n.id} onClick={() => setActive(n)} className="p-5 hover-lift bg-gradient-card cursor-pointer">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                    <FileText className="h-3 w-3" />
                    {n.subject || "General"}
                  </div>
                  <h3 className="font-semibold truncate">{n.title}</h3>
                </div>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); remove(n.id); }}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-3 line-clamp-3">{n.summary || n.content}</p>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{active?.title}</DialogTitle></DialogHeader>
          {active && (
            <div className="space-y-4">
              {active.summary && (
                <Card className="p-4 bg-gradient-soft border-primary/20">
                  <p className="text-xs uppercase tracking-wide text-primary font-semibold mb-2 flex items-center gap-1.5"><Sparkles className="h-3 w-3" />AI Summary</p>
                  <p className="text-sm whitespace-pre-wrap">{active.summary}</p>
                </Card>
              )}
              {active.key_points && active.key_points.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Key takeaways</p>
                  <ul className="space-y-1.5">
                    {active.key_points.map((p, i) => (
                      <li key={i} className="flex gap-2 text-sm"><span className="text-primary mt-0.5">•</span><span>{p}</span></li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Original notes</p>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{active.content}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SkeletonGrid = () => (
  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
    {[...Array(3)].map((_, i) => <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />)}
  </div>
);

const EmptyState = ({ onCreate }: { onCreate: () => void }) => (
  <Card className="p-12 text-center bg-gradient-card">
    <div className="h-16 w-16 rounded-2xl bg-gradient-soft flex items-center justify-center mx-auto mb-4">
      <FileText className="h-8 w-8 text-primary" />
    </div>
    <h3 className="font-semibold text-lg mb-1">No notes yet</h3>
    <p className="text-sm text-muted-foreground mb-5">Create your first note and let AI summarize it for you.</p>
    <Button onClick={onCreate} className="bg-gradient-primary"><Plus className="h-4 w-4 mr-1.5" />Create note</Button>
  </Card>
);

export default Notes;
