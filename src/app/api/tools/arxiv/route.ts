import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;

/** Maximum length for paper abstracts returned in results */
const MAX_SUMMARY_LENGTH = 500;

/** Maximum results to return from arXiv search */
const MAX_RESULTS = 10;

export async function POST(request: NextRequest) {
  let body: { query?: string; maxResults?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { query, maxResults } = body;
  if (!query || typeof query !== "string") {
    return NextResponse.json(
      { error: "A 'query' string is required" },
      { status: 400 },
    );
  }

  const limit = Math.min(
    Math.max(1, maxResults ?? MAX_RESULTS),
    MAX_RESULTS,
  );

  try {
    const searchQuery = encodeURIComponent(query);
    const apiUrl = `https://export.arxiv.org/api/query?search_query=all:${searchQuery}&start=0&max_results=${limit}&sortBy=relevance&sortOrder=descending`;

    const res = await fetch(apiUrl, {
      headers: { Accept: "application/xml" },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `arXiv API returned HTTP ${res.status}` },
        { status: 502 },
      );
    }

    const xml = await res.text();

    // Parse entries from Atom XML
    const entries: Array<{
      title: string;
      authors: string[];
      summary: string;
      published: string;
      updated: string;
      arxivId: string;
      pdfUrl: string;
      categories: string[];
    }> = [];

    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match: RegExpExecArray | null;
    while ((match = entryRegex.exec(xml)) !== null) {
      const entry = match[1];

      const title =
        entry.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
      const summary =
        entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
      const published =
        entry.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim() ?? "";
      const updated =
        entry.match(/<updated>([\s\S]*?)<\/updated>/)?.[1]?.trim() ?? "";

      const idRaw =
        entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() ?? "";
      const arxivId = idRaw.replace("http://arxiv.org/abs/", "");
      const pdfUrl = `https://arxiv.org/pdf/${arxivId}`;

      const authors: string[] = [];
      const authorRegex = /<author>\s*<name>([\s\S]*?)<\/name>/g;
      let authorMatch: RegExpExecArray | null;
      while ((authorMatch = authorRegex.exec(entry)) !== null) {
        authors.push(authorMatch[1].trim());
      }

      const categories: string[] = [];
      const catRegex = /<category[^>]*term="([^"]+)"/g;
      let catMatch: RegExpExecArray | null;
      while ((catMatch = catRegex.exec(entry)) !== null) {
        categories.push(catMatch[1]);
      }

      entries.push({
        title,
        authors,
        summary: summary.slice(0, MAX_SUMMARY_LENGTH),
        published,
        updated,
        arxivId,
        pdfUrl,
        categories,
      });
    }

    return NextResponse.json({
      query,
      totalResults: entries.length,
      papers: entries,
    });
  } catch (err) {
    console.error("ArXiv search error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to search arXiv",
      },
      { status: 500 },
    );
  }
}
