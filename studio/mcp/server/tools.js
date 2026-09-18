"use strict";

const { TOOLS, assertNeverTool, isToolName } = require("../lib/codes");

const TOOL_SCHEMAS = Object.freeze({
  "studio.seats.list": Object.freeze({
    description:
      "List Studio seats (bots + human operator). Connected coding-agent seats are in-studio-only after hard cutover.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["bot", "human"], description: "Optional seat kind filter." },
      },
      additionalProperties: false,
    },
  }),
  "studio.seats.presence": Object.freeze({
    description:
      "Presence roster for the eng surface: online | away | offline, in_studio_only, online_count.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Optional seat id. Omit for the full roster." },
      },
      additionalProperties: false,
    },
  }),
  "studio.chat.snapshot": Object.freeze({
    description:
      "Live chat-engine workspace snapshot for the bound repo (branch, dirty/clean, HEAD, recent commits). Not a chrome transcript. Assume snapshot truth — do not ask the human to paste diffs already here.",
    inputSchema: {
      type: "object",
      properties: {
        thread_id: { type: "string", description: "Existing chat-engine thread id." },
        repo: { type: "string", description: "Repo path to bind when no thread_id is given." },
      },
      additionalProperties: false,
    },
  }),
  "studio.board.list_gates": Object.freeze({
    description:
      "List Board gates / HITL pending cards. Currently unbound (empty contract + TODO). Does not invent gate rows. Merge/deploy/DB/public post still require HITL.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  }),
  "studio.repo.bind_info": Object.freeze({
    description: "Git bind for the working tree: toplevel and current branch when available.",
    inputSchema: {
      type: "object",
      properties: {
        cwd: { type: "string", description: "Path inside the work tree. Defaults to STUDIO_REPO / process cwd." },
      },
      additionalProperties: false,
    },
  }),
});

function listToolDescriptors(names) {
  return names.map((name) => {
    const spec = TOOL_SCHEMAS[name];
    if (!spec) {
      return assertNeverTool(name);
    }
    return {
      name,
      description: spec.description,
      inputSchema: spec.inputSchema,
    };
  });
}

function listAllToolDescriptors() {
  return listToolDescriptors(TOOLS);
}

function knownTool(name) {
  return isToolName(name);
}

module.exports = {
  TOOL_SCHEMAS,
  listToolDescriptors,
  listAllToolDescriptors,
  knownTool,
};
