"use client";

type Team = {
  id: string;
  name: string;
  shortName: string;
  tagline?: string;
  colors: { primary: string; secondary: string; text: string };
};

type Props = {
  team: Team;
  selected?: boolean;
  onClick?: () => void;
  showTagline?: boolean;
};

export function TeamCard({ team, selected, onClick, showTagline }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected ? true : undefined}
      style={{
        background: `linear-gradient(135deg, ${team.colors.primary}, ${team.colors.secondary})`,
        color: team.colors.text,
      }}
      className={[
        "group relative w-full overflow-hidden rounded-xl p-4 text-left transition-all",
        "ring-1 ring-white/10 shadow-md",
        "hover:scale-[1.02] hover:shadow-xl hover:ring-white/30",
        "active:scale-[0.98]",
        selected ? "ring-4 ring-[var(--gold)] scale-[1.02]" : "",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xl font-bold tracking-wide drop-shadow-sm">
          {team.shortName}
        </span>
        {selected && (
          <span
            className="rounded-full bg-[var(--gold)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black"
          >
            Picked
          </span>
        )}
      </div>
      <div className="mt-1 text-sm font-medium leading-tight opacity-95">
        {team.name}
      </div>
      {showTagline && team.tagline && (
        <div className="mt-2 text-xs italic opacity-80">&ldquo;{team.tagline}&rdquo;</div>
      )}
    </button>
  );
}
