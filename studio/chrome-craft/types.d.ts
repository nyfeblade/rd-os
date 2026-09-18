export type StudioChromeEventId =
  | "ui.send"
  | "ui.need_you"
  | "ui.approve"
  | "ui.deny"
  | "ui.connect_ok"
  | "ui.error"
  | "ui.code_open"
  | "ui.expand"
  | "ui.craft_gen_done";

export type PlayReason = "invalid" | "missing_pack" | "invalid_pack" | "quiet" | "unbound" | "muted" | "cooldown" | "missing" | "error" | null;

export type PlayResult = {
  ok: true;
  played: boolean;
  reason: PlayReason;
  eventId: string | null;
};

export type PlayContext = {
  need_you?: boolean;
  muted?: boolean;
};

export type EventBinding = {
  file: string;
  gain: number;
  cooldown_ms: number;
  reduced_motion_mute: boolean;
};

export type LoadedPack = {
  ok: boolean;
  reason: string | null;
  id: string | null;
  events: Record<string, Partial<EventBinding> & { file?: string }>;
  patches: Record<string, unknown>;
  dir: string;
};

export type MotionEnv = {
  prefersReducedMotion?: boolean;
};

export type MotionSpec = {
  ms: number;
  maxMs: number;
  easing: "ease";
  bounce: false;
  instant: boolean;
  reducedMotion: boolean;
  transition: string;
  css: {
    transition: string;
    transitionDuration: string;
    transitionTimingFunction: string;
  };
};

export type Player = {
  play(eventId: string, context?: PlayContext): PlayResult;
  setMuted(value: boolean): boolean;
  isMuted(): boolean;
  setSfxDespiteReducedMotion(value: boolean): boolean;
  pack: LoadedPack;
  packDir: string;
};

export type CreatePlayerOptions = MotionEnv & {
  packDir?: string;
  packUrl?: string;
  pack?: LoadedPack;
  muted?: boolean;
  sfxDespiteReducedMotion?: boolean;
  now?: () => number;
  playAsset?: (src: string, gain: number) => void;
};

export const EVENT_IDS: StudioChromeEventId[];
export const REQUIRED_EVENTS: StudioChromeEventId[];
export const NEED_YOU_GATED: StudioChromeEventId[];
export const PACK_ID: "pack.studio.chrome.v1";
export const DEFAULT_PACK_DIR: string;

export const VISUAL_LOCK: {
  bg: "#ffffff";
  white: "#ffffff";
  slate: "#64748b";
  ink: "#111111";
  black: "#000000";
  line: "#e2e8f0";
};

export const motion: {
  CODE_DRAWER_MS: 180;
  NEED_YOU_EXPAND_MS: 80;
  CODE_DRAWER_MS_MAX: 180;
  NEED_YOU_EXPAND_MS_MAX: 100;
  EASING: "ease";
  BOUNCE: false;
  prefersReducedMotion(env?: MotionEnv): boolean;
  durationMs(ms: number, env?: MotionEnv): number;
  codeDrawer(env?: MotionEnv): MotionSpec;
  codeDrawerOpen(env?: MotionEnv): MotionSpec;
  codeDrawerClose(env?: MotionEnv): MotionSpec;
  needYouExpand(env?: MotionEnv): MotionSpec;
  apply(el: { style: { transition: string } } | null | undefined, motionSpec: MotionSpec): MotionSpec | undefined;
};

export function play(eventId: string, context?: PlayContext): PlayResult;
export function createPlayer(options?: CreatePlayerOptions): Player;
export function getDefaultPlayer(): Player;
export function resetDefaultPlayer(): void;
export function setMuted(value: boolean): boolean;
export function isMuted(): boolean;
export function setSfxDespiteReducedMotion(value: boolean): boolean;
export function loadPack(dir?: string): LoadedPack;
export function bindingOf(pack: LoadedPack, eventId: string): EventBinding | null;
export function assetPath(pack: LoadedPack, eventId: string): string | null;
export function assetUrl(pack: LoadedPack, eventId: string, packUrl?: string): string | null;
export function missingRequiredEvents(pack: LoadedPack): StudioChromeEventId[];
