import { baselinePlain, gatePlain, parseGate, whyPlain } from "./copy";

export type WaitingOn = "human" | "agent" | "proof";

export type AttentionP0 = {
  id: string;
  why: string;
  waiting_on: WaitingOn;
  age_s: number;
  title?: string;
};

export type EnvelopeHint = {
  nearest_experiment_id: string | null;
  baseline_ca_hours: number | null;
};

export type AttentionDump = {
  p0: AttentionP0 | null;
  hard_law: string[];
  open_gates: string[];
  envelope_hint: EnvelopeHint;
  items?: AttentionP0[];
};

export type WaitingItem = AttentionP0 & {
  p0: boolean;
};

export type ParseDumpResult =
  | { ok: true; dump: AttentionDump }
  | { ok: false; reason: string };

const WAITING_ON: readonly WaitingOn[] = ["human", "agent", "proof"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWaitingOn(value: unknown): value is WaitingOn {
  return typeof value === "string" && (WAITING_ON as readonly string[]).includes(value);
}

function parseItem(value: unknown): AttentionP0 | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.id !== "string" || typeof value.why !== "string") {
    return null;
  }
  if (!isWaitingOn(value.waiting_on)) {
    return null;
  }
  const age = typeof value.age_s === "number" ? value.age_s : Number(value.age_s);
  if (!Number.isFinite(age)) {
    return null;
  }
  const item: AttentionP0 = {
    id: value.id,
    why: value.why,
    waiting_on: value.waiting_on,
    age_s: age,
  };
  if (typeof value.title === "string") {
    item.title = value.title;
  }
  return item;
}

export function parseAttentionDump(raw: unknown): ParseDumpResult {
  if (!isRecord(raw)) {
    return { ok: false, reason: "attention.dump is not an object" };
  }
  if (!("p0" in raw) || !("hard_law" in raw)) {
    return { ok: false, reason: "attention.dump missing p0 or hard_law" };
  }

  let p0: AttentionP0 | null = null;
  if (raw.p0 !== null) {
    p0 = parseItem(raw.p0);
    if (!p0) {
      return { ok: false, reason: "attention.dump p0 is not a waiting row" };
    }
  }

  if (!Array.isArray(raw.hard_law) || raw.hard_law.some((id) => typeof id !== "string")) {
    return { ok: false, reason: "attention.dump hard_law is not a string list" };
  }

  const openGates = Array.isArray(raw.open_gates)
    ? raw.open_gates.filter((entry): entry is string => typeof entry === "string")
    : [];

  const hintRaw = isRecord(raw.envelope_hint) ? raw.envelope_hint : {};
  const envelope_hint: EnvelopeHint = {
    nearest_experiment_id:
      typeof hintRaw.nearest_experiment_id === "string" ? hintRaw.nearest_experiment_id : null,
    baseline_ca_hours:
      typeof hintRaw.baseline_ca_hours === "number" ? hintRaw.baseline_ca_hours : null,
  };

  let items: AttentionP0[] | undefined;
  if (Array.isArray(raw.items)) {
    items = [];
    for (const entry of raw.items) {
      const item = parseItem(entry);
      if (!item) {
        return { ok: false, reason: "attention.dump items has an invalid row" };
      }
      items.push(item);
    }
  }

  const dump: AttentionDump = {
    p0,
    hard_law: raw.hard_law as string[],
    open_gates: openGates,
    envelope_hint,
  };
  if (items) {
    dump.items = items;
  }
  return { ok: true, dump };
}

export function isIdleP0(p0: AttentionP0 | null): boolean {
  if (!p0) {
    return true;
  }
  if (p0.id === "idle") {
    return true;
  }
  return /board empty|no open experiment/i.test(p0.why);
}

export function waitingItems(dump: AttentionDump): WaitingItem[] {
  if (dump.items && dump.items.length > 0) {
    return dump.items.map((item, index) => ({ ...item, p0: index === 0 }));
  }
  if (isIdleP0(dump.p0) || !dump.p0) {
    return [];
  }
  return [{ ...dump.p0, p0: true }];
}

export function whatLabel(item: AttentionP0): string {
  return whyPlain(item.why, item.title);
}

export function waitingCaption(items: WaitingItem[]): string {
  const human = items.some((item) => item.waiting_on === "human");
  return human ? "Open items · sorted by urgency" : "Open items · no human gate";
}

export function waitingFoot(dump: AttentionDump, items: WaitingItem[]): string {
  const gates = dump.open_gates.map((entry) => parseGate(entry));
  const gateText = gates.length
    ? `Open gates: ${gates.map((gate) => `${gatePlain(gate.kind)} · ${gate.experiment_id}`).join(" · ")}`
    : "No open human gates";
  const human = items.some((item) => item.waiting_on === "human");
  const prefix = human || gates.length ? gateText : "No open human gates";
  return `${prefix} · ${baselinePlain(dump.envelope_hint)}`;
}

export function firstHuman(items: WaitingItem[]): WaitingItem | null {
  return items.find((item) => item.waiting_on === "human") || null;
}
