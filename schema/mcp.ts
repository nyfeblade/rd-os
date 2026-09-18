/**
 * HARD LAW 3 — research-before-claim + anti-shrink reject codes.
 * Portable MCP tool names. Runtime: bin/mcp.js (stdio) + bin/rdos.js.
 */

export type McpTool =
  | "experiment.open"
  | "experiment.record_actuals"
  | "envelope.query"
  | "envelope.record"
  | "plan.fanout"
  | "plan.accept"
  | "claim.submit"
  | "claim.verdict_draft"
  | "attention.dump"
  | "steer.gate";

export type RejectCode =
  | "MISSING_MACHINE_TIME"
  | "HUMAN_WEEK_WITHOUT_GATE"
  | "MISSING_ACTUALS"
  | "SINGLE_LANE"
  | "PROBE_NOT_FETCH_OR_RUN"
  | "NO_EVIDENCE_RECOMBINE"
  | "NO_ENVELOPE_QUERY"
  | "NOT_FINISHED"
  | "NO_RESEARCH"
  | "WEIGHT_ONLY"
  | "UNDER_SCOPE"
  | "SELF_CERT"
  | "NOT_HUMAN"
  | "UNKNOWN_TOOL";

export interface McpReject {
  ok: false;
  code: RejectCode;
  detail: string;
}

export interface McpOk<T> {
  ok: true;
  data: T;
}

export type McpResult<T> = McpOk<T> | McpReject;

export function assertNeverReject(code: never): never {
  throw new Error(`unhandled RejectCode: ${code}`);
}

export function assertNeverTool(tool: never): never {
  throw new Error(`unhandled McpTool: ${tool}`);
}

export function rejectWeightOnly(detail: string): McpReject {
  return { ok: false, code: "WEIGHT_ONLY", detail };
}

export function rejectUnderScope(detail: string): McpReject {
  return { ok: false, code: "UNDER_SCOPE", detail };
}
