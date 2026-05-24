import { NextResponse } from "next/server";

// Cache the upstream response so we don't burn through CricAPI free-tier quota
// (~100 hits/day). 60s is enough to feel live without hammering the API.
export const revalidate = 60;

type CricScoreItem = {
  id: string;
  dateTimeGMT: string;
  matchType: string;
  status: string;
  ms: "fixture" | "live" | "result";
  t1: string;
  t2: string;
  t1s: string;
  t2s: string;
  t1img?: string;
  t2img?: string;
  series: string;
};

export type LiveMatch = {
  id: string;
  status: string;
  matchType: string;
  team1: { name: string; short: string; score: string; img?: string };
  team2: { name: string; short: string; score: string; img?: string };
  series: string;
  dateTimeGMT: string;
  ms: "fixture" | "live" | "result";
};

function parseTeam(label: string): { name: string; short: string } {
  // CricAPI gives names like "Mumbai Indians [MI]" or just "Mumbai Indians"
  const m = label.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
  if (m) return { name: m[1].trim(), short: m[2].trim() };
  return { name: label.trim(), short: label.trim().slice(0, 3).toUpperCase() };
}

export async function GET() {
  const key = process.env.CRICAPI_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "CRICAPI_KEY not configured", live: [], upcoming: [] },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://api.cricapi.com/v1/cricScore?apikey=${key}`,
      { next: { revalidate: 60 } }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream ${res.status}`, live: [], upcoming: [] },
        { status: 200 }
      );
    }

    const json = (await res.json()) as { data?: CricScoreItem[] };
    const items = Array.isArray(json.data) ? json.data : [];

    const shape = (m: CricScoreItem): LiveMatch => {
      const t1 = parseTeam(m.t1);
      const t2 = parseTeam(m.t2);
      return {
        id: m.id,
        status: m.status,
        matchType: m.matchType,
        team1: { ...t1, score: m.t1s || "", img: m.t1img },
        team2: { ...t2, score: m.t2s || "", img: m.t2img },
        series: m.series,
        dateTimeGMT: m.dateTimeGMT,
        ms: m.ms,
      };
    };

    const live = items.filter((m) => m.ms === "live").slice(0, 6).map(shape);
    const upcoming = items
      .filter((m) => m.ms === "fixture")
      .sort((a, b) =>
        a.dateTimeGMT.localeCompare(b.dateTimeGMT)
      )
      .slice(0, 5)
      .map(shape);

    return NextResponse.json({ live, upcoming, fetchedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: message, live: [], upcoming: [] },
      { status: 200 }
    );
  }
}
