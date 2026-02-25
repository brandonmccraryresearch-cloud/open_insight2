"use client";
import { useState } from "react";
import type { Agent } from "@/data/agents";
import Link from "next/link";

interface NewMessage {
  id: string;
  agentId: string;
  agentName: string;
  content: string;
  verificationDetails?: string;
  timestamp: string;
}

export default function DebateContinueClient({
  debateId,
  participants,
  agentMap,
}: {
  debateId: string;
  participants: string[];
  agentMap: Map<string, Agent>;
}) {
  const [generating, setGenerating] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(participants[0] ?? "");
  const [newMessages, setNewMessages] = useState<NewMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const participantAgents = participants
    .map((id) => agentMap.get(id))
    .filter((a): a is Agent => !!a);

  async function handleGenerate() {
    if (!selectedAgent || generating) return;
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch(`/api/debates/${debateId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: selectedAgent }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to generate message");
      }
      const data = await res.json() as NewMessage & { executionMode?: string };
      setNewMessages((prev) => [...prev, {
        id: data.id ?? `local-${Date.now()}`,
        agentId: data.agentId,
        agentName: data.agentName,
        content: data.content,
        verificationDetails: data.verificationDetails,
        timestamp: "just now",
      }]);
      // Rotate to next participant for convenience
      const idx = participants.indexOf(selectedAgent);
      setSelectedAgent(participants[(idx + 1) % participants.length]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Live messages generated this session */}
      {newMessages.map((msg) => {
        const agent = agentMap.get(msg.agentId);
        return (
          <div key={msg.id} className="glass-card p-5 border-l-2" style={{ borderLeftColor: agent?.color ?? "#6366f1" }}>
            <div className="flex items-start gap-3">
              {agent ? (
                <Link href={`/agents/${agent.id}`} className="shrink-0 hover:opacity-80">
                  <div className="agent-avatar" style={{ backgroundColor: agent.color, width: 36, height: 36, fontSize: 14 }}>
                    {agent.avatar}
                  </div>
                </Link>
              ) : (
                <div className="agent-avatar shrink-0" style={{ backgroundColor: "#64748b", width: 36, height: 36, fontSize: 14 }}>
                  {msg.agentName[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-sm font-semibold">{msg.agentName}</span>
                  <span className="text-xs text-[var(--text-muted)]">{msg.timestamp}</span>
                  <span className="badge text-[9px] bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]">✦ AI-generated</span>
                </div>
                <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                {msg.verificationDetails && (
                  <div className="mt-3 p-2 rounded-lg text-xs bg-[var(--accent-emerald)]/5 border border-[var(--accent-emerald)]/20 text-[var(--accent-emerald)]">
                    {msg.verificationDetails}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Generator control */}
      <div className="glass-card p-5 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--accent-rose)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Continue Debate Round
        </h3>

        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Speaking Agent</label>
            <div className="flex items-center gap-2">
              {agentMap.get(selectedAgent) && (
                <div className="agent-avatar shrink-0" style={{ backgroundColor: agentMap.get(selectedAgent)!.color, width: 28, height: 28, fontSize: 12 }}>
                  {agentMap.get(selectedAgent)!.avatar}
                </div>
              )}
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-rose)]"
              >
                {participantAgents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating || !selectedAgent}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--accent-rose)] hover:opacity-90 disabled:opacity-50"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Generating…
              </span>
            ) : "✦ Generate Argument"}
          </button>
        </div>

        {error && (
          <p className="text-xs text-[var(--accent-rose)] bg-[var(--accent-rose)]/10 rounded-lg px-3 py-2">{error}</p>
        )}
        <p className="text-[10px] text-[var(--text-muted)]">
          Powered by Gemini 3.1 Pro Preview — arguments are AI-generated in character as the selected agent
        </p>
      </div>
    </div>
  );
}
