export type Language = "english" | "hindi" | "hinglish" | "tamil";
export type Level = "new" | "casual" | "hardcore";

export type UserProfile = {
  teamId: string;
  language: Language;
  level: Level;
};

const KEY = "criccoach.profile";

export const LANGUAGE_LABELS: Record<Language, string> = {
  english: "English",
  hindi: "हिंदी",
  hinglish: "Hinglish",
  tamil: "தமிழ்",
};

export const LEVEL_LABELS: Record<Level, { emoji: string; label: string; sub: string }> = {
  new: { emoji: "🌱", label: "New Fan", sub: "Just getting into cricket" },
  casual: { emoji: "🎯", label: "Casual", sub: "Watch when I can" },
  hardcore: { emoji: "🔥", label: "Hardcore", sub: "I live and breathe cricket" },
};

export function saveProfile(profile: UserProfile): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(profile));
}

export function loadProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as UserProfile;
    if (parsed?.teamId && parsed?.language && parsed?.level) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function clearProfile(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
