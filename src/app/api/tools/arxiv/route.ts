import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;

const MAX_RESULTS = 20;
const MAX_QUERY_LENGTH = 500;

/**
 * arXiv Search MCP proxy — wraps the public arXiv API (export.arxiv.org/api/query).
 * Based on the arXiv Search MCP Server (Deno-based, search_arxiv tool).
 * Ref: https://github.com/arxiv-search-mcp
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const category = typeof body.category === "string" ? body.category.slice(0, 50) : "";
    const query = typeof body.query === "string" ? body.query.slice(0, MAX_QUERY_LENGTH) : "";
    const maxResults = Math.min(Math.max(Number(body.maxResults) || 5, 1), MAX_RESULTS);
    const sortBy = body.sortBy === "relevance" ? "relevance" : "submittedDate";
    const sortOrder = body.sortOrder === "ascending" ? "ascending" : "descending";

    if (!query && !category) {
      return NextResponse.json({ error: "Either query or category is required" }, { status: 400 });
    }

    // Build arXiv API query
    let searchQuery = "";
    if (query && category) {
      searchQuery = `search_query=cat:${encodeURIComponent(category)}+AND+all:${encodeURIComponent(query)}`;
    } else if (category) {
      searchQuery = `search_query=cat:${encodeURIComponent(category)}`;
    } else {
      searchQuery = `search_query=all:${encodeURIComponent(query)}`;
    }

    const apiUrl = `https://export.arxiv.org/api/query?${searchQuery}&start=0&max_results=${maxResults}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      return NextResponse.json({ error: `arXiv API returned ${response.status}` }, { status: 502 });
    }

    const xmlText = await response.text();
    const entries: Array<{
      title: string;
      authors: string[];
      abstract: string;
      categories: string[];
      published: string;
      pdfLink: string;
      absLink: string;
    }> = [];

    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match: RegExpExecArray | null;
    while ((match = entryRegex.exec(xmlText)) !== null) {
      const entry = match[1];
      const title = (entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "").replace(/\s+/g, " ").trim();
      const abstract = (entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? "").replace(/\s+/g, " ").trim().slice(0, 1000);
      const published = entry.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim() ?? "";
      const absLink = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() ?? "";
      const pdfLink = absLink.replace("/abs/", "/pdf/");

      const authors: string[] = [];
      const authorRegex = /<author>\s*<name>([\s\S]*?)<\/name>/g;
      let am: RegExpExecArray | null;
      while ((am = authorRegex.exec(entry)) !== null) {
        authors.push(am[1].trim());
      }

      const categories: string[] = [];
      const catRegex = /category[^>]*term="([^"]+)"/g;
      let cm: RegExpExecArray | null;
      while ((cm = catRegex.exec(entry)) !== null) {
        categories.push(cm[1]);
      }

      entries.push({ title, authors, abstract, categories, published, pdfLink, absLink });
    }

    return NextResponse.json({
      tool: "arxiv-search-mcp",
      query: query || undefined,
      category: category || undefined,
      resultCount: entries.length,
      results: entries,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
