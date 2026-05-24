type Props = {
  role: "user" | "ai";
  label?: string;
  children: React.ReactNode;
  loading?: boolean;
};

export function ChatBubble({ role, label, children, loading }: Props) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[90%]">
        {label && (
          <div
            className={`mb-1 text-[10px] font-bold uppercase tracking-wider ${
              isUser ? "text-right text-muted-foreground" : "text-[var(--gold)]"
            }`}
          >
            {label}
          </div>
        )}
        <div
          className={[
            "rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
            isUser
              ? "rounded-br-sm bg-[var(--gold)] text-black"
              : "rounded-bl-sm bg-card text-card-foreground ring-1 ring-white/10",
          ].join(" ")}
        >
          {loading ? <TypingDots /> : children}
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1">
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
    </span>
  );
}
