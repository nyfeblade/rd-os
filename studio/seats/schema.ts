/**
 * Studio seat registry — types the Chat pane imports.
 *
 * Distinct from CA1 control-plane seats (author|proof|human on an experiment).
 * Distinct from shell chrome (titlebar, connectors tray, pane splitters) —
 * this module feeds Chat (seats / rooms) only.
 * Layout lock: default chrome = Chat | Board. Code is on-demand. Three-pane-always is wrong.
 */

export type StudioSeatId = "grok" | "claude" | "cursor" | "human";

export type StudioSeatKind = "bot" | "human";

/** Designer presence dots: who's online in studio now. */
export type PresenceState = "online" | "away" | "offline";

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
  label: string;
  presence: PresenceState;
  cutover: CutoverState;
  /** Chat list pill — always true after cutover.attach / connect. */
  in_studio_only: boolean;
  connected_at: string | null;
  last_seen_at: string | null;
}

export interface StudioRoom {
  id: string;
  title: string;
  kind: RoomKind;
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

/**
 * Language the Chat pane renders. Not shell chrome.
 * Waiting-table-as-home is dead. Default chrome is Chat | Board.
 */
export interface ChatPaneHints {
  pane: "Chat";
  pane_role: "seats / rooms";
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
