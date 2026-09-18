export type GateKind = "merge" | "deploy" | "db" | "public_post";

export type GateRisk = "high" | "low";

export type GateStatus = "open" | "approved" | "rejected" | "deferred";

export type GateDecision = "approve" | "reject" | "defer";

export type RejectCode =
  | "MISSING_FIELD"
  | "UNKNOWN_KIND"
  | "UNKNOWN_GATE"
  | "UNKNOWN_DECISION"
  | "HUMAN_REQUIRED"
  | "AUTO_APPROVE_FORBIDDEN"
  | "ALREADY_RESOLVED"
  | "INVALID_GATE";

/** Shell bind notes. Chat and Board own the ids. This kernel only stores them. */
export interface GateBindNotes {
  chat_thread_id: string | null;
  board_card_id: string | null;
}

export interface Gate {
  id: string;
  kind: GateKind;
  title: string;
  need_you: boolean;
  risk: GateRisk;
  payload_summary: string;
  status: GateStatus;
  created_at: string;
  binds: GateBindNotes;
}

export interface CreateGateInput {
  kind: GateKind;
  title: string;
  payload_summary?: string;
  binds?: Partial<GateBindNotes>;
  chat_thread_id?: string | null;
  board_card_id?: string | null;
}

export interface ResolveGateInput {
  id: string;
  decision: GateDecision;
  actor: "human";
  via?: "human";
}

export type HitlOk<T> = { ok: true; data: T };
export type HitlErr = { ok: false; code: RejectCode; detail: string };
export type HitlResult<T> = HitlOk<T> | HitlErr;

export interface HitlKernel {
  createGate(input: CreateGateInput): HitlResult<{ gate: Gate }>;
  listNeedYou(): HitlResult<{ gates: Gate[] }>;
  resolveGate(input: ResolveGateInput): HitlResult<{ gate: Gate }>;
  getGate(id: string): HitlResult<{ gate: Gate }>;
}

export function createHitlKernel(opts?: {
  clock?: { now(): number };
  ids?: { next(): string };
}): HitlKernel;

export const GATE_KINDS: readonly GateKind[];
export const HIGH_RISK_KINDS: readonly GateKind[];
export const GATE_STATUSES: readonly GateStatus[];
export const DECISIONS: readonly GateDecision[];
export const HUMAN_ACTOR: "human";
export const REJECT_CODES: { readonly [K in RejectCode]: K };

export function riskOf(kind: GateKind): GateRisk;
export function needYouOf(status: GateStatus): boolean;
export function isHighRiskKind(kind: GateKind): boolean;
