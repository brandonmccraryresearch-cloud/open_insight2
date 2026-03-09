import { NextResponse } from "next/server";
import { getHeaderData } from "@/lib/queries";
import { getRecentAutonomousActivityNeon } from "@/lib/neonPersistence";

export const dynamic = "force-dynamic";

/** Maximum Neon-sourced autonomous activity items to merge into notifications */
const NEON_NOTIFICATION_LIMIT = 5;

export async function GET() {
  try {
    const data = getHeaderData();

    // Merge Neon-sourced autonomous agent activity into notifications
    try {
      const neonActivity = await getRecentAutonomousActivityNeon(NEON_NOTIFICATION_LIMIT);
      let nextId = data.notifications.length + 1;
      for (const item of neonActivity) {
        // Skip if we already have a notification pointing to the same href
        if (data.notifications.some((n) => n.href === item.href)) continue;
        data.notifications.push({
          id: nextId++,
          title: item.title,
          forum: item.type === "debate_message" ? "Debates" : "Forums",
          time: item.timestamp,
          href: item.href,
        });
      }
    } catch {
      // Neon unavailable — serve SQLite-only notifications
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch notifications";
    return NextResponse.json({ error: message, liveDebates: 0, notifications: [] }, { status: 500 });
  }
}
