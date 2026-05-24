type Side = {
  shortName: string;
  name: string;
  score?: string; // e.g. "168/7 (20.0)" or "Yet to bat"
  colors?: { primary: string; secondary: string };
};

type Props = {
  status: string; // "LIVE", "UPCOMING", etc.
  venue: string;
  team1: Side;
  team2: Side;
  note?: string; // last-over summary or kickoff time
};

export function MatchHeader({ status, venue, team1, team2, note }: Props) {
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-white/10">
      <div className="flex items-center justify-between px-4 py-2 text-xs">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            status === "LIVE"
              ? "bg-red-500/15 text-red-400"
              : "bg-[var(--gold)]/15 text-[var(--gold)]"
          }`}
        >
          {status === "LIVE" && (
            <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
          )}
          {status}
        </span>
        <span className="text-muted-foreground">{venue}</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pb-4 pt-1">
        <TeamSide side={team1} align="left" />
        <span className="text-xs font-bold uppercase text-muted-foreground">vs</span>
        <TeamSide side={team2} align="right" />
      </div>

      {note && (
        <div className="border-t border-white/5 bg-black/30 px-4 py-2 text-xs text-muted-foreground">
          {note}
        </div>
      )}
    </div>
  );
}

function TeamSide({ side, align }: { side: Side; align: "left" | "right" }) {
  return (
    <div className={align === "left" ? "text-left" : "text-right"}>
      <div className="flex items-center gap-2" style={align === "right" ? { justifyContent: "flex-end" } : {}}>
        {align === "right" && side.score && (
          <span className="font-mono text-sm text-foreground/90">{side.score}</span>
        )}
        <span
          className="inline-block rounded px-1.5 py-0.5 text-lg font-bold tracking-wide"
          style={
            side.colors
              ? {
                  background: side.colors.primary,
                  color: "#fff",
                }
              : undefined
          }
        >
          {side.shortName}
        </span>
        {align === "left" && side.score && (
          <span className="font-mono text-sm text-foreground/90">{side.score}</span>
        )}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{side.name}</div>
    </div>
  );
}
