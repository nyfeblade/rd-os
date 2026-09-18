export type InstallState = "available" | "needs_auth" | "live" | "error";

export type EntryKind = "seat" | "connector" | "mcp";

export type MarketplaceTab = "connectors" | "seats" | "modes";

export type CatalogTier = "p0";

export type CostClass = "lean" | "normal" | "heavy";

export type HitlTier = "low" | "high-risk";

export type MarketplaceCommand = "install" | "connect" | "revoke";

export type MarketplaceRejectCode =
  | "UNKNOWN_ENTRY"
  | "UNKNOWN_TAB"
  | "UNKNOWN_COMMAND"
  | "CATALOG_INVALID"
  | "LIFE_OS_FORBIDDEN"
  | "STORE_CORRUPT";

export type BrowseFilter = "all" | "installed" | "available";

export type EmptyReason = "no_matches" | "empty_installed";

export type MarketplaceId =
  | "claude"
  | "grok"
  | "cursor"
  | "codex"
  | "gemini"
  | "chatgpt"
  | "github"
  | "slack"
  | "studio-mcp";

export interface CatalogEntry {
  id: MarketplaceId | string;
  kind: EntryKind;
  tab: MarketplaceTab;
  tier: CatalogTier;
  name: string;
  job: string;
  does: string;
  auth_required: boolean;
  cost_class: CostClass;
  two_way: boolean;
  hitl: HitlTier | null;
  tools_pointer: string;
}

export interface InstallRecord {
  state: InstallState;
  error: string | null;
  installed_at: string | null;
  updated_at: string | null;
}

export interface MarketplaceBadges {
  two_way: boolean;
  hitl: HitlTier | null;
  cost_class: CostClass;
  cutover: "in-studio-only" | null;
}

export interface MarketplaceEntry extends CatalogEntry {
  does: string;
  cutover: "in-studio-only" | null;
  state: InstallState;
  error: string | null;
  installed_at: string | null;
  updated_at: string | null;
  cta: string;
  actions: string[];
  badges: MarketplaceBadges;
}

export interface MarketplaceDump {
  schema: "studio.marketplace.dump/v1";
  product_lock: "eng_native_discover_install_manage";
  not: string[];
  tabs: MarketplaceTab[];
  connect_ack: string;
  legal_channel: "studio_room";
  cutover_label: "in-studio-only";
  chrome: "not-owned";
  empty_installed: string;
  no_matches: string;
  entries: MarketplaceEntry[];
  installed_count: number;
}

export interface MarketplaceReject {
  ok: false;
  code: MarketplaceRejectCode;
  detail: string;
}

export interface MarketplaceOk<T> {
  ok: true;
  data: T;
}

export type MarketplaceResult<T> = MarketplaceOk<T> | MarketplaceReject;

export function assertNeverInstallState(state: never): never {
  throw new Error(`unhandled InstallState: ${state}`);
}

export function assertNeverKind(kind: never): never {
  throw new Error(`unhandled EntryKind: ${kind}`);
}

export function assertNeverTab(tab: never): never {
  throw new Error(`unhandled MarketplaceTab: ${tab}`);
}

export function assertNeverCommand(command: never): never {
  throw new Error(`unhandled MarketplaceCommand: ${command}`);
}

export function assertNeverReject(code: never): never {
  throw new Error(`unhandled MarketplaceRejectCode: ${code}`);
}
