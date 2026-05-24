"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import iplData from "@/data/iplData.json";
import { MatchHeader } from "@/components/MatchHeader";
import { LiveScoreRail } from "@/components/LiveScoreRail";
import {
  clearProfile,
  loadProfile,
  LANGUAGE_LABELS,
  LEVEL_LABELS,
  type UserProfile,
} from "@/lib/userProfile";

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

type LiveResp = { live: LiveMatch[]; upcoming: LiveMatch[]; fetchedAt?: string };

export default function HomeDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [liveData, setLiveData] = useState<LiveResp | null>(null);

  useEffect(() => {
    setHydrated(true);
    const p = loadProfile();
    if (!p) {
      router.replace("/");
      return;
    }
    setProfile(p);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/cricket/live", { cache: "no-store" });
        const json = (await res.json()) as LiveResp;
        if (!cancelled) setLiveData(json);
      } catch {
        // silent — fallback UI handles it
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const heroLiveIpl = useMemo(() => {
    const matches = liveData?.live ?? [];
    return matches.find((m) =>
      m.series.toLowerCase().includes("indian premier league")
    );
  }, [liveData]);

  if (!hydrated || !profile) {
    return <div className="min-h-screen bg-background" />;
  }

  const team = iplData.teams.find((t) => t.id === profile.teamId);
  const hackathonMatch = iplData.upcomingMatches.find(
    (m) => (m as { isHackathonMatch?: boolean }).isHackathonMatch
  );
  const mockT1 = iplData.teams.find((t) => t.id === hackathonMatch?.team1);
  const mockT2 = iplData.teams.find((t) => t.id === hackathonMatch?.team2);

  // Map live IPL team short codes back to our seeded team data (for colors).
  const heroT1 =
    heroLiveIpl &&
    iplData.teams.find(
      (t) =>
        t.shortName === heroLiveIpl.team1.short ||
        t.name === heroLiveIpl.team1.name
    );
  const heroT2 =
    heroLiveIpl &&
    iplData.teams.find(
      (t) =>
        t.shortName === heroLiveIpl.team2.short ||
        t.name === heroLiveIpl.team2.name
    );

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
      {/* Profile chip + reset */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {team && (
            <span
              className="rounded px-2 py-1 text-xs font-bold"
              style={{ background: team.colors.primary, color: team.colors.text }}
            >
              {team.shortName}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {LANGUAGE_LABELS[profile.language]} · {LEVEL_LABELS[profile.level].label}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            clearProfile();
            router.push("/");
          }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Switch profile
        </button>
      </div>

      {/* Greeting */}
      <header className="mt-5">
        <h1 className="font-heading text-2xl font-bold">
          Hey {team?.shortName} fan! 👋
        </h1>
        {heroLiveIpl ? (
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-semibold text-red-400">● LIVE</span>{" "}
            {heroLiveIpl.team1.short} vs {heroLiveIpl.team2.short} — {heroLiveIpl.status}
          </p>
        ) : (
          hackathonMatch &&
          mockT1 &&
          mockT2 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {mockT1.shortName} take on {mockT2.shortName} at {hackathonMatch.venue.name} —{" "}
              {hackathonMatch.startTimeIST} 🏟️
            </p>
          )
        )}
      </header>

      {/* Hero match: real live IPL if available, else tonight's mock */}
      <div className="mt-4">
        {heroLiveIpl ? (
          <MatchHeader
            status="LIVE"
            venue={heroLiveIpl.series}
            team1={{
              shortName: heroLiveIpl.team1.short,
              name: heroLiveIpl.team1.name,
              score: heroLiveIpl.team1.score || "Yet to bat",
              colors: heroT1?.colors,
            }}
            team2={{
              shortName: heroLiveIpl.team2.short,
              name: heroLiveIpl.team2.name,
              score: heroLiveIpl.team2.score || "Yet to bat",
              colors: heroT2?.colors,
            }}
            note={heroLiveIpl.status}
          />
        ) : (
          hackathonMatch &&
          mockT1 &&
          mockT2 && (
            <MatchHeader
              status="TONIGHT"
              venue={`${hackathonMatch.venue.name}, ${hackathonMatch.venue.city}`}
              team1={{
                shortName: mockT1.shortName,
                name: mockT1.name,
                colors: mockT1.colors,
              }}
              team2={{
                shortName: mockT2.shortName,
                name: mockT2.name,
                colors: mockT2.colors,
              }}
              note={`Toss: ${hackathonMatch.toss.expectedDecision} · Favorite: ${hackathonMatch.prediction.favorite}`}
            />
          )
        )}
      </div>

      {/* Live worldwide rail (excludes the one already promoted to hero) */}
      <div className="mt-4">
        <LiveScoreRail excludeIds={heroLiveIpl ? [heroLiveIpl.id] : []} />
      </div>

      {/* Feature cards */}
      <section className="mt-6 flex flex-1 flex-col gap-4">
        <Link
          href="/why"
          className="group block overflow-hidden rounded-2xl bg-card p-5 ring-1 ring-white/10 transition-all hover:scale-[1.02] hover:ring-[var(--gold)]/50 hover:shadow-xl active:scale-[0.99]"
        >
          <div className="flex items-start gap-4">
            <div className="text-4xl">🤔</div>
            <div className="flex-1">
              <h2 className="font-heading text-xl font-bold">Why Did That Happen?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Get instant cricket explanations — in your language, at your level.
              </p>
            </div>
            <div className="text-[var(--gold)] transition-transform group-hover:translate-x-1">
              →
            </div>
          </div>
        </Link>

        <Link
          href="/roast"
          className="group block overflow-hidden rounded-2xl bg-card p-5 ring-1 ring-white/10 transition-all hover:scale-[1.02] hover:ring-[var(--gold)]/50 hover:shadow-xl active:scale-[0.99]"
        >
          <div className="flex items-start gap-4">
            <div className="text-4xl">🔥</div>
            <div className="flex-1">
              <h2 className="font-heading text-xl font-bold">Roast My Team</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                AI will burn anyone you want — instantly shareable on WhatsApp.
              </p>
            </div>
            <div className="text-[var(--gold)] transition-transform group-hover:translate-x-1">
              →
            </div>
          </div>
        </Link>
      </section>

      <footer className="mt-6 text-center text-xs text-muted-foreground">
        Built with Gemini + CricAPI · APL Gwalior 2026
      </footer>
    </main>
  );
}
