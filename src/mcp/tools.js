"use strict";

/**
 * Stable CA2 tool names. Families: board / packet / lock / proof / gate / budget.
 * Extra payload fields are ignored. Missing required fields reject.
 */

const TOOLS = [
  "board.dump",
  "board.get",
  "board.set",
  "board.list_seats",
  "board.assign_seat",
  "packet.index",
  "packet.upsert",
  "lock.acquire",
  "lock.release",
  "proof.verdict",
  "gate.list",
  "gate.add",
  "gate.resolve",
  "budget.list",
  "budget.set",
  "budget.spend",
];

const MUTATORS = new Set([
  "board.set",
  "board.assign_seat",
  "packet.upsert",
  "lock.acquire",
  "lock.release",
  "proof.verdict",
  "gate.add",
  "gate.resolve",
  "budget.set",
  "budget.spend",
]);

const TOOL_SCHEMAS = {
  "board.dump": {
    description: "Read the control-plane dump (thesis, packets, locks, seats, budgets). Always succeeds.",
    inputSchema: { type: "object", properties: {} },
  },
  "board.get": {
    description: "Read the single ACTIVE thesis slot.",
    inputSchema: { type: "object", properties: {} },
  },
  "board.set": {
    description: "Write the ACTIVE thesis. Requires lock_token + idempotency_key. Rejects missing experiment_id/title.",
    inputSchema: {
      type: "object",
      properties: {
        experiment_id: { type: "string" },
        title: { type: "string" },
        kill: { type: "string" },
        instrument: { type: "string" },
        lock_token: { type: "string" },
        holder: { type: "string" },
        idempotency_key: { type: "string" },
      },
      required: ["experiment_id", "title", "idempotency_key"],
    },
  },
  "board.list_seats": {
    description: "List author|proof|human seats, optionally scoped to experiment_id.",
    inputSchema: {
      type: "object",
      properties: {
        experiment_id: { type: "string" },
      },
    },
  },
  "board.assign_seat": {
    description: "Assign seat role author|proof|human. Requires lock_token + idempotency_key.",
    inputSchema: {
      type: "object",
      properties: {
        experiment_id: { type: "string" },
        seat_actor: { type: "string" },
        assignee: { type: "string" },
        role: { type: "string" },
        lock_token: { type: "string" },
        holder: { type: "string" },
        idempotency_key: { type: "string" },
      },
      required: ["experiment_id", "role", "idempotency_key"],
    },
  },
  "packet.index": {
    description: "List packets on the control-plane index.",
    inputSchema: { type: "object", properties: {} },
  },
  "packet.upsert": {
    description:
      "Upsert an instrument packet. Weight-only / markdown / agent-set verdict reject. Requires lock_token + idempotency_key.",
    inputSchema: {
      type: "object",
      properties: {
        packet_id: { type: "string" },
        id: { type: "string" },
        experiment_id: { type: "string" },
        kind: { type: "string" },
        uri: { type: "string" },
        packet_uri: { type: "string" },
        evidence_uri: { type: "string" },
        runner_result: { type: "string" },
        packet: { type: "object" },
        body: { type: "string" },
        claim: { type: "string" },
        verdict: {},
        lock_token: { type: "string" },
        holder: { type: "string" },
        idempotency_key: { type: "string" },
      },
      required: ["experiment_id", "idempotency_key"],
    },
  },
  "lock.acquire": {
    description: "Acquire the one-writer board lock. Same holder refreshes. Second holder is LOCK_HELD.",
    inputSchema: {
      type: "object",
      properties: {
        resource: { type: "string" },
        holder: { type: "string" },
        idempotency_key: { type: "string" },
      },
      required: ["idempotency_key"],
    },
  },
  "lock.release": {
    description: "Release the board lock. Requires holder + lock_token + idempotency_key.",
    inputSchema: {
      type: "object",
      properties: {
        resource: { type: "string" },
        holder: { type: "string" },
        lock_token: { type: "string" },
        token: { type: "string" },
        idempotency_key: { type: "string" },
      },
      required: ["idempotency_key"],
    },
  },
  "proof.verdict": {
    description:
      "Set packet.verdict. Proof seat only. Author is SEAT_FORBIDDEN. Does not arm kill14d. Requires lock_token + idempotency_key.",
    inputSchema: {
      type: "object",
      properties: {
        experiment_id: { type: "string" },
        packet_id: { type: "string" },
        id: { type: "string" },
        verdict: { type: "string" },
        actor: { type: "string" },
        lock_token: { type: "string" },
        holder: { type: "string" },
        idempotency_key: { type: "string" },
      },
      required: ["experiment_id", "idempotency_key"],
    },
  },
  "gate.list": {
    description: "List human_gates[] recorded through gate.add. Agents may read.",
    inputSchema: {
      type: "object",
      properties: {
        experiment_id: { type: "string" },
      },
    },
  },
  "gate.add": {
    description: "Human only. Add a legal human gate kind. Agents receive NOT_HUMAN.",
    inputSchema: {
      type: "object",
      properties: {
        experiment_id: { type: "string" },
        kind: { type: "string" },
        reason: { type: "string" },
        estimate_human_hours: { type: "number" },
        idempotency_key: { type: "string" },
      },
      required: ["experiment_id", "kind", "idempotency_key"],
    },
  },
  "gate.resolve": {
    description: "Human only. Resolve an open human gate. Agents receive NOT_HUMAN.",
    inputSchema: {
      type: "object",
      properties: {
        experiment_id: { type: "string" },
        kind: { type: "string" },
        resolve: { type: "string" },
        reason: { type: "string" },
        idempotency_key: { type: "string" },
      },
      required: ["experiment_id", "idempotency_key"],
    },
  },
  "budget.list": {
    description: "List CA-hour / proof-minute budgets.",
    inputSchema: {
      type: "object",
      properties: {
        experiment_id: { type: "string" },
      },
    },
  },
  "budget.set": {
    description: "Set numeric ca_hours_budget and proof_min_budget. Requires lock_token + idempotency_key.",
    inputSchema: {
      type: "object",
      properties: {
        experiment_id: { type: "string" },
        ca_hours_budget: { type: "number" },
        proof_min_budget: { type: "number" },
        spent_ca_hours: { type: "number" },
        spent_proof_min: { type: "number" },
        lock_token: { type: "string" },
        holder: { type: "string" },
        idempotency_key: { type: "string" },
      },
      required: ["experiment_id", "ca_hours_budget", "proof_min_budget", "idempotency_key"],
    },
  },
  "budget.spend": {
    description:
      "Add spent CA hours / proof minutes. Over-budget is RESOURCE_EXHAUSTED (STOP, no retry). Requires lock_token + idempotency_key.",
    inputSchema: {
      type: "object",
      properties: {
        experiment_id: { type: "string" },
        ca_hours: { type: "number" },
        proof_min: { type: "number" },
        lock_token: { type: "string" },
        holder: { type: "string" },
        idempotency_key: { type: "string" },
      },
      required: ["experiment_id", "idempotency_key"],
    },
  },
};

function isMutator(tool) {
  return MUTATORS.has(tool);
}

function listToolDescriptors() {
  return TOOLS.map((name) => {
    const spec = TOOL_SCHEMAS[name];
    if (!spec) {
      throw new Error(`unhandled McpTool: ${name}`);
    }
    return {
      name,
      description: spec.description,
      inputSchema: spec.inputSchema,
    };
  });
}

module.exports = {
  TOOLS,
  MUTATORS,
  TOOL_SCHEMAS,
  isMutator,
  listToolDescriptors,
};
