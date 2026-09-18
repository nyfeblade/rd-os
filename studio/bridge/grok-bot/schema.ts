/**
 * Grok Bot ↔ Studio bridge.
 * Shell one-click APIs. Elon aliases to provider grok.
 * Not a new Grok Bot. Not a CLI/MCP stranger path.
 */

import type { ConnectionRecord, HighRiskToolId, ImportedSeat, StudioResult } from "../../seats/schema";

export type GrokSeatAlias = "grok" | "elon";

export type BridgeActionApi = "importTeamRoster" | "connectGrokSeat" | "listImportableSeats";

export type StrangerPath = "ui_click";

export interface BridgeUiAction {
  id: string;
  label: string;
  api: BridgeActionApi;
  ids?: GrokSeatAlias[];
  seat?: null;
}

export interface BridgeUiContract {
  schema: "studio.bridge.grok-bot.ui/v1";
  stranger_path: StrangerPath;
  actions: BridgeUiAction[];
  alias: { elon: "grok" };
  provider: "grok";
  on_connect: {
    cutover: "hard";
    presence: "online";
    in_studio_only: true;
    hitl_still: HighRiskToolId[];
  };
}

export interface GrokConnection {
  connection: ConnectionRecord;
  provider: "grok";
  connected_at: string;
  tools_allowed: ConnectionRecord["tools_allowed"];
  cutover: true;
  in_studio_only: true;
  presence: "online" | "away";
  ack: string;
  alias: "elon" | null;
  hitl_still: HighRiskToolId[];
}

export type ImportTeamResult = StudioResult<{ seats: ImportedSeat[]; skipped: { id: string; label: string; reason: string }[]; count: number }>;

export function assertNeverAlias(id: never): never {
  throw new Error(`unhandled GrokSeatAlias: ${id}`);
}

export function assertNeverBridgeAction(api: never): never {
  throw new Error(`unhandled BridgeActionApi: ${api}`);
}
