"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import iplData from "@/data/iplData.json";
import { TeamCard } from "@/components/TeamCard";
import { ShareButton } from "@/components/ShareButton";
import { Button } from "@/components/ui/button";
import { loadProfile, type UserProfile } from "@/lib/userProfile";
import { buildRoastPrompt } from "@/lib/prompts";

const COOK_LINES = [
  "Cooking the roast... 🔥",
  "Marinating the trauma... 🧂",
  "Adding extra masala... 🌶️",
  "Calling the comedy gods... 😈",
  "Pulling up old defeats... 📜",
];

export default function RoastPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [roast, setRoast] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [cookLine, setCookLine] = useState(COOK_LINES[0]);

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
    if (!loading) return;
    const id = setInterval(() => {
      setCookLine((c) => {
        const i = COOK_LINES.indexOf(c);
        return COOK_LINES[(i + 1) % COOK_LINES.length];
      });
    }, 900);
    return () => clearInterval(id);
  }, [loading]);

  if (!hydrated || !profile) {
    return <div className="min-h-screen bg-background" />;
  }

  const selectedTeam =
    selectedTeamId ? iplData.teams.find((t) => t.id === selectedTeamId) : null;
  const tableRow = selectedTeam
    ? iplData.pointsTable.find((r) => r.team === selectedTeam.id)
    : null;

  const cookRoast = async (teamId: string) => {
    const team = iplData.teams.find((t) => t.id === teamId);
    if (!team) return;
    const row = iplData.pointsTable.find((r) => r.team === team.id);
    setSelectedTeamId(teamId);
    setLoading(true);
    setRoast("");

    try {
      const prompt = buildRoastPrompt({
        language: profile.language,
        team: {
          name: team.name,
          shortName: team.shortName,
          captain: team.captain,
          titles: team.titles,
          tagline: team.tagline,
          formLast5: row?.form ?? [],
          seasonRecord: row
            ? `${row.won}W-${row.lost}L, rank ${row.rank}/10, NRR ${row.netRunRate}`
            : "No standings yet",
        },
      });

      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setRoast(data.text || data.error || "The AI choked. Try another team.");
    } catch (e) {
      const errText = e instanceof Error ? e.message : "Network error";
      setRoast(`Error: ${errText}`);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSelectedTeamId(null);
    setRoast("");
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
      {/* Top nav */}
      <div className="flex items-center justify-between">
        <Link href="/home" className="text-sm text-muted-foreground hover:text-foreground">
          ← Home
        </Link>
        <span className="text-xs text-muted-foreground">Roast My Team</span>
      </div>

      <header className="mt-4">
        <h1 className="font-heading text-2xl font-bold">
          Pick a team. <span className="text-[var(--gold)]">Watch them burn.</span> 🔥
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI roasts based on real IPL stats. Family-friendly, viciously funny.
        </p>
      </header>

      {/* Team grid */}
      {!selectedTeam && (
        <section className="mt-5 grid grid-cols-2 gap-3">
          {iplData.teams.map((t) => (
            <TeamCard
              key={t.id}
              team={t}
              onClick={() => cookRoast(t.id)}
              showTagline
            />
          ))}
        </section>
      )}

      {/* Roast display */}
      {selectedTeam && (
        <section className="mt-6 flex-1">
          <div
            className="overflow-hidden rounded-2xl p-1"
            style={{
              background: `linear-gradient(135deg, ${selectedTeam.colors.primary}, ${selectedTeam.colors.secondary})`,
            }}
          >
            <div className="rounded-[14px] bg-card p-5">
              <div className="flex items-center justify-between">
                <span
                  className="rounded px-2 py-1 text-sm font-bold"
                  style={{
                    background: selectedTeam.colors.primary,
                    color: selectedTeam.colors.text,
                  }}
                >
                  {selectedTeam.shortName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {tableRow ? `${tableRow.won}W · ${tableRow.lost}L` : ""} ·{" "}
                  {selectedTeam.titles} 🏆
                </span>
              </div>

              <div className="mt-4 min-h-[140px] text-base leading-relaxed whitespace-pre-wrap">
                {loading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <span className="size-2 animate-bounce rounded-full bg-[var(--gold)] [animation-delay:-0.3s]" />
                      <span className="size-2 animate-bounce rounded-full bg-[var(--gold)] [animation-delay:-0.15s]" />
                      <span className="size-2 animate-bounce rounded-full bg-[var(--gold)]" />
                    </span>
                    <span>{cookLine}</span>
                  </div>
                ) : (
                  roast
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          {!loading && roast && (
            <div className="mt-4 grid grid-cols-1 gap-2">
              <ShareButton
                text={`🔥 AI roast of ${selectedTeam.name}:\n\n${roast}`}
                className="h-12 w-full text-base font-bold"
              />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => cookRoast(selectedTeam.id)}
                  className="h-11"
                >
                  🔄 Roast Again
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={reset}
                  className="h-11"
                >
                  🎯 Another Team
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
