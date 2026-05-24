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
          <SectionLabel
            text="Live worldwide"
            badge={`${live.length}`}
            pulse
          />
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
  return (
    <div className="rounded-lg bg-card px-3 py-2 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
          {match.series}
        </span>
        {live && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">
            LIVE
          </span>
        )}
      </div>
      <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
        <TeamLine team={match.team1} />
        <TeamLine team={match.team2} align="right" />
      </div>
      <div className="mt-1.5 truncate text-xs text-muted-foreground">
        {match.status}
      </div>
    </div>
  );
}

function TeamLine({
  team,
  align,
}: {
  team: LiveMatch["team1"];
  align?: "right";
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-1.5 ${
        align === "right" ? "justify-end" : ""
      }`}
    >
      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold">
        {team.short}
      </span>
      <span className="truncate font-mono text-xs">{team.score || "—"}</span>
    </div>
  );
}
