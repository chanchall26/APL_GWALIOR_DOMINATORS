"use client";

import { useEffect, useState } from "react";

type LiveMatch = {
  id: string;
  status: string;
  matchType: string;
  team1: { name: string; short: string; score: string; img?: string };
  team2: { name: string; short: string; score: string; img?: string };
  series: string;
  dateTimeGMT: string;
  ms: "fixture" | "live" | "result";
};

type Response = {
  live: LiveMatch[];
  upcoming: LiveMatch[];
  fetchedAt?: string;
  error?: string;
};

type Props = {
  excludeIds?: string[];
};

export function LiveScoreRail({ excludeIds = [] }: Props) {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/cricket/live", { cache: "no-store" });
        const json = (await res.json()) as Response;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData({ live: [], upcoming: [], error: "Network error" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const live = (data?.live ?? []).filter((m) => !excludeIds.includes(m.id));
  const upcoming = data?.upcoming ?? [];

  if (loading) {
    return (
      <div className="rounded-xl bg-card px-4 py-3 ring-1 ring-white/10 text-xs text-muted-foreground">
        Loading live scores…
      </div>
    );
  }

  if (live.length === 0 && upcoming.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {live.length > 0 && (
        <>
          <SectionLabel text="Live" badge={`${live.length}`} pulse />
          <div className="space-y-2">
            {live.map((m) => (
              <MatchRow key={m.id} match={m} live />
            ))}
          </div>
        </>
      )}

      {live.length === 0 && upcoming.length > 0 && (
        <>
          <SectionLabel text="Up next" />
          <div className="space-y-2">
            {upcoming.slice(0, 3).map((m) => (
              <MatchRow key={m.id} match={m} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SectionLabel({
  text,
  badge,
  pulse,
}: {
  text: string;
  badge?: string;
  pulse?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      {pulse && (
        <span className="relative inline-flex">
          <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
      )}
      <span>{text}</span>
      {badge && (
        <span className="rounded-full bg-white/10 px-1.5 py-px text-[10px] text-foreground/80">
          {badge}
        </span>
      )}
    </div>
  );
}

function MatchRow({ match, live }: { match: LiveMatch; live?: boolean }) {
  const matchType = (match.matchType || "").toUpperCase() || "MATCH";
  const t1rr = runRate(match.team1.score);
  const t2rr = runRate(match.team2.score);
  const elapsed = relativeTime(match.dateTimeGMT);

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-white/10">
      {/* Header: series + match type */}
      <div className="flex items-center justify-between gap-2 border-b border-white/5 bg-black/30 px-3 py-1.5">
        <span className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {match.series}
        </span>
        <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-foreground/80">
          {matchType}
        </span>
      </div>

      {/* Scoreboard */}
      <div className="space-y-1.5 px-3 py-2.5">
        <TeamRow team={match.team1} rr={t1rr} />
        <TeamRow team={match.team2} rr={t2rr} />
      </div>

      {/* Footer: live + status + elapsed */}
      <div className="flex items-center gap-2 border-t border-white/5 bg-black/20 px-3 py-1.5">
        {live && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-red-400">
            <span className="size-1 animate-pulse rounded-full bg-red-500" />
            Live
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {match.status}
        </span>
        {elapsed && (
          <span className="shrink-0 text-[10px] text-muted-foreground/70">
            {elapsed}
          </span>
        )}
      </div>
    </div>
  );
}

function TeamRow({
  team,
  rr,
}: {
  team: LiveMatch["team1"];
  rr: string | null;
}) {
  return (
    <div className="flex items-center gap-2">
      <TeamLogo team={team} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold leading-tight">{team.short}</div>
        <div className="truncate text-[10px] leading-tight text-muted-foreground">
          {team.name}
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-sm font-semibold text-foreground/95">
          {team.score || "—"}
        </div>
        {rr && (
          <div className="font-mono text-[10px] text-muted-foreground">
            RR {rr}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamLogo({ team }: { team: LiveMatch["team1"] }) {
  if (team.img) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={team.img}
        alt=""
        className="size-7 shrink-0 rounded bg-white/10 object-contain p-0.5"
        loading="lazy"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded bg-white/10 text-[10px] font-bold">
      {team.short.charAt(0)}
    </span>
  );
}

function parseScore(s: string): { runs: number; wkts: number; overs: number } | null {
  // Matches "36/1 (6)", "165/6 (16.5)", "287/3"
  const m = s.match(/^(\d+)\/(\d+)(?:\s*\(([\d.]+)\))?/);
  if (!m) return null;
  return {
    runs: parseInt(m[1], 10),
    wkts: parseInt(m[2], 10),
    overs: m[3] ? parseFloat(m[3]) : 0,
  };
}

function runRate(s: string): string | null {
  const p = parseScore(s);
  if (!p || p.overs <= 0) return null;
  // Convert "6.5" overs notation (6 overs + 5 balls) into decimal overs
  const wholeOvers = Math.floor(p.overs);
  const balls = Math.round((p.overs - wholeOvers) * 10);
  const decimalOvers = wholeOvers + balls / 6;
  if (decimalOvers <= 0) return null;
  return (p.runs / decimalOvers).toFixed(2);
}

function relativeTime(dateTimeGMT: string): string {
  if (!dateTimeGMT) return "";
  try {
    const start = new Date(dateTimeGMT).getTime();
    if (Number.isNaN(start)) return "";
    const now = Date.now();
    const diffMin = Math.round((now - start) / 60000);
    if (diffMin < -60) return `in ${Math.round(-diffMin / 60)}h`;
    if (diffMin < 0) return `in ${-diffMin}m`;
    if (diffMin < 60) return `${diffMin}m ago`;
    const h = Math.floor(diffMin / 60);
    return `${h}h ago`;
  } catch {
    return "";
  }
}
