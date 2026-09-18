export type ShellSettings = {
  mute: boolean;
  reducedMotion: boolean;
};

const KEY = "rdos-desktop-settings";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function loadSettings(): ShellSettings {
  const fallback: ShellSettings = {
    mute: true,
    reducedMotion: prefersReducedMotion(),
  };
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const stored = JSON.parse(window.localStorage.getItem(KEY) || "{}") as Partial<ShellSettings>;
    return {
      mute: stored.mute ?? fallback.mute,
      reducedMotion: stored.reducedMotion ?? fallback.reducedMotion,
    };
  } catch {
    return fallback;
  }
}

export function saveSettings(settings: ShellSettings): void {
  window.localStorage.setItem(KEY, JSON.stringify(settings));
  applySettings(settings);
}

export function applySettings(settings: ShellSettings): void {
  document.documentElement.classList.toggle("reduce-motion", settings.reducedMotion);
}
