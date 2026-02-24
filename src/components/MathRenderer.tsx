"use client";
import { useEffect, useRef } from "react";
import katex from "katex";

interface MathRendererProps {
  tex: string;
  display?: boolean;
  className?: string;
}

export default function MathRenderer({ tex, display = false, className = "" }: MathRendererProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current) {
      try {
        katex.render(tex, ref.current, {
          displayMode: display,
          throwOnError: false,
          trust: true,
          macros: {
            "\\ket": "\\left|#1\\right\\rangle",
            "\\bra": "\\left\\langle#1\\right|",
            "\\braket": "\\left\\langle#1|#2\\right\\rangle",
            "\\Tr": "\\operatorname{Tr}",
            "\\Phi": "\\varPhi",
            "\\hbar": "\\hslash",
          },
        });
      } catch {
        if (ref.current) {
          ref.current.textContent = tex;
        }
      }
    }
  }, [tex, display]);

  return <span ref={ref} className={`${className} ${display ? "block my-3 overflow-x-auto" : "inline"}`} />;
}

/** Parse text and render inline math between $ delimiters and display math between $$ */
export function MathText({ children, className = "" }: { children: string; className?: string }) {
  const parts: { type: "text" | "display" | "inline"; content: string }[] = [];
  let remaining = children;

  while (remaining.length > 0) {
    // Check for display math $$...$$
    const displayMatch = remaining.match(/\$\$([\s\S]*?)\$\$/);
    // Check for inline math $...$
    const inlineMatch = remaining.match(/\$([^\$\n]+?)\$/);

    if (displayMatch && (!inlineMatch || (displayMatch.index ?? Infinity) <= (inlineMatch.index ?? Infinity))) {
      const idx = displayMatch.index ?? 0;
      if (idx > 0) {
        parts.push({ type: "text", content: remaining.slice(0, idx) });
      }
      parts.push({ type: "display", content: displayMatch[1] });
      remaining = remaining.slice(idx + displayMatch[0].length);
    } else if (inlineMatch) {
      const idx = inlineMatch.index ?? 0;
      if (idx > 0) {
        parts.push({ type: "text", content: remaining.slice(0, idx) });
      }
      parts.push({ type: "inline", content: inlineMatch[1] });
      remaining = remaining.slice(idx + inlineMatch[0].length);
    } else {
      parts.push({ type: "text", content: remaining });
      remaining = "";
    }
  }

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.type === "text") return <span key={i}>{part.content}</span>;
        return <MathRenderer key={i} tex={part.content} display={part.type === "display"} />;
      })}
    </span>
  );
}
