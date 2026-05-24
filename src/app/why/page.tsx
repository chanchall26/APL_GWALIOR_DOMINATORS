"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import iplData from "@/data/iplData.json";
import { MatchHeader } from "@/components/MatchHeader";
import { ChatBubble } from "@/components/ChatBubble";
import { Button } from "@/components/ui/button";
import { loadProfile, type UserProfile } from "@/lib/userProfile";
import { buildWhyPrompt } from "@/lib/prompts";

type Msg = {
  id: string;
  role: "user" | "ai";
  label?: string;
  text: string;
  loading?: boolean;
};

type ApiLiveMatch = {
  id: string;
  status: string;
  matchType: string;
  team1: { name: string; short: string; score: string; img?: string };
  team2: { name: string; short: string; score: string; img?: string };
  series: string;
  dateTimeGMT: string;
  ms: "fixture" | "live" | "result";
};

const QUICK_QUESTIONS: { label: string; question: string }[] = [
  {
    label: "Explain Last Over",
    question:
      "Walk me through the last over in this match. What happened ball by ball, and why did it play out that way?",
  },
  {
    label: "Why this field?",
    question:
      "Look at the bowler in action and the current match situation. Why has the captain set the field this way? What is he trying to do?",
  },
  {
    label: "Who's the danger player?",
    question:
      "Of the two batters at the crease right now, who is the bigger threat to the bowling side and why?",
  },
  {
    label: "Predict next over",
    question:
      "Based on the bowler, the batters, and the match situation, what is most likely to happen in the next over? Give me a realistic over-by-over prediction.",
  },
];

export default function WhyPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pending, setPending] = useState(false);
  const [liveIpl, setLiveIpl] = useState<ApiLiveMatch | null>(null);

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
        const json = (await res.json()) as { live?: ApiLiveMatch[] };
        const ipl = (json.live ?? []).find((m) =>
          m.series.toLowerCase().includes("indian premier league")
        );
        if (!cancelled) setLiveIpl(ipl ?? null);
      } catch {
        // silent; mock fallback handles it
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Resolve teams for the active match (real if live, mock otherwise)
  const activeMatch = useMemo(() => {
    if (liveIpl) {
      const t1 = iplData.teams.find(
        (t) => t.shortName === liveIpl.team1.short || t.name === liveIpl.team1.name
      );
      const t2 = iplData.teams.find(
        (t) => t.shortName === liveIpl.team2.short || t.name === liveIpl.team2.name
      );
      return {
        source: "live" as const,
        team1: {
          shortName: liveIpl.team1.short,
          name: liveIpl.team1.name,
          score: liveIpl.team1.score || "Yet to bat",
          colors: t1?.colors,
        },
        team2: {
          shortName: liveIpl.team2.short,
          name: liveIpl.team2.name,
          score: liveIpl.team2.score || "Yet to bat",
          colors: t2?.colors,
        },
        venue: liveIpl.series,
        statusNote: liveIpl.status,
        // For prompt
        promptScore: `${liveIpl.team1.short} ${liveIpl.team1.score || "yet to bat"} · ${liveIpl.team2.short} ${liveIpl.team2.score || "yet to bat"}`,
        promptVenue: liveIpl.series,
        bowler: "(live feed — bowler not provided by data source)",
        batsmen: [`${liveIpl.team1.short}`, `${liveIpl.team2.short}`],
        lastSix: ["live", "data", "—", "ball", "by", "ball"],
      };
    }

    // Mock fallback (rich detail)
    const live = iplData.liveMatch;
    const mockT1 = iplData.teams.find((t) => t.id === live.team1.id);
    const mockT2 = iplData.teams.find((t) => t.id === live.team2.id);
    return {
      source: "mock" as const,
      team1: {
        shortName: mockT1?.shortName ?? live.team1.id,
        name: mockT1?.name ?? live.team1.name,
        score: `${live.team1.score}/${live.team1.wickets} (${live.team1.overs})`,
        colors: mockT1?.colors,
      },
      team2: {
        shortName: mockT2?.shortName ?? live.team2.id,
        name: mockT2?.name ?? live.team2.name,
        score:
          live.team2.overs > 0
            ? `${live.team2.score}/${live.team2.wickets} (${live.team2.overs})`
            : "Yet to bat",
        colors: mockT2?.colors,
      },
      venue: live.venue,
      statusNote: `Last 6: ${live.lastSixBalls.join(" · ")}  •  ${live.currentBowler.name} bowling`,
      promptScore: `${live.team1.score}/${live.team1.wickets} in ${live.team1.overs} overs`,
      promptVenue: live.venue,
      bowler: live.currentBowler.name,
      batsmen: live.currentBatsmen.map(
        (b) => `${b.name} (${b.runs} off ${b.balls})`
      ),
      lastSix: live.lastSixBalls,
    };
  }, [liveIpl]);

  if (!hydrated || !profile) {
    return <div className="min-h-screen bg-background" />;
  }

  const team = iplData.teams.find((t) => t.id === profile.teamId);

  const ask = async (label: string, question: string) => {
    if (pending) return;
    const id = `${Date.now()}`;
    const userMsg: Msg = { id: `${id}-u`, role: "user", label, text: question };
    const aiMsg: Msg = {
      id: `${id}-a`,
      role: "ai",
      label: "CricCoach",
      text: "",
      loading: true,
    };
    setMessages((m) => [aiMsg, userMsg, ...m]);
    setPending(true);

    try {
      const prompt = buildWhyPrompt({
        question,
        language: profile.language,
        level: profile.level,
        favoriteTeam: team?.name ?? profile.teamId,
        match: {
          team1: activeMatch.team1.name,
          team2: activeMatch.team2.name,
          venue: activeMatch.promptVenue,
          score: activeMatch.promptScore,
          lastSixBalls: activeMatch.lastSix,
          bowler: activeMatch.bowler,
          batsmen: activeMatch.batsmen,
        },
      });

      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      const text = data.text || data.error || "Couldn't fetch a response — try again.";
      setMessages((m) =>
        m.map((msg) =>
          msg.id === aiMsg.id ? { ...msg, text, loading: false } : msg
        )
      );
    } catch (e) {
      const errText = e instanceof Error ? e.message : "Network error";
      setMessages((m) =>
        m.map((msg) =>
          msg.id === aiMsg.id ? { ...msg, text: `Error: ${errText}`, loading: false } : msg
        )
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
      {/* Top nav */}
      <div className="flex items-center justify-between">
        <Link href="/home" className="text-sm text-muted-foreground hover:text-foreground">
          ← Home
        </Link>
        <span className="text-xs text-muted-foreground">Why Did That Happen?</span>
      </div>

      {/* Match card + data source pill */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Match in focus
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              activeMatch.source === "live"
                ? "bg-red-500/15 text-red-400"
                : "bg-white/10 text-muted-foreground"
            }`}
          >
            {activeMatch.source === "live" ? "● Live data" : "Mock data"}
          </span>
        </div>
        <MatchHeader
          status={activeMatch.source === "live" ? "LIVE" : "DEMO"}
          venue={activeMatch.venue}
          team1={activeMatch.team1}
          team2={activeMatch.team2}
          note={activeMatch.statusNote}
        />
      </div>

      {/* Primary CTA + quick actions */}
      <section className="mt-5">
        <Button
          size="lg"
          className="h-14 w-full text-base font-bold"
          onClick={() => ask(QUICK_QUESTIONS[0].label, QUICK_QUESTIONS[0].question)}
          disabled={pending}
        >
          {pending ? "Thinking..." : "🎙️  Explain Last Over"}
        </Button>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {QUICK_QUESTIONS.slice(1).map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => ask(q.label, q.question)}
              disabled={pending}
              className="rounded-lg bg-card px-3 py-2.5 text-sm font-medium ring-1 ring-white/10 transition-all hover:ring-[var(--gold)]/50 hover:bg-[var(--gold)]/5 active:scale-[0.98] disabled:opacity-50"
            >
              {q.label}
            </button>
          ))}
        </div>
      </section>

      {/* Chat thread (newest on top) */}
      <section className="mt-6 flex flex-1 flex-col gap-3 pb-6">
        {messages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-muted-foreground">
            Tap any button above. Your explanations will appear here.
          </div>
        ) : (
          messages.map((m) => (
            <ChatBubble key={m.id} role={m.role} label={m.label} loading={m.loading}>
              {m.text}
            </ChatBubble>
          ))
        )}
      </section>
    </main>
  );
}
