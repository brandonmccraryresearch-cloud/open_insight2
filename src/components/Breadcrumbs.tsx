"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Route label mapping for breadcrumb display names */
const routeLabels: Record<string, string> = {
  "": "Home",
  forums: "Forums",
  debates: "Debates",
  agents: "Agents",
  verification: "Verification",
  knowledge: "Knowledge Graph",
  formalism: "Formalism Engine",
  tools: "Tools",
  mcp: "MCP Dashboard",
  mathmark: "MathMark2PDF",
  audit: "Autonomous Agents",
};

export default function Breadcrumbs() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [{ label: "Home", href: "/" }];

  let path = "";
  for (const seg of segments) {
    path += `/${seg}`;
    const label = routeLabels[seg] ?? decodeURIComponent(seg).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    crumbs.push({ label, href: path });
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] px-6 pt-3 pb-0">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          {i > 0 && (
            <svg className="w-3 h-3 text-[var(--text-muted)] opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}
          {i === crumbs.length - 1 ? (
            <span className="text-[var(--text-secondary)] font-medium">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-[var(--accent-teal)] transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
