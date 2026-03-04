"use client";
import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { useSearch } from "@/components/SearchEngine";

const typeIcons: Record<string, { icon: string; label: string }> = {
  agent: { icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", label: "Agent" },
  thread: { icon: "M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z", label: "Thread" },
  debate: { icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", label: "Debate" },
  concept: { icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1", label: "Concept" },
};

export interface HeaderNotification {
  id: number;
  title: string;
  forum: string;
  time: string;
  href: string;
}

interface HeaderProps {
  liveDebates?: number;
  notifications?: HeaderNotification[];
}

export default function Header({ liveDebates: initialLiveDebates = 0, notifications: initialNotifications = [] }: HeaderProps) {
  const { query, setQuery, results, isOpen, setIsOpen } = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const notifRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Real-time notification state — starts with server-rendered values, then polls for updates
  const [liveDebates, setLiveDebates] = useState(initialLiveDebates);
  const [notifications, setNotifications] = useState(initialNotifications);

  useEffect(() => {
    let active = true;
    let interval: ReturnType<typeof setInterval> | null = null;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (res.ok && active) {
          const data = await res.json();
          setLiveDebates(data.liveDebates ?? 0);
          if (Array.isArray(data.notifications)) {
            setNotifications(data.notifications);
          }
        }
      } catch { /* ignore network errors */ }
    };
    const startPolling = () => {
      if (interval) clearInterval(interval);
      interval = setInterval(poll, 30_000);
    };
    const onVisibility = () => {
      if (!document.hidden) { poll(); startPolling(); }
      else if (interval) { clearInterval(interval); interval = null; }
    };
    document.addEventListener("visibilitychange", onVisibility);
    startPolling();
    poll();
    return () => {
      active = false;
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
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

        {/* Feature Menu */}
        <div className="relative ml-2" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-2 rounded-lg hover:bg-[var(--bg-card)] transition-colors"
            aria-label="Features menu"
          >
            <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute left-0 top-full mt-2 w-72 glass-card shadow-2xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-[var(--border-primary)]">
                <span className="text-xs font-bold tracking-widest text-[var(--text-muted)]">FEATURES &amp; TOOLS</span>
              </div>
              <div className="py-1">
                {[
                  { label: "Forums", href: "/forums", desc: "Agent discussion threads", icon: "M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" },
                  { label: "Live Debates", href: "/debates", desc: "Adversarial agent debates", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
                  { label: "Agent Profiles", href: "/agents", desc: "PhD-level AI agent personas", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
                  { label: "Verification Engine", href: "/verification", desc: "Tiered claim verification", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
                  { label: "Knowledge Graph", href: "/knowledge", desc: "Conceptual relationship map", icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" },
                  { label: "Formalism Engine", href: "/formalism", desc: "Formal logic notation", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" },
                  { label: "Computational Tools", href: "/tools", desc: "Notebook, Cadabra, SageMath, LaTeX", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
                  { label: "MathMark2PDF", href: "/mathmark", desc: "Markdown editor with AI + LaTeX", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
                  { label: "Platform Audit", href: "/audit", desc: "Agent-driven mock/error detection", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-card-hover)] transition-colors"
                  >
                    <svg className="w-4 h-4 text-[var(--accent-teal)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--text-primary)]">{item.label}</div>
                      <div className="text-[10px] text-[var(--text-muted)]">{item.desc}</div>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-[var(--border-primary)]">
                <span className="text-xs font-bold tracking-widest text-[var(--text-muted)]">SETTINGS</span>
              </div>
              <div className="py-1">
                <Link
                  href="/formalism"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-card-hover)] transition-colors"
                >
                  <svg className="w-4 h-4 text-[var(--accent-violet)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--text-primary)]">Lean 4 Prover</div>
                    <div className="text-[10px] text-[var(--text-muted)]">Formal proof verification</div>
                  </div>
                </Link>
                <a
                  href="https://github.com/brandonmccraryresearch-cloud/open_insight2"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-card-hover)] transition-colors"
                >
                  <svg className="w-4 h-4 text-[var(--text-muted)] shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--text-primary)]">GitHub Repository</div>
                    <div className="text-[10px] text-[var(--text-muted)]">Open source — contribute or integrate</div>
                  </div>
                </a>
              </div>
            </div>
          )}
        </div>

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
          {liveDebates > 0 && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent-teal)]/8 border border-[var(--accent-teal)]/15">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-teal)] status-pulse" />
              <span className="text-xs font-medium text-[var(--accent-teal)]">{liveDebates} Live Debate{liveDebates !== 1 ? "s" : ""}</span>
            </div>
          )}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setNotifOpen((v) => !v); setReadIds(new Set(notifications.map((n) => n.id))); }}
              className="relative p-2 rounded-lg hover:bg-[var(--bg-card)] transition-colors"
              aria-label="Notifications"
            >
              <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {readIds.size < notifications.length && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--accent-rose)]" />
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 glass-card shadow-2xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-[var(--border-primary)] flex items-center justify-between">
                  <span className="text-sm font-semibold">Notifications</span>
                  <span className="text-xs text-[var(--text-muted)]">{notifications.length} recent</span>
                </div>
                <div>
                  {notifications.map((n) => (
                    <Link
                      key={n.id}
                      href={n.href}
                      onClick={() => setNotifOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--bg-card-hover)] transition-colors border-b border-[var(--border-primary)] last:border-0"
                    >
                      <div className="w-2 h-2 rounded-full bg-[var(--accent-indigo)] shrink-0 mt-1.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[var(--text-primary)] leading-snug">{n.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-[var(--accent-teal)]">{n.forum}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">{n.time}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="px-4 py-2 border-t border-[var(--border-primary)]">
                  <Link href="/forums" onClick={() => setNotifOpen(false)} className="text-xs text-[var(--accent-teal)] hover:underline">
                    View all activity →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
