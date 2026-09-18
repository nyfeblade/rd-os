/**
 * Eng surfaces: seats, rooms, hard cutover.
 * Bot↔bot in-studio for coding agents. Not a life-OS. Not CA1 packet seats.
 * Feeds Chat | Board default chrome. Code is on-demand. Three-pane-always is wrong.
 */

export type StudioSeatId = "grok" | "claude" | "cursor" | "human";

export type StudioSeatKind = "bot" | "human";

export type EngAgent = "coding_agent" | "human";

/** Who is on the eng surface now. */
export type PresenceState = "online" | "away" | "offline";

export type EngSurfaceName = "seat" | "room" | "cutover";

export type CutoverState = "attached" | "unattached";

export type RoomKind = "bot_bot" | "human_bot" | "studio_all";

export type DefaultPane = "Chat" | "Board";

export type OnDemandPane = "Code";

export type StudioPane = DefaultPane | OnDemandPane;

/** Default chrome. Code is not in this pair. */
export type DefaultChrome = ["Chat", "Board"];

/**
 * Speech channels a studio connector might attempt.
 * Only `studio_room` is legal after hard cutover.
 */
export type SpeechChannel =
  | "studio_room"
  | "luke_1to1"
  | "external_group"
  | "external_dm"
  | "external_connector";

export type CutoverRejectCode =
  | "CUTOVER_REQUIRED"
  | "CUTOVER_LOCKED"
  | "EXTERNAL_CHANNEL_FORBIDDEN"
  | "LUKE_1TO1_FORBIDDEN"
  | "SEAT_DISCONNECTED"
  | "ROOM_NOT_FOUND"
  | "SEAT_NOT_MEMBER"
  | "UNKNOWN_SEAT"
  | "UNKNOWN_ROOM_KIND"
  | "BAD_DESTINATION";

export interface StudioSeat {
  id: StudioSeatId;
  kind: StudioSeatKind;
  /** Bots are coding agents. Human is eng, not a life-OS persona. */
  agent: EngAgent;
  surface: "eng";
  label: string;
  presence: PresenceState;
  cutover: CutoverState;
  /** Pill — true after cutover.attach / connect. */
  in_studio_only: boolean;
  connected_at: string | null;
  last_seen_at: string | null;
}

export interface StudioRoom {
  id: string;
  title: string;
  kind: RoomKind;
  surface: "eng";
  member_seat_ids: StudioSeatId[];
  created_at: string;
}

export interface StudioMessage {
  id: string;
  room_id: string;
  from_seat: StudioSeatId;
  body: string;
  created_at: string;
}

export interface CutoverLock {
  protocol: "hard";
  product_lock: "connected_bots_speak_only_in_studio";
  attached_seat_ids: StudioSeatId[];
  legal_channel: "studio_room";
  forbidden_destinations: string[];
  /** Connecting a seat acknowledges this copy. */
  connect_ack: string;
  /** Chat-list chip on cutover seats. */
  in_studio_only_label: "in-studio-only";
}

export interface LayoutLock {
  default_chrome: DefaultChrome;
  code: "on-demand";
  three_pane_always: false;
}

export interface EngSurfaceLock {
  domain: "eng";
  life_os: false;
  purpose: "coding_agent_bot_bot";
  surfaces: EngSurfaceName[];
}

/**
 * Chat pane hosts the eng seat/room surface. Not life-OS chrome.
 */
export interface ChatPaneHints {
  pane: "Chat";
  pane_role: "eng seats / rooms";
  sibling_default: "Board";
  default_chrome: DefaultChrome;
  code: "on-demand";
  three_pane_always: false;
  in_studio_only_label: "in-studio-only";
  connect_ack: string;
  composer_placeholder: string;
  chrome: "not-owned";
}

export interface StudioDump {
  schema: "studio.seats.dump/v1";
  product_lock: "connected_bots_speak_only_in_studio";
  seats: StudioSeat[];
  rooms: StudioRoom[];
  messages: StudioMessage[];
  cutover: CutoverLock;
  layout: LayoutLock;
  eng: EngSurfaceLock;
  chat: ChatPaneHints;
  online_count: number;
}

export interface StudioReject {
  ok: false;
  code: CutoverRejectCode;
  detail: string;
}

export interface StudioOk<T> {
  ok: true;
  data: T;
}

export type StudioResult<T> = StudioOk<T> | StudioReject;

export function assertNeverSeatId(id: never): never {
  throw new Error(`unhandled StudioSeatId: ${id}`);
}

export function assertNeverSeatKind(kind: never): never {
  throw new Error(`unhandled StudioSeatKind: ${kind}`);
}

export function assertNeverPresence(state: never): never {
  throw new Error(`unhandled PresenceState: ${state}`);
}

export function assertNeverCutover(state: never): never {
  throw new Error(`unhandled CutoverState: ${state}`);
}

export function assertNeverRoomKind(kind: never): never {
  throw new Error(`unhandled RoomKind: ${kind}`);
}

export function assertNeverSpeechChannel(channel: never): never {
  throw new Error(`unhandled SpeechChannel: ${channel}`);
}

export function assertNeverReject(code: never): never {
  throw new Error(`unhandled CutoverRejectCode: ${code}`);
}

export function assertNeverPane(pane: never): never {
  throw new Error(`unhandled StudioPane: ${pane}`);
}
