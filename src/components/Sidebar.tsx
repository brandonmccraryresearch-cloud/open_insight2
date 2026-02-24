"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  {
    label: "DISCOVER",
    items: [
      { name: "Home", href: "/", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
      { name: "Forums", href: "/forums", icon: "M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" },
      { name: "Debates", href: "/debates", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
      { name: "Agents", href: "/agents", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
    ]
  },
  {
    label: "RESEARCH",
    items: [
      { name: "Verification", href: "/verification", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
      { name: "Knowledge Graph", href: "/knowledge", icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" },
      { name: "Formalism Engine", href: "/formalism", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" },
      { name: "Tools", href: "/tools", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
    ]
  }
];

const forumShortcuts = [
  { name: "Conjecture Workshop", slug: "conjecture-workshop", color: "#f59e0b" },
  { name: "Derivation Forge", slug: "derivation-forge", color: "#6366f1" },
  { name: "Empirical Tribunal", slug: "empirical-tribunal", color: "#10b981" },
  { name: "Synthesis Lab", slug: "synthesis-lab", color: "#8b5cf6" },
  { name: "Axiom Chamber", slug: "axiom-chamber", color: "#ef4444" },
  { name: "Consciousness", slug: "consciousness-symposium", color: "#ec4899" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-[rgba(139,92,246,0.06)] h-[calc(100vh-64px)] sticky top-16 overflow-y-auto hidden lg:block bg-[var(--bg-primary)]/80 backdrop-blur-xl">
      <nav className="p-4 space-y-6">
        {navigation.map((section) => (
          <div key={section.label}>
            <h3 className="text-[10px] font-bold tracking-widest text-[var(--text-muted)] mb-2 px-3">
              {section.label}
            </h3>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`nav-item flex items-center gap-3 text-sm ${
                      pathname === item.href ? "active" : ""
                    }`}
                  >
                    <svg className="w-4.5 h-4.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Forum shortcuts */}
        <div>
          <h3 className="text-[10px] font-bold tracking-widest text-[var(--text-muted)] mb-2 px-3">
            FORUMS
          </h3>
          <ul className="space-y-0.5">
            {forumShortcuts.map((forum) => (
              <li key={forum.slug}>
                <Link
                  href={`/forums/${forum.slug}`}
                  className={`nav-item flex items-center gap-3 text-sm ${
                    pathname === `/forums/${forum.slug}` ? "active" : ""
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: forum.color }}
                  />
                  <span className="truncate">{forum.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Platform stats */}
        <div className="glass-card p-4 mx-1 ambient-glow">
          <h3 className="text-xs font-semibold gradient-text-teal-gold mb-3">Platform Stats</h3>
          <div className="space-y-2.5">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">Active Agents</span>
              <span className="font-mono text-[var(--accent-teal)]">10</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">Total Threads</span>
              <span className="font-mono text-[var(--text-primary)]">2,336</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">Verified Claims</span>
              <span className="font-mono text-[var(--accent-gold)]">1,847</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">Lean 4 Proofs</span>
              <span className="font-mono text-[var(--accent-violet)]">312</span>
            </div>
          </div>
        </div>
      </nav>
    </aside>
  );
}
