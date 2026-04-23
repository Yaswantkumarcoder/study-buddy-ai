import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles, MessageSquare, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Msg { role: "user" | "assistant"; content: string }
interface Convo { id: string; title: string; updated_at: string }

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-tutor`;

const Chat = () => {
  const { user, session } = useAuth();
  const [convos, setConvos] = useState<Convo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (user) loadConvos(); }, [user]);
  useEffect(() => { if (activeId) loadMessages(activeId); }, [activeId]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const loadConvos = async () => {
    if (!user) return;
    const { data } = await supabase.from("chat_conversations").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
    setConvos((data as any) || []);
    if (data && data.length && !activeId) setActiveId(data[0].id);
  };

  const loadMessages = async (id: string) => {
    const { data } = await supabase.from("chat_messages").select("role,content").eq("conversation_id", id).order("created_at");
    setMessages(((data as any) || []) as Msg[]);
  };

  const newChat = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("chat_conversations").insert({ user_id: user.id, title: "New chat" }).select().single();
    if (error) { toast.error(error.message); return; }
    setConvos([data as any, ...convos]);
    setActiveId((data as any).id);
    setMessages([]);
  };

  const send = async () => {
    if (!user || !input.trim() || busy) return;
    let convoId = activeId;
    const text = input.trim();
    setInput("");

    // Ensure a conversation exists
    if (!convoId) {
      const { data, error } = await supabase.from("chat_conversations").insert({ user_id: user.id, title: text.slice(0, 40) }).select().single();
      if (error) { toast.error(error.message); return; }
      convoId = (data as any).id;
      setActiveId(convoId);
      setConvos((c) => [data as any, ...c]);
    }

    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    await supabase.from("chat_messages").insert({ conversation_id: convoId, user_id: user.id, role: "user", content: text });
    // Update title for first message
    if (messages.length === 0) {
      await supabase.from("chat_conversations").update({ title: text.slice(0, 40) }).eq("id", convoId);
      loadConvos();
    }

    setBusy(true);
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ messages: next }),
      });
      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast.error("Slow down — rate limit reached.");
        else if (resp.status === 402) toast.error("AI credits exhausted. Add credits in Settings.");
        else toast.error("Tutor unavailable");
        setBusy(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      let streamDone = false;

      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      const appendDelta = (delta: string) => {
        acc += delta;
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) appendDelta(c);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }

      if (acc) {
        await supabase.from("chat_messages").insert({ conversation_id: convoId, user_id: user.id, role: "assistant", content: acc });
      }
    } catch (e: any) {
      toast.error(e.message || "Stream failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-4 h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)]">
      {/* Conversation list */}
      <Card className="hidden md:flex flex-col p-3 bg-gradient-card overflow-hidden">
        <Button onClick={newChat} className="w-full bg-gradient-primary hover:opacity-90 mb-3"><Plus className="h-4 w-4 mr-1.5" />New chat</Button>
        <div className="flex-1 overflow-y-auto space-y-1">
          {convos.map((c) => (
            <button key={c.id} onClick={() => setActiveId(c.id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${activeId === c.id ? "bg-secondary text-secondary-foreground" : "hover:bg-secondary/60"}`}>
              {c.title}
            </button>
          ))}
        </div>
      </Card>

      {/* Chat */}
      <Card className="flex flex-col bg-gradient-card overflow-hidden">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm">StudyBuddy AI Tutor</p>
              <p className="text-xs text-muted-foreground">Ask anything — math, science, languages…</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={newChat} className="md:hidden"><Plus className="h-4 w-4" /></Button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-primary flex items-center justify-center mb-4 shadow-glow">
                <MessageSquare className="h-7 w-7 text-primary-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">How can I help you study today?</h3>
              <p className="text-sm text-muted-foreground max-w-md mb-6">Ask me to explain a concept, solve a problem step-by-step, or quiz you.</p>
              <div className="grid sm:grid-cols-2 gap-2 w-full max-w-md">
                {[
                  "Explain the Pythagorean theorem with examples",
                  "Quiz me on French vocabulary",
                  "Help me understand photosynthesis",
                  "Walk me through solving 3x + 7 = 22",
                ].map((s) => (
                  <button key={s} onClick={() => setInput(s)} className="text-left text-xs p-3 rounded-xl border border-border hover:bg-secondary transition-colors">{s}</button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${m.role === "user" ? "bg-gradient-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-2 prose-pre:bg-background/50">
                      <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </div>
            ))
          )}
          {busy && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start"><div className="bg-secondary rounded-2xl px-4 py-2.5"><Loader2 className="h-4 w-4 animate-spin" /></div></div>
          )}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-3 border-t border-border flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything…" disabled={busy} />
          <Button type="submit" size="icon" disabled={busy || !input.trim()} className="bg-gradient-primary hover:opacity-90 shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default Chat;
