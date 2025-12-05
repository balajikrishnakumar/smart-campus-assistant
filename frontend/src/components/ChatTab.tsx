import { useState, useEffect } from "react";
import { studyAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";

type ChatMessage = { role: "user" | "assistant"; content: string };

export const ChatTab = ({ documentId }: { documentId: string }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Load stored chat history
  useEffect(() => {
    const loadHistory = async () => {
      if (!documentId) {
        setMessages([]);
        return;
      }

      try {
        const res: any = await studyAPI.getChatHistory(documentId);
        // Normalize whatever the backend returned into ChatMessage[]
        const raw = res?.messages ?? res?.data ?? [];
        const normalized: ChatMessage[] = Array.isArray(raw)
          ? raw.map((m: any) => {
              // Accept both { role, content } and { q, a } pairs (older format)
              if (m?.role && m?.content) {
                return {
                  role: m.role === "user" ? "user" : "assistant",
                  content: String(m.content ?? ""),
                };
              }
              if (m?.q && m?.a) {
                // If backend stored in pairs, expand both
                return { role: "assistant", content: String(m.a ?? m.q ?? "") };
              }
              // try to coerce simple shapes
              if (typeof m === "string") {
                return { role: "assistant", content: m };
              }
              return { role: "assistant", content: JSON.stringify(m) };
            })
          : [];

        setMessages(normalized);
      } catch (err) {
        console.error("Failed to load chat history:", err);
        setMessages([]); // safe fallback
      }
    };

    loadHistory();
  }, [documentId]);

  const sendMessage = async () => {
    if (!input.trim() || !documentId) return;

    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);

    setLoading(true);

    try {
      const res: any = await studyAPI.chat(documentId, input.trim());
      // backend expected to return { answer: "...." }
      const answerText = String(res?.answer ?? res?.data?.answer ?? "");

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: answerText || "No response from server.",
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Error fetching response." },
      ]);
    } finally {
      setInput("");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* CHAT WINDOW */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-4 rounded-xl max-w-[85%] leading-relaxed whitespace-pre-line break-words shadow-md
              ${
                m.role === "user"
                  ? "ml-auto bg-blue-600 text-white"
                  : "mr-auto bg-gray-800 text-white"
              }`}
          >
            <div className="text-base">{m.content}</div>
          </div>
        ))}
      </div>

      {/* INPUT BOX */}
      <div className="p-4 flex gap-2 border-t bg-gray-900">
        <input
          className="flex-1 border p-3 rounded-lg bg-gray-800 text-white placeholder-gray-400"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something about the document…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />
        <Button onClick={sendMessage} disabled={loading || !input.trim()}>
          {loading ? "Thinking…" : "Send"}
        </Button>
      </div>
    </div>
  );
};
