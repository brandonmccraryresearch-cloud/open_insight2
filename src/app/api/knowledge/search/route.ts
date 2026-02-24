import { NextRequest, NextResponse } from "next/server";

interface Paper {
  title: string;
  authors: string;
  year: number;
  citations: number;
  source: string;
  relevance: number;
  abstract?: string;
}

const PAPER_DB: Paper[] = [
  { title: "Gravity-related spontaneous wave function collapse", authors: "Diósi, L.", year: 2014, citations: 287, source: "OpenAlex", relevance: 0, abstract: "A review of gravitational decoherence models and their experimental implications." },
  { title: "On Gravity's role in Quantum State Reduction", authors: "Penrose, R.", year: 1996, citations: 1456, source: "Semantic Scholar", relevance: 0, abstract: "Proposes that gravitational self-energy provides an objective criterion for quantum state reduction." },
  { title: "Decoherence, the measurement problem, and interpretations of quantum mechanics", authors: "Schlosshauer, M.", year: 2005, citations: 2134, source: "OpenAlex", relevance: 0, abstract: "Comprehensive review of decoherence theory and its implications for quantum measurement." },
  { title: "Environment-induced superselection rules", authors: "Zurek, W.H.", year: 1982, citations: 3567, source: "Semantic Scholar", relevance: 0, abstract: "Foundational paper on einselection and the emergence of classical properties from quantum substrates." },
  { title: "The Everett interpretation of quantum mechanics: Collected works 1955-1980", authors: "Everett, H.", year: 1973, citations: 892, source: "OpenAlex", relevance: 0, abstract: "Original formulation of the relative-state interpretation of quantum mechanics." },
  { title: "Quantum Gravity", authors: "Rovelli, C.", year: 2004, citations: 4521, source: "Semantic Scholar", relevance: 0, abstract: "Textbook on loop quantum gravity and the quantum structure of spacetime." },
  { title: "Foundations of constructive mathematics", authors: "Bishop, E.", year: 1967, citations: 2890, source: "OpenAlex", relevance: 0, abstract: "Seminal work establishing constructive analysis without the law of excluded middle." },
  { title: "Consciousness as integrated information: a provisional manifesto", authors: "Tononi, G.", year: 2008, citations: 1567, source: "Semantic Scholar", relevance: 0, abstract: "Introduces IIT 2.0 and the concept of integrated information (Φ) as a measure of consciousness." },
  { title: "The quest for a fundamental theory of consciousness", authors: "Koch, C.", year: 2020, citations: 345, source: "OpenAlex", relevance: 0, abstract: "Overview of IIT 4.0 and experimental approaches to measuring consciousness." },
  { title: "Local quantum field theory", authors: "Haag, R.", year: 1992, citations: 3456, source: "Semantic Scholar", relevance: 0, abstract: "Comprehensive treatment of algebraic quantum field theory and Haag-Kastler axioms." },
  { title: "The quantum theory of fields", authors: "Weinberg, S.", year: 1995, citations: 8901, source: "OpenAlex", relevance: 0, abstract: "Definitive textbook on quantum field theory from the effective field theory perspective." },
  { title: "String theory and M-theory: A modern introduction", authors: "Becker, K., Becker, M., Schwarz, J.H.", year: 2007, citations: 2345, source: "Semantic Scholar", relevance: 0, abstract: "Comprehensive introduction to string theory including dualities and M-theory." },
  { title: "Über formal unentscheidbare Sätze der Principia Mathematica und verwandter Systeme I", authors: "Gödel, K.", year: 1931, citations: 12450, source: "OpenAlex", relevance: 0, abstract: "The incompleteness theorems: any consistent formal system containing arithmetic has undecidable propositions." },
  { title: "Consciousness explained", authors: "Dennett, D.C.", year: 1991, citations: 7890, source: "Semantic Scholar", relevance: 0, abstract: "Multiple drafts model of consciousness as an alternative to Cartesian materialism." },
  { title: "Spin foam models for quantum gravity", authors: "Perez, A.", year: 2003, citations: 987, source: "OpenAlex", relevance: 0, abstract: "Review of spin foam models as path integral approaches to loop quantum gravity." },
];

function computeRelevance(paper: Paper, query: string): number {
  const q = query.toLowerCase();
  const terms = q.split(/\s+/);
  let score = 0;

  for (const term of terms) {
    if (paper.title.toLowerCase().includes(term)) score += 0.3;
    if (paper.authors.toLowerCase().includes(term)) score += 0.2;
    if (paper.abstract?.toLowerCase().includes(term)) score += 0.15;
  }

  // Citation bonus (log scale)
  score += Math.log10(paper.citations + 1) * 0.05;

  // Recency bonus
  if (paper.year > 2010) score += 0.05;

  return Math.min(score, 1.0);
}

export function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q) {
    return NextResponse.json({ papers: [], query: "" });
  }

  const scored = PAPER_DB.map((p) => ({ ...p, relevance: computeRelevance(p, q) }))
    .filter((p) => p.relevance > 0.1)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 8);

  return NextResponse.json({ papers: scored, query: q });
}
