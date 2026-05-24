"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import iplData from "@/data/iplData.json";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";

type Gender = "male" | "female" | "other";
type Pref = "male" | "female" | "both";
type Tonight = "KKR" | "DC";

type Profile = {
  name: string;
  ig: string;
  gender: Gender;
  pref: Pref;
  favTeam: string;
  favPlayerId: string;
  favPlayerName: string;
  tonightTeam: Tonight;
  createdAt: number;
};

type Stage = "form" | "submitting" | "match" | "empty" | "error";

type Team = { id: string; name: string; shortName: string; colors: { primary: string; secondary: string; text: string } };
type Player = { id: string; name: string; team: string; nickname?: string };

const LS_KEY = "criccoach.tinder.profile";

const sanitizeIg = (raw: string) => raw.replace(/[^a-zA-Z0-9._]/g, "").toLowerCase();

export default function TinderPage() {
  const [hydrated, setHydrated] = useState(false);
  const [stage, setStage] = useState<Stage>("form");
  const [errorMsg, setErrorMsg] = useState("");
  const [me, setMe] = useState<Profile | null>(null);
  const [match, setMatch] = useState<Profile | null>(null);

  // form state
  const [name, setName] = useState("");
  const [ig, setIg] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [pref, setPref] = useState<Pref | null>(null);
  const [favTeam, setFavTeam] = useState<string>("");
  const [favPlayerId, setFavPlayerId] = useState<string>("");
  const [tonightTeam, setTonightTeam] = useState<Tonight | null>(null);

  useEffect(() => {
    setHydrated(true);
    if (!isFirebaseConfigured) {
      setStage("error");
      setErrorMsg(
        "Firebase isn't configured. Set NEXT_PUBLIC_FIREBASE_* env vars on Vercel (or .env.local) and redeploy."
      );
      return;
    }
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Profile;
        if (parsed?.ig) {
          setMe(parsed);
          void findMatch(parsed);
        }
      } catch {
        // ignore corrupt cache
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredPlayers = useMemo<Player[]>(() => {
    const all = iplData.players as Player[];
    if (!favTeam) return all;
    return all.filter((p) => p.team === favTeam);
  }, [favTeam]);

  const canSubmit =
    name.trim().length >= 2 &&
    sanitizeIg(ig).length >= 2 &&
    gender !== null &&
    pref !== null &&
    favTeam !== "" &&
    favPlayerId !== "" &&
    tonightTeam !== null;

  async function findMatch(my: Profile) {
    setStage("submitting");
    try {
      const snap = await getDocs(collection(db, "tinder-profiles"));
      const all = snap.docs.map((d) => d.data() as Profile);
      const candidates = all.filter((p) => {
        if (!p?.ig) return false;
        if (p.ig.toLowerCase() === my.ig.toLowerCase()) return false;
        const iWantThem = my.pref === "both" || my.pref === p.gender;
        const theyWantMe = p.pref === "both" || p.pref === my.gender;
        if (!iWantThem || !theyWantMe) return false;
        return p.favTeam === my.favTeam || p.tonightTeam === my.tonightTeam;
      });
      if (candidates.length > 0) {
        candidates.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        setMatch(candidates[0]);
        setStage("match");
      } else {
        setMatch(null);
        setStage("empty");
      }
    } catch (e) {
      setStage("error");
      setErrorMsg(e instanceof Error ? e.message : "Couldn't reach the database.");
    }
  }

  async function submit() {
    if (!canSubmit) return;
    setStage("submitting");
    setErrorMsg("");
    const cleanIg = sanitizeIg(ig);
    const player = (iplData.players as Player[]).find((p) => p.id === favPlayerId);
    try {
      // Dedupe (case-insensitive)
      const snap = await getDocs(collection(db, "tinder-profiles"));
      const taken = snap.docs.some((d) => {
        const data = d.data() as Profile;
        return (data?.ig ?? "").toLowerCase() === cleanIg;
      });
      if (taken) {
        setStage("error");
        setErrorMsg(
          `@${cleanIg} is already taken. If that's you, tap "Reset profile" once you've found yourself, or pick another handle.`
        );
        return;
      }
      const profile: Profile = {
        name: name.trim(),
        ig: cleanIg,
        gender: gender!,
        pref: pref!,
        favTeam,
        favPlayerId,
        favPlayerName: player?.name ?? "",
        tonightTeam: tonightTeam!,
        createdAt: Date.now(),
      };
      await addDoc(collection(db, "tinder-profiles"), profile);
      localStorage.setItem(LS_KEY, JSON.stringify(profile));
      setMe(profile);
      await findMatch(profile);
    } catch (e) {
      setStage("error");
      setErrorMsg(e instanceof Error ? e.message : "Couldn't save profile.");
    }
  }

  function reset() {
    if (typeof window !== "undefined") window.localStorage.removeItem(LS_KEY);
    setMe(null);
    setMatch(null);
    setName("");
    setIg("");
    setGender(null);
    setPref(null);
    setFavTeam("");
    setFavPlayerId("");
    setTonightTeam(null);
    setErrorMsg("");
    setStage("form");
  }

  if (!hydrated) return <div className="min-h-screen bg-black" />;

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-black via-rose-950/60 to-purple-950/60 text-white">
      <FloatingHearts />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
        <div className="flex items-center justify-between">
          <Link href="/home" className="text-sm text-pink-200/70 hover:text-white">
            ← Home
          </Link>
          <span className="text-xs text-pink-200/60">Cricket Tinder</span>
        </div>

        <header className="mt-6 text-center">
          <div className="text-6xl drop-shadow-[0_0_30px_rgba(244,114,182,0.6)]">💘🏏</div>
          <h1 className="mt-2 bg-gradient-to-r from-pink-300 via-rose-300 to-purple-300 bg-clip-text font-heading text-3xl font-bold text-transparent">
            Cricket Tinder
          </h1>
          <p className="mt-1 text-sm text-pink-200/80">
            Find your soulmate at APL Gwalior tonight 💞
          </p>
        </header>

        <section className="mt-6 flex-1 pb-10">
          {stage === "form" && (
            <FormView
              name={name}
              setName={setName}
              ig={ig}
              setIg={setIg}
              gender={gender}
              setGender={setGender}
              pref={pref}
              setPref={setPref}
              favTeam={favTeam}
              setFavTeam={(id) => {
                setFavTeam(id);
                setFavPlayerId("");
              }}
              favPlayerId={favPlayerId}
              setFavPlayerId={setFavPlayerId}
              filteredPlayers={filteredPlayers}
              tonightTeam={tonightTeam}
              setTonightTeam={setTonightTeam}
              canSubmit={canSubmit}
              onSubmit={submit}
            />
          )}

          {stage === "submitting" && (
            <div className="rounded-2xl bg-white/5 px-6 py-12 text-center ring-1 ring-pink-300/20">
              <div className="text-5xl animate-pulse">💖</div>
              <p className="mt-3 text-pink-200">Searching the room…</p>
            </div>
          )}

          {stage === "match" && match && (
            <MatchView match={match} onReset={reset} />
          )}

          {stage === "empty" && me && <EmptyView me={me} onReset={reset} />}

          {stage === "error" && (
            <div className="rounded-2xl bg-rose-500/10 px-5 py-6 text-center ring-1 ring-rose-400/30">
              <div className="text-4xl">💔</div>
              <p className="mt-2 font-semibold text-rose-200">Hmm, something tripped</p>
              <p className="mt-1 text-sm text-rose-100/80">{errorMsg}</p>
              <button
                onClick={() => {
                  setErrorMsg("");
                  setStage("form");
                }}
                className="mt-4 rounded-full bg-rose-500/30 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500/50"
              >
                Try again
              </button>
            </div>
          )}
        </section>

        <footer className="pb-2 text-center text-[10px] text-pink-200/40">
          Built with 💘 at APL Gwalior 2026
        </footer>
      </div>
    </main>
  );
}

/* ---------------- Form ---------------- */

type FormProps = {
  name: string;
  setName: (s: string) => void;
  ig: string;
  setIg: (s: string) => void;
  gender: Gender | null;
  setGender: (g: Gender) => void;
  pref: Pref | null;
  setPref: (p: Pref) => void;
  favTeam: string;
  setFavTeam: (id: string) => void;
  favPlayerId: string;
  setFavPlayerId: (id: string) => void;
  filteredPlayers: Player[];
  tonightTeam: Tonight | null;
  setTonightTeam: (t: Tonight) => void;
  canSubmit: boolean;
  onSubmit: () => void;
};

function FormView(p: FormProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        p.onSubmit();
      }}
      className="space-y-5"
    >
      <Field label="Your name">
        <input
          type="text"
          value={p.name}
          onChange={(e) => p.setName(e.target.value)}
          placeholder="Anjali"
          maxLength={40}
          className="w-full rounded-xl border border-pink-300/30 bg-black/50 px-4 py-3 text-base text-white placeholder-pink-200/40 outline-none transition-colors focus:border-pink-400"
        />
      </Field>

      <Field label="Instagram handle">
        <div className="flex items-center gap-1 rounded-xl border border-pink-300/30 bg-black/50 px-3 py-2.5 transition-colors focus-within:border-pink-400">
          <span className="text-pink-300">@</span>
          <input
            type="text"
            value={p.ig}
            onChange={(e) => p.setIg(e.target.value)}
            placeholder="your.handle"
            maxLength={30}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 bg-transparent text-base text-white placeholder-pink-200/40 outline-none"
          />
        </div>
        {p.ig && (
          <div className="mt-1 text-xs text-pink-200/60">
            Will save as <span className="font-mono text-pink-300">@{sanitizeIg(p.ig)}</span>
          </div>
        )}
      </Field>

      <Field label="You are">
        <div className="grid grid-cols-3 gap-2">
          <Choice active={p.gender === "male"} onClick={() => p.setGender("male")}>👨 Male</Choice>
          <Choice active={p.gender === "female"} onClick={() => p.setGender("female")}>👩 Female</Choice>
          <Choice active={p.gender === "other"} onClick={() => p.setGender("other")}>✨ Other</Choice>
        </div>
      </Field>

      <Field label="Looking to match with">
        <div className="grid grid-cols-3 gap-2">
          <Choice active={p.pref === "male"} onClick={() => p.setPref("male")}>👨 Men</Choice>
          <Choice active={p.pref === "female"} onClick={() => p.setPref("female")}>👩 Women</Choice>
          <Choice active={p.pref === "both"} onClick={() => p.setPref("both")}>💞 Both</Choice>
        </div>
      </Field>

      <Field label="Favorite IPL team">
        <div className="grid grid-cols-5 gap-1.5">
          {(iplData.teams as Team[]).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => p.setFavTeam(t.id)}
              className={[
                "rounded-lg py-2.5 text-[11px] font-bold transition-all active:scale-95",
                p.favTeam === t.id
                  ? "ring-2 ring-pink-400 scale-105 shadow-lg shadow-pink-500/30"
                  : "ring-1 ring-white/10 opacity-80 hover:opacity-100",
              ].join(" ")}
              style={{ background: t.colors.primary, color: t.colors.text }}
            >
              {t.shortName}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Favorite player">
        <select
          value={p.favPlayerId}
          onChange={(e) => p.setFavPlayerId(e.target.value)}
          disabled={!p.favTeam}
          className="w-full appearance-none rounded-xl border border-pink-300/30 bg-black/50 px-4 py-3 text-base text-white outline-none transition-colors focus:border-pink-400 disabled:opacity-50"
        >
          <option value="">
            {p.favTeam ? "Pick a player…" : "Pick a team first"}
          </option>
          {p.filteredPlayers.map((pl) => (
            <option key={pl.id} value={pl.id} className="bg-black">
              {pl.name}{pl.nickname ? ` — ${pl.nickname.split(",")[0]}` : ""}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Tonight you're rooting for">
        <div className="grid grid-cols-2 gap-2">
          <TonightChoice
            active={p.tonightTeam === "KKR"}
            onClick={() => p.setTonightTeam("KKR")}
            label="KKR"
            sub="Kolkata"
            color="#3A225D"
          />
          <TonightChoice
            active={p.tonightTeam === "DC"}
            onClick={() => p.setTonightTeam("DC")}
            label="DC"
            sub="Delhi"
            color="#17449B"
          />
        </div>
      </Field>

      <button
        type="submit"
        disabled={!p.canSubmit}
        className="w-full rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-pink-500/30 transition-all hover:shadow-pink-500/60 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        💘 Find my match
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-pink-200/70">
        {label}
      </div>
      {children}
    </label>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl px-2 py-2.5 text-sm font-semibold transition-all active:scale-95",
        active
          ? "bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-md shadow-pink-500/40"
          : "bg-black/40 text-pink-100/80 ring-1 ring-pink-300/20 hover:ring-pink-300/40",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function TonightChoice({
  active,
  onClick,
  label,
  sub,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl py-4 text-lg font-bold text-white transition-all active:scale-95",
        active
          ? "ring-4 ring-pink-400 scale-[1.02] shadow-lg shadow-pink-500/40"
          : "ring-1 ring-white/10 opacity-80 hover:opacity-100",
      ].join(" ")}
      style={{ background: color }}
    >
      <div>{label}</div>
      <div className="text-xs font-medium opacity-80">{sub}</div>
    </button>
  );
}

/* ---------------- Match ---------------- */

function MatchView({ match, onReset }: { match: Profile; onReset: () => void }) {
  const team = (iplData.teams as Team[]).find((t) => t.id === match.favTeam);
  const onShare = () => {
    const text = `I matched with @${match.ig} at APL Gwalior 💘🏏`;
    if (typeof window !== "undefined") {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(text)}`,
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center text-sm font-semibold text-pink-200">
        It&apos;s a match! 💘
      </div>

      <div
        className="overflow-hidden rounded-3xl p-[2px] shadow-2xl shadow-pink-500/40"
        style={{
          background:
            "linear-gradient(135deg, #f472b6 0%, #ec4899 40%, #a855f7 100%)",
        }}
      >
        <div className="rounded-[22px] bg-black/75 p-6 backdrop-blur-sm">
          <div className="flex flex-col items-center">
            <div className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-3xl font-bold text-white shadow-lg shadow-pink-500/40">
              {match.name.charAt(0).toUpperCase()}
            </div>
            <h2 className="mt-3 text-2xl font-bold text-white">{match.name}</h2>
            <a
              href={`https://instagram.com/${match.ig}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-pink-300 hover:text-pink-200 hover:underline"
            >
              @{match.ig} ↗
            </a>
          </div>

          <div className="mt-5 space-y-2">
            <Row label="Loves">
              {team ? (
                <span
                  className="rounded px-2 py-0.5 text-xs font-bold"
                  style={{ background: team.colors.primary, color: team.colors.text }}
                >
                  {team.name}
                </span>
              ) : (
                <span className="text-white">{match.favTeam}</span>
              )}
            </Row>
            <Row label="Player crush">
              <span className="text-white">{match.favPlayerName || "—"}</span>
            </Row>
            <Row label="Rooting tonight">
              <span className="font-bold text-white">{match.tonightTeam}</span>
            </Row>
          </div>
        </div>
      </div>

      <button
        onClick={onShare}
        className="w-full rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-5 py-4 text-base font-bold text-white shadow-lg shadow-green-500/30 transition-all hover:shadow-green-500/50 active:scale-[0.98]"
      >
        📲 Share on WhatsApp
      </button>

      <button
        onClick={onReset}
        className="block w-full rounded-xl bg-white/5 px-4 py-2 text-xs text-pink-200/70 hover:text-white"
      >
        Reset profile
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
      <span className="text-[10px] uppercase tracking-wider text-pink-200/60">
        {label}
      </span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/* ---------------- Empty ---------------- */

function EmptyView({ me, onReset }: { me: Profile; onReset: () => void }) {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-pink-500/15 to-purple-500/15 p-8 text-center ring-1 ring-pink-300/30">
      <div className="text-6xl">🎉</div>
      <h2 className="mt-3 text-2xl font-bold text-white">
        You&apos;re the first one here!
      </h2>
      <p className="mt-2 text-sm text-pink-200/80">
        Hang tight, <span className="font-mono text-pink-300">@{me.ig}</span>. Share this URL with someone you like — they&apos;ll show up the moment they sign up.
      </p>
      <button
        onClick={onReset}
        className="mt-6 rounded-xl bg-white/5 px-4 py-2 text-xs text-pink-200/70 hover:text-white"
      >
        Reset profile
      </button>
    </div>
  );
}

/* ---------------- Background hearts ---------------- */

function FloatingHearts() {
  const hearts = ["💗", "💕", "💖", "💘", "💞", "❤️", "💓"];
  const items = Array.from({ length: 16 }, (_, i) => i);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((i) => (
        <span
          key={i}
          className="absolute animate-pulse opacity-30"
          style={{
            left: `${(i * 37 + 7) % 95}%`,
            top: `${(i * 23 + 11) % 95}%`,
            fontSize: `${14 + (i % 4) * 6}px`,
            animationDelay: `${i * 0.25}s`,
            animationDuration: `${2.2 + (i % 4) * 0.6}s`,
          }}
        >
          {hearts[i % hearts.length]}
        </span>
      ))}
    </div>
  );
}
