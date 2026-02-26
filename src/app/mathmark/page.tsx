"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

/* ─── Types ─── */
interface ChatMsg { role: "user" | "assistant"; text: string }
interface AnalysisChange { description: string; originalText: string; replacementText: string }
interface AnalysisSection { id: string; title: string; summary: string; changes: AnalysisChange[] }
interface DetectSegment { text: string; score: number; explanation: string; suggestion: string }
interface DetectResult { score: number; verdict: string; segments: DetectSegment[] }

/* ─── Toolbar Items ─── */
type InsertFn = (before: string, after?: string, block?: boolean) => void;

interface ToolItem { label: string; icon: React.ReactNode; action: (insert: InsertFn) => void }

const Bd = ({ children }: { children: React.ReactNode }) => <strong className="font-bold">{children}</strong>;
const It = ({ children }: { children: React.ReactNode }) => <em>{children}</em>;
const St = ({ children }: { children: React.ReactNode }) => <span className="line-through">{children}</span>;

const TOOLS: ToolItem[] = [
  { label: "Bold", icon: <Bd>B</Bd>, action: i => i("**", "**") },
  { label: "Italic", icon: <It>I</It>, action: i => i("*", "*") },
  { label: "Strike", icon: <St>S</St>, action: i => i("~~", "~~") },
  { label: "H1", icon: <span>H1</span>, action: i => i("# ", "", true) },
  { label: "H2", icon: <span>H2</span>, action: i => i("## ", "", true) },
  { label: "H3", icon: <span>H3</span>, action: i => i("### ", "", true) },
  { label: "Link", icon: <span>🔗</span>, action: i => i("[", "](url)") },
  { label: "Image", icon: <span>🖼</span>, action: i => i("![alt](", ")") },
  { label: "Quote", icon: <span>❝</span>, action: i => i("> ", "", true) },
  { label: "Code", icon: <span>`</span>, action: i => i("`", "`") },
  { label: "Code Block", icon: <span>{"</>"}</span>, action: i => i("```\n", "\n```", true) },
  { label: "Math", icon: <span>∑</span>, action: i => i("$$\n", "\n$$", true) },
  { label: "UL", icon: <span>•</span>, action: i => i("- ", "", true) },
  { label: "OL", icon: <span>1.</span>, action: i => i("1. ", "", true) },
  { label: "Table", icon: <span>⊞</span>, action: i => i("| Col 1 | Col 2 |\n|-------|-------|\n| ", " | |\n", true) },
  { label: "HR", icon: <span>—</span>, action: i => i("\n---\n", "", true) },
];

/* ─── Component ─── */
export default function MathMarkPage() {
  const [content, setContent] = useState(INITIAL_CONTENT);
  const [title, setTitle] = useState("Untitled Document");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"chat" | "analyze" | "detect">("chat");

  // Chat
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Analyze
  const [analysisResult, setAnalysisResult] = useState<AnalysisSection[] | null>(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);

  // Detect
  const [detectResult, setDetectResult] = useState<DetectResult | null>(null);
  const [detectLoading, setDetectLoading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory]);

  /* ─── Insert helper ─── */
  const insertAtCursor: InsertFn = useCallback((before, after = "", block = false) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.slice(start, end);
    const prefix = block && start > 0 && content[start - 1] !== "\n" ? "\n" : "";
    const insert = `${prefix}${before}${selected || "text"}${after}`;
    const next = content.slice(0, start) + insert + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      const cursorPos = start + prefix.length + before.length;
      ta.setSelectionRange(cursorPos, cursorPos + (selected.length || 4));
    });
  }, [content]);

  /* ─── Export ─── */
  const downloadFile = (filename: string, text: string, mime: string) => {
    const blob = new Blob([text], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportMd = () => downloadFile(`${title}.md`, content, "text/markdown");

  const exportHtml = () => {
    const preview = document.getElementById("mm-preview");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.28/dist/katex.min.css">
<style>body{font-family:system-ui;max-width:800px;margin:auto;padding:2rem;line-height:1.7}
pre{background:#1e1e2e;color:#cdd6f4;padding:1rem;border-radius:8px;overflow-x:auto}
code{font-family:monospace}table{border-collapse:collapse;width:100%}
th,td{border:1px solid #ccc;padding:.5rem;text-align:left}</style></head>
<body>${preview?.innerHTML ?? ""}</body></html>`;
    downloadFile(`${title}.html`, html, "text/html");
  };

  const printPdf = () => window.print();

  /* ─── AI Chat ─── */
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    const updated: ChatMsg[] = [...chatHistory, { role: "user", text: msg }];
    setChatHistory(updated);
    setChatLoading(true);
    try {
      const res = await fetch("/api/mathmark/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          documentContext: content,
          history: updated.map(m => ({ role: m.role, text: m.text })),
        }),
      });
      const data = await res.json();
      setChatHistory(prev => [...prev, { role: "assistant", text: data.text || data.error }]);
    } catch {
      setChatHistory(prev => [...prev, { role: "assistant", text: "Failed to reach AI." }]);
    } finally {
      setChatLoading(false);
    }
  };

  /* ─── AI Analyze ─── */
  const runAnalyze = async () => {
    setAnalyzeLoading(true);
    try {
      const res = await fetch("/api/mathmark/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      setAnalysisResult(data.sections ?? []);
    } catch {
      setAnalysisResult([]);
    } finally {
      setAnalyzeLoading(false);
    }
  };

  const applyChange = (change: AnalysisChange) => {
    if (content.includes(change.originalText)) {
      setContent(content.replace(change.originalText, change.replacementText));
    }
  };

  /* ─── AI Detect ─── */
  const runDetect = async () => {
    setDetectLoading(true);
    try {
      const res = await fetch("/api/mathmark/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      setDetectResult(data);
    } catch {
      setDetectResult(null);
    } finally {
      setDetectLoading(false);
    }
  };

  const scoreColor = (s: number) => s >= 70 ? "#10b981" : s >= 40 ? "#eab308" : "#ef4444";

  /* ─── Render ─── */
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[var(--bg-primary)]">
      {/* Header Bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border-primary)] bg-[var(--bg-card)]">
        <h1 className="text-lg font-bold whitespace-nowrap select-none">
          <span className="text-white">Math</span>
          <span className="text-[#d4a017]">Mark</span>
          <span className="text-[#ef4444]">2PDF</span>
        </h1>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="flex-1 max-w-xs px-3 py-1 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-teal)]"
        />
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={exportMd} className="mm-btn">📄 MD</button>
          <button onClick={exportHtml} className="mm-btn">🌐 HTML</button>
          <button onClick={printPdf} className="mm-btn">🖨 PDF</button>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className={`mm-btn ${sidebarOpen ? "!border-[var(--accent-teal)] !text-[var(--accent-teal)]" : ""}`}
          >
            ✨ AI
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-[var(--border-primary)] bg-[var(--bg-card)] overflow-x-auto">
        {TOOLS.map(t => (
          <button
            key={t.label}
            title={t.label}
            onClick={() => t.action(insertAtCursor)}
            className="px-2 py-1 rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors shrink-0"
          >
            {t.icon}
          </button>
        ))}
      </div>

      {/* Main Area */}
      <div className="flex flex-1 min-h-0">
        {/* Editor */}
        <div className="flex-1 min-w-0 flex flex-col border-r border-[var(--border-primary)]">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            spellCheck={false}
            className="flex-1 w-full resize-none p-4 bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono text-sm leading-relaxed focus:outline-none"
            placeholder="Start writing markdown..."
          />
        </div>

        {/* Preview */}
        <div className="flex-1 min-w-0 overflow-auto p-6 bg-[var(--bg-secondary)]">
          <div id="mm-preview" className="mm-preview prose prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || "");
                  const code = String(children).replace(/\n$/, "");
                  if (match) {
                    return (
                      <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div">
                        {code}
                      </SyntaxHighlighter>
                    );
                  }
                  return <code className={className} {...props}>{children}</code>;
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>

        {/* AI Sidebar */}
        {sidebarOpen && (
          <div className="w-80 shrink-0 flex flex-col border-l border-[var(--border-primary)] bg-[var(--bg-card)]">
            {/* Tabs */}
            <div className="flex border-b border-[var(--border-primary)]">
              {(["chat", "analyze", "detect"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
                    sidebarTab === tab
                      ? "text-[var(--accent-teal)] border-b-2 border-[var(--accent-teal)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Chat Tab */}
            {sidebarTab === "chat" && (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-auto p-3 space-y-3">
                  {chatHistory.length === 0 && (
                    <p className="text-xs text-[var(--text-muted)] text-center mt-8">
                      Ask the AI about your document…
                    </p>
                  )}
                  {chatHistory.map((m, i) => (
                    <div key={i} className={`text-xs p-2 rounded-lg ${
                      m.role === "user"
                        ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] ml-6"
                        : "bg-[var(--bg-primary)] text-[var(--text-secondary)] mr-6"
                    }`}>
                      <span className="font-semibold text-[var(--accent-teal)]">
                        {m.role === "user" ? "You" : "AI"}:
                      </span>{" "}
                      <span className="whitespace-pre-wrap">{m.text}</span>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="text-xs text-[var(--text-muted)] animate-pulse">AI is thinking…</div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="flex gap-2 p-3 border-t border-[var(--border-primary)]">
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendChat())}
                    placeholder="Ask about your document…"
                    className="flex-1 px-3 py-1.5 rounded-md text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-teal)]"
                  />
                  <button onClick={sendChat} disabled={chatLoading} className="mm-btn text-xs">
                    Send
                  </button>
                </div>
              </div>
            )}

            {/* Analyze Tab */}
            {sidebarTab === "analyze" && (
              <div className="flex-1 overflow-auto p-3">
                <button
                  onClick={runAnalyze}
                  disabled={analyzeLoading}
                  className="mm-btn w-full mb-3 justify-center"
                >
                  {analyzeLoading ? "Analyzing…" : "Analyze Document"}
                </button>
                {analysisResult?.map(sec => (
                  <div key={sec.id} className="mb-4 p-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)]">
                    <h4 className="text-xs font-semibold text-[var(--accent-gold)] mb-1">{sec.title}</h4>
                    <p className="text-xs text-[var(--text-secondary)] mb-2">{sec.summary}</p>
                    {sec.changes.map((c, ci) => (
                      <div key={ci} className="mb-2 p-2 rounded bg-[var(--bg-elevated)] text-xs">
                        <p className="text-[var(--text-muted)] mb-1">{c.description}</p>
                        <div className="flex gap-1 mt-1">
                          <button onClick={() => applyChange(c)} className="mm-btn text-[10px] py-0.5">
                            Apply
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Detect Tab */}
            {sidebarTab === "detect" && (
              <div className="flex-1 overflow-auto p-3">
                <button
                  onClick={runDetect}
                  disabled={detectLoading}
                  className="mm-btn w-full mb-3 justify-center"
                >
                  {detectLoading ? "Scanning…" : "Run Detection"}
                </button>
                {detectResult && (
                  <>
                    <div className="flex flex-col items-center mb-4">
                      <div className="relative w-24 h-24">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-primary)" strokeWidth="8" />
                          <circle
                            cx="50" cy="50" r="42" fill="none"
                            stroke={scoreColor(detectResult.score)}
                            strokeWidth="8"
                            strokeDasharray={`${detectResult.score * 2.64} 264`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold" style={{ color: scoreColor(detectResult.score) }}>
                          {detectResult.score}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-2 text-center">{detectResult.verdict}</p>
                    </div>
                    {detectResult.segments.map((seg, i) => (
                      <div key={i} className="mb-3 p-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold" style={{ color: scoreColor(seg.score) }}>
                            Score: {seg.score}
                          </span>
                        </div>
                        <p className="text-[var(--text-muted)] mb-1 line-clamp-2">&ldquo;{seg.text}&rdquo;</p>
                        <p className="text-[var(--text-secondary)]">{seg.explanation}</p>
                        {seg.suggestion && (
                          <p className="text-[var(--accent-teal)] mt-1">💡 {seg.suggestion}</p>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scoped styles */}
      <style jsx global>{`
        .mm-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.375rem 0.75rem;
          border-radius: 0.375rem;
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-secondary);
          border: 1px solid var(--border-primary);
          background: var(--bg-elevated);
          transition: all 0.15s;
          cursor: pointer;
          white-space: nowrap;
        }
        .mm-btn:hover {
          color: var(--text-primary);
          border-color: var(--accent-teal);
        }
        .mm-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .mm-preview h1 { font-size: 2rem; font-weight: 700; margin: 1.5rem 0 0.75rem; color: var(--text-primary); }
        .mm-preview h2 { font-size: 1.5rem; font-weight: 600; margin: 1.25rem 0 0.5rem; color: var(--text-primary); }
        .mm-preview h3 { font-size: 1.25rem; font-weight: 600; margin: 1rem 0 0.5rem; color: var(--text-primary); }
        .mm-preview p { margin: 0.5rem 0; line-height: 1.75; color: var(--text-secondary); }
        .mm-preview a { color: var(--accent-teal); text-decoration: underline; }
        .mm-preview blockquote { border-left: 3px solid var(--accent-teal); padding-left: 1rem; color: var(--text-muted); margin: 0.75rem 0; }
        .mm-preview ul, .mm-preview ol { padding-left: 1.5rem; margin: 0.5rem 0; color: var(--text-secondary); }
        .mm-preview li { margin: 0.25rem 0; }
        .mm-preview code { background: var(--bg-elevated); padding: 0.15rem 0.35rem; border-radius: 4px; font-size: 0.85em; }
        .mm-preview pre { margin: 0.75rem 0; border-radius: 8px; overflow: hidden; }
        .mm-preview pre code { background: transparent; padding: 0; }
        .mm-preview table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; }
        .mm-preview th, .mm-preview td { border: 1px solid var(--border-primary); padding: 0.5rem; text-align: left; font-size: 0.875rem; }
        .mm-preview th { background: var(--bg-elevated); color: var(--text-primary); }
        .mm-preview td { color: var(--text-secondary); }
        .mm-preview hr { border: none; border-top: 1px solid var(--border-primary); margin: 1.5rem 0; }
        .mm-preview img { max-width: 100%; border-radius: 8px; }
        @media print {
          body > *:not(main) { display: none !important; }
          main > * { display: none !important; }
          #mm-preview { display: block !important; color: #000; }
        }
      `}</style>
    </div>
  );
}

/* ─── Default Content ─── */
const INITIAL_CONTENT = `# Welcome to MathMark2PDF

A powerful markdown editor with **live preview**, $\\LaTeX$ math, and AI assistance.

## Features

- **Live Preview** — see changes as you type
- **Math Support** — inline $E = mc^2$ and display math:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}
$$

- **Code Highlighting** — syntax-aware rendering
- **AI Sidebar** — chat, analyze, and detect

## Code Example

\`\`\`python
def fibonacci(n: int) -> int:
    """Calculate the nth Fibonacci number."""
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)
\`\`\`

## Table

| Feature       | Status |
|---------------|--------|
| Markdown      | ✅     |
| Math (KaTeX)  | ✅     |
| Code Blocks   | ✅     |
| Export PDF     | ✅     |
| AI Chat       | ✅     |

---

> Start editing on the left panel. Toggle the **AI** button to open the assistant sidebar.
`;
