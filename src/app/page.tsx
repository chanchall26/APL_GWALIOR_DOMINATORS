"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import iplData from "@/data/iplData.json";
import { TeamCard } from "@/components/TeamCard";
import { Button } from "@/components/ui/button";
import {
  saveProfile,
  loadProfile,
  LANGUAGE_LABELS,
  LEVEL_LABELS,
  type Language,
  type Level,
} from "@/lib/userProfile";

type Step = 1 | 2 | 3;

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const existing = loadProfile();
    if (existing) {
      router.replace("/home");
    }
  }, [router]);

  if (!hydrated) {
    return <div className="min-h-screen bg-background" />;
  }

  const finish = () => {
    if (!teamId || !language || !level) return;
    saveProfile({ teamId, language, level });
    router.push("/home");
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
      <header className="mb-6 text-center">
        <div className="text-4xl">🏏</div>
        <h1 className="mt-2 font-heading text-3xl font-bold">
          Meet your <span className="text-[var(--gold)]">AI cricket buddy</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A 30-second setup, then we tune everything to you.
        </p>
      </header>

      <Stepper step={step} />

      <section className="mt-6 flex-1">
        {step === 1 && (
          <StepShell
            title="Pick your team"
            subtitle="We'll cheer with you (and roast everyone else)."
          >
            <div className="grid grid-cols-2 gap-3">
              {iplData.teams.map((t) => (
                <TeamCard
                  key={t.id}
                  team={t}
                  selected={teamId === t.id}
                  onClick={() => setTeamId(t.id)}
                />
              ))}
            </div>
          </StepShell>
        )}

        {step === 2 && (
          <StepShell
            title="Pick your language"
            subtitle="We'll talk to you in this from now on."
          >
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(LANGUAGE_LABELS) as Language[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={[
                    "rounded-xl bg-card px-4 py-5 text-left transition-all",
                    "ring-1 ring-white/10 hover:ring-white/30 hover:scale-[1.02]",
                    "active:scale-[0.98]",
                    language === lang
                      ? "ring-2 ring-[var(--gold)] bg-[var(--gold)]/10"
                      : "",
                  ].join(" ")}
                >
                  <div className="text-xl font-bold">{LANGUAGE_LABELS[lang]}</div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                    {lang}
                  </div>
                </button>
              ))}
            </div>
          </StepShell>
        )}

        {step === 3 && (
          <StepShell
            title="How well do you know cricket?"
            subtitle="Be honest — we won't judge."
          >
            <div className="space-y-3">
              {(Object.keys(LEVEL_LABELS) as Level[]).map((lvl) => {
                const meta = LEVEL_LABELS[lvl];
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLevel(lvl)}
                    className={[
                      "flex w-full items-center gap-4 rounded-xl bg-card px-4 py-4 text-left transition-all",
                      "ring-1 ring-white/10 hover:ring-white/30 hover:scale-[1.01]",
                      "active:scale-[0.99]",
                      level === lvl ? "ring-2 ring-[var(--gold)] bg-[var(--gold)]/10" : "",
                    ].join(" ")}
                  >
                    <span className="text-3xl">{meta.emoji}</span>
                    <span className="flex-1">
                      <span className="block text-base font-bold">{meta.label}</span>
                      <span className="block text-xs text-muted-foreground">{meta.sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </StepShell>
        )}
      </section>

      <footer className="mt-6 flex items-center justify-between gap-3">
        {step > 1 ? (
          <Button
            variant="ghost"
            size="lg"
            onClick={() => setStep((s) => (s - 1) as Step)}
          >
            ← Back
          </Button>
        ) : (
          <span />
        )}

        {step < 3 ? (
          <Button
            size="lg"
            onClick={() => setStep((s) => (s + 1) as Step)}
            disabled={(step === 1 && !teamId) || (step === 2 && !language)}
            className="px-6"
          >
            Next →
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={finish}
            disabled={!level}
            className="px-6"
          >
            Get Started 🚀
          </Button>
        )}
      </footer>
    </main>
  );
}

function Stepper({ step }: { step: Step }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={[
            "h-1.5 w-10 rounded-full transition-all",
            n <= step ? "bg-[var(--gold)]" : "bg-white/15",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="font-heading text-xl font-semibold">{title}</h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">{subtitle}</p>
      {children}
    </div>
  );
}
