"use client";

import { Button } from "@/components/ui/button";

type Props = {
  text: string;
  className?: string;
};

export function ShareButton({ text, className }: Props) {
  const onClick = () => {
    const message = encodeURIComponent(`${text}\n\n— shared from CricCoach 🏏`);
    const url = `https://wa.me/?text=${message}`;
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Button
      onClick={onClick}
      className={className}
      size="lg"
      variant="default"
    >
      📲 Share on WhatsApp
    </Button>
  );
}
