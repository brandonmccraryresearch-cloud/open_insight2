"use client";
import { useState } from "react";
import type { Agent } from "@/data/agents";
import Link from "next/link";

interface LiveReply {
  agentId: string;
  agentName: string;
  content: string;
  verificationNote?: string;
  timestamp: string;
}

const verificationColors: Record<string, { bg: string; text: string; label: string }> = {
  verified: { bg: "rgba(16,185,129,0.1)", text: "#10b981", label: "Verified" },
  pending: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b", label: "Pending" },
  unchecked: { bg: "rgba(100,116,139,0.1)", text: "#64748b", label: "Unchecked" },
};

export default function ThreadReplyClient({
  forumSlug,
  threadId,
  agents,
  forumColor,
}: {
  forumSlug: string;
  threadId: string;
  agents: Agent[];
  forumColor: string;
}) {
  const [selectedAgent, setSelectedAgent] = useState(agents[0]?.id ?? "");
  const [generating, setGenerating] = useState(false);
  const [liveReplies, setLiveReplies] = useState<LiveReply[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerateReply() {
    if (!selectedAgent || generating) return;
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch(`/api/forums/${forumSlug}/threads/${threadId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgent,
          previousReplies: liveReplies.map((r) => ({
            agentName: r.agentName,
            content: r.content,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to generate reply");
      }

      const data = await res.json() as {
        content: string;
        verificationNote?: string;
        agentName: string;
        agentId: string;
        executionMode?: string;
      };

      setLiveReplies((prev) => [
        ...prev,
        {
          agentId: data.agentId,
          agentName: data.agentName,
          content: data.content,
          verificationNote: data.verificationNote,
          timestamp: "just now",
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setGenerating(false);
    }
  }

  const selectedAgentData = agents.find((a) => a.id === selectedAgent);

  return (
    <div className="space-y-4">
      {/* Live replies generated this session */}
      {liveReplies.map((reply, i) => {
        const replyAgent = agents.find((a) => a.id === reply.agentId);
        const rv = verificationColors[reply.verificationNote ? "pending" : "unchecked"];
        return (
          <div key={i} className="glass-card p-5 border-l-2" style={{ borderLeftColor: replyAgent?.color ?? forumColor }}>
            <div className="flex items-start gap-3">
              {replyAgent ? (
                <Link href={`/agents/${replyAgent.id}`} className="shrink-0 hover:opacity-80 transition-opacity">
                  <div className="agent-avatar" style={{ backgroundColor: replyAgent.color, width: 36, height: 36, fontSize: 14 }}>
                    {replyAgent.avatar}
                  </div>
                </Link>
              ) : (
                <div className="agent-avatar shrink-0" style={{ backgroundColor: "#64748b", width: 36, height: 36, fontSize: 14 }}>
                  {reply.agentName[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {replyAgent ? (
                    <Link href={`/agents/${replyAgent.id}`} className="text-sm font-semibold hover:text-[var(--accent-indigo)] transition-colors">
                      {reply.agentName}
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold">{reply.agentName}</span>
                  )}
                  <span className="text-xs text-[var(--text-muted)]">{reply.timestamp}</span>
                  <span className="badge text-[9px]" style={{ backgroundColor: "rgba(99,102,241,0.1)", color: "#6366f1" }}>
                    ✦ AI-generated
                  </span>
                </div>
                <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap mb-3">{reply.content}</p>
                {reply.verificationNote && (
                  <div className="flex items-start gap-2 p-2 rounded-lg text-xs" style={{ backgroundColor: rv.bg, borderLeft: `3px solid ${rv.text}` }}>
                    <span style={{ color: rv.text }}>{reply.verificationNote}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Reply generator */}
      <div className="glass-card p-5 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--accent-indigo)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Generate Agent Reply
        </h3>

        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Agent</label>
            <div className="flex items-center gap-2">
              {selectedAgentData && (
                <div className="agent-avatar shrink-0" style={{ backgroundColor: selectedAgentData.color, width: 28, height: 28, fontSize: 12 }}>
                  {selectedAgentData.avatar}
                </div>
              )}
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-indigo)]"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} — {a.title}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleGenerateReply}
            disabled={generating || !selectedAgent}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ backgroundColor: forumColor }}
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Generating…
              </span>
            ) : "✦ Generate Reply"}
          </button>
        </div>

        {error && (
          <p className="text-xs text-[var(--accent-rose)] bg-[var(--accent-rose)]/10 rounded-lg px-3 py-2">{error}</p>
        )}
        <p className="text-[10px] text-[var(--text-muted)]">
          Powered by Gemini {process.env.NEXT_PUBLIC_GEMINI_LABEL ?? "3.1 Pro Preview"} — replies are AI-generated in character as the selected agent
        </p>
      </div>
    </div>
  );
}
