/**
 * First-party AI Coding Studio MCP.
 * Coding agents connect in. Not a vendor-MCP wrapper. Not R&D OS kernel MCP.
 */

export type StudioProviderId = "claude" | "grok" | "cursor" | "codex" | "gemini" | "chatgpt";

export type StudioProvider = {
  id: StudioProviderId;
  label: string;
};

export type StudioMcpTool =
  | "studio.seats.list"
  | "studio.seats.presence"
  | "studio.chat.snapshot"
  | "studio.board.list_gates"
  | "studio.repo.bind_info";

export type HitlClass = "merge" | "deploy" | "db" | "public_post";

export type PermissionCell = "allow" | "deny" | "hitl";

export type StudioMcpRejectCode =
  | "UNKNOWN_PROVIDER"
  | "UNKNOWN_TOOL"
  | "NOT_CONNECTED"
  | "TOOL_FORBIDDEN"
  | "HITL_REQUIRED"
  | "BAD_ARGUMENTS"
  | "PROVIDER_MISMATCH";

export interface StudioMcpReject {
  ok: false;
  code: StudioMcpRejectCode | string;
  detail: string;
}

export interface StudioMcpOk<T> {
  ok: true;
  data: T;
}

export type StudioMcpResult<T> = StudioMcpOk<T> | StudioMcpReject;

export function assertNeverProvider(id: never): never {
  throw new Error(`unhandled StudioProviderId: ${id}`);
}

export function assertNeverTool(name: never): never {
  throw new Error(`unhandled StudioMcpTool: ${name}`);
}

export function assertNeverHitlClass(kind: never): never {
  throw new Error(`unhandled HitlClass: ${kind}`);
}

export function assertNeverReject(code: never): never {
  throw new Error(`unhandled StudioMcpRejectCode: ${code}`);
}

export function assertNeverPermission(cell: never): never {
  throw new Error(`unhandled PermissionCell: ${cell}`);
}
