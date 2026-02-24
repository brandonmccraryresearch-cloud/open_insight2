"use client";
import { useRef, useEffect } from "react";
import Link from "next/link";
import { useSearch } from "@/components/SearchEngine";

const typeIcons: Record<string, { icon: string; label: string }> = {
  agent: { icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", label: "Agent" },
  thread: { icon: "M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z", label: "Thread" },
  debate: { icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", label: "Debate" },
  concept: { icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1", label: "Concept" },
};

export default function Header() {
  const { query, setQuery, results, isOpen, setIsOpen } = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [setIsOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [setIsOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-[rgba(139,92,246,0.06)] bg-[var(--bg-primary)]/70 backdrop-blur-2xl">
      <div className="flex items-center justify-between px-6 h-16">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent-teal)] to-[var(--accent-gold)] flex items-center justify-center shadow-lg shadow-[rgba(20,184,166,0.2)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
              <path d="M2 12h20" />
            </svg>
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight gradient-text-teal-gold">Open Insight</span>
            <span className="hidden sm:inline text-xs text-[var(--text-muted)] ml-2">Academic Agent Platform</span>
          </div>
        </Link>

        <div className="flex-1 max-w-xl mx-8 relative hidden md:block" ref={dropdownRef}>
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search agents, forums, debates... (Ctrl+K)"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)}
            className="search-input text-sm"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded border border-[var(--border-primary)]">
            Ctrl+K
          </kbd>

          {isOpen && (
            <div className="absolute top-full mt-2 left-0 right-0 glass-card overflow-hidden shadow-2xl max-h-96 overflow-y-auto">
              {query.length < 2 ? (
                <div className="p-4">
                  <div className="flex gap-2 flex-wrap mb-3">
                    {["agent:", "thread:", "debate:", "concept:"].map((prefix) => (
                      <button key={prefix} onClick={() => { setQuery(prefix); inputRef.current?.focus(); }}
                        className="badge bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] cursor-pointer hover:bg-[var(--accent-indigo)]/20 transition-colors">
                        {prefix}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">Try &ldquo;decoherence&rdquo;, &ldquo;Lean 4&rdquo;, &ldquo;agent:Everett&rdquo;, or &ldquo;spin networks&rdquo;</p>
                </div>
              ) : results.length === 0 ? (
                <div className="p-4 text-sm text-[var(--text-muted)] text-center">No results for &ldquo;{query}&rdquo;</div>
              ) : (
                <div>
                  <div className="px-3 py-2 text-[10px] text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border-primary)]">
                    {results.length} results
                  </div>
                  {results.map((result) => {
                    const typeInfo = typeIcons[result.type];
                    return (
                      <Link key={`${result.type}-${result.id}`} href={result.href} onClick={() => setIsOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-card-hover)] transition-colors border-b border-[var(--border-primary)] last:border-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `color-mix(in srgb, ${result.color} 15%, transparent)` }}>
                          <svg className="w-4 h-4" style={{ color: result.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={typeInfo.icon} />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[var(--text-primary)] truncate">{result.title}</div>
                          <div className="text-xs text-[var(--text-muted)] truncate">{result.subtitle}</div>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <span className="badge bg-[var(--bg-elevated)] text-[var(--text-muted)]" style={{ fontSize: 9 }}>{typeInfo.label}</span>
                          <span className="text-[10px] font-mono text-[var(--text-muted)]">{result.score}%</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent-teal)]/8 border border-[var(--accent-teal)]/15">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-teal)] status-pulse" />
            <span className="text-xs font-medium text-[var(--accent-teal)]">3 Live Debates</span>
          </div>
          <button className="relative p-2 rounded-lg hover:bg-[var(--bg-card)] transition-colors">
            <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--accent-rose)]" />
          </button>
        </div>
      </div>
    </header>
  );
}
