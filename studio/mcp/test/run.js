#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const {
  createStudioMcpServer,
  encodeFramed,
  createFrameParser,
  TOOLS,
  PROVIDERS,
  PROVIDER_IDS,
  SERVER_INFO,
  CONNECT_ACK,
  PRODUCT_LOCK,
  HITL_OPS,
  permissionFor,
  assertMatrixComplete,
  listProviders,
  serverBinPath,
  attachEntry,
  attachConfig,
  attachConfigJson,
  preflight,
  probe,
} = require("..");
const { BOARD_GATES_TODO } = require("../lib/board");
const { providerFields } = require("../lib/providers");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const MCP_ROOT = path.resolve(__dirname, "..");
const BIN = path.join(MCP_ROOT, "server", "bin.js");

const GITHUB_STUB = {
  async readPrForBranch() {
    return { ok: true, data: null };
  },
  async readChecks() {
    return { ok: true, data: null };
  },
  async readReviews() {
    return { ok: true, data: null };
  },
};

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function measureGit(cwd) {
  const toplevel = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" });
  const branch = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd, encoding: "utf8" });
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" });
  if (toplevel.status !== 0 || branch.status !== 0 || head.status !== 0) {
    return { ok: false, detail: String(toplevel.stderr || branch.stderr || head.stderr || "git measure failed") };
  }
  let resolved = String(toplevel.stdout || "").trim();
  try {
    resolved = fs.realpathSync(resolved);
  } catch (_err) {
    resolved = path.resolve(resolved);
  }
  const name = String(branch.stdout || "").trim();
  return {
    ok: true,
    toplevel: resolved,
    branch: name === "HEAD" ? null : name,
    head: String(head.stdout || "").trim(),
  };
}

function boot(provider, extra) {
  const home = tmpDir("studio-mcp-seats-");
  const chatHome = tmpDir("studio-mcp-chat-");
  return createStudioMcpServer(
    Object.assign(
      {
        provider,
        home,
        chatHome,
        repo: ROOT,
        github: GITHUB_STUB,
      },
      extra || {}
    )
  );
}

async function initialize(server, extra) {
  return server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: Object.assign({ protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "studio-mcp-test" } }, extra || {}),
  });
}

function parseTool(message) {
  if (!message || !message.result) {
    return { ok: false, error: "missing result" };
  }
  const structured = message.result.structuredContent;
  if (structured && typeof structured === "object") {
    return structured;
  }
  if (message.result.content && message.result.content[0] && message.result.content[0].text) {
    return JSON.parse(message.result.content[0].text);
  }
  return { ok: false, error: "unreadable tool result" };
}

async function callTool(server, name, args, id) {
  return server.handleMessage({
    jsonrpc: "2.0",
    id: id == null ? 2 : id,
    method: "tools/call",
    params: { name, arguments: args || {} },
  });
}

function eq(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function runCase(name, fn) {
  try {
    const result = fn();
    if (result && result.ok === false && result.error) {
      return { name, ok: false, detail: result.error };
    }
    return { name, ok: true };
  } catch (err) {
    return { name, ok: false, detail: err && err.message ? err.message : String(err) };
  }
}

async function runCaseAsync(name, fn) {
  try {
    const result = await fn();
    if (result && result.ok === false && result.error) {
      return { name, ok: false, detail: result.error };
    }
    return { name, ok: true };
  } catch (err) {
    return { name, ok: false, detail: err && err.message ? err.message : String(err) };
  }
}

function expectOk(result, label) {
  if (!result || result.ok !== true) {
    return {
      ok: false,
      error: `${label || "result"} expected ok, got ${result && result.code} ${result && result.detail ? result.detail : ""}`.trim(),
    };
  }
  return { ok: true, data: result.data };
}

function expectCode(result, code, label) {
  if (!result || result.ok !== false || result.code !== code) {
    return {
      ok: false,
      error: `${label || "result"} expected ${code}, got ${result && result.ok ? "ok" : result && result.code} ${
        result && result.detail ? result.detail : ""
      }`.trim(),
    };
  }
  return { ok: true };
}

function stdioRoundtrip() {
  return new Promise((resolve) => {
    const home = tmpDir("studio-mcp-stdio-");
    const child = spawn(process.execPath, [BIN], {
      env: Object.assign({}, process.env, {
        STUDIO_PROVIDER: "cursor",
        STUDIO_HOME: home,
        STUDIO_REPO: ROOT,
        CHAT_ENGINE_HOME: path.join(home, "chat-engine"),
      }),
      stdio: ["pipe", "pipe", "pipe"],
    });
    let nextId = 1;
    const pending = new Map();
    const parser = createFrameParser((message) => {
      if (message && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
      }
    });
    child.stdout.on("data", (chunk) => parser.push(chunk));
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    function call(method, params) {
      const id = nextId;
      nextId += 1;
      return new Promise((okCall, bad) => {
        const timer = setTimeout(() => bad(new Error(`timeout ${method}`)), 8000);
        pending.set(id, (message) => {
          clearTimeout(timer);
          okCall(message);
        });
        child.stdin.write(encodeFramed({ jsonrpc: "2.0", id, method, params }));
      });
    }

    Promise.resolve()
      .then(async () => {
        const init = await call("initialize", {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "studio-mcp-stdio" },
        });
        if (!init.result || !init.result.serverInfo || init.result.serverInfo.name !== SERVER_INFO.name) {
          throw new Error(`initialize serverInfo ${JSON.stringify(init.result && init.result.serverInfo)}`);
        }
        if (!init.result.instructions || init.result.instructions.indexOf(CONNECT_ACK) < 0) {
          throw new Error("initialize missing connect ack");
        }
        const listed = await call("tools/list", {});
        const names = (listed.result.tools || []).map((tool) => tool.name);
        if (!eq(names, TOOLS.slice())) {
          throw new Error(`stdio tools/list ${names.join(",")}`);
        }
        const seats = await call("tools/call", { name: "studio.seats.list", arguments: {} });
        const body = JSON.parse(seats.result.content[0].text);
        if (!body.ok) {
          throw new Error(`stdio seats.list ${body.code} ${body.detail}`);
        }
        const cursor = body.data.seats.find((seat) => seat.id === "cursor");
        if (!cursor || cursor.presence !== "online" || cursor.in_studio_only !== true || cursor.cutover !== "attached") {
          throw new Error(`stdio cursor seat ${JSON.stringify(cursor)}`);
        }
        child.stdin.end();
        setTimeout(() => {
          try {
            child.kill("SIGTERM");
          } catch (_kill) {
            // already exited
          }
        }, 250);
        resolve({ ok: true });
      })
      .catch((err) => {
        try {
          child.kill("SIGTERM");
        } catch (_kill) {
          // ignore
        }
        resolve({ ok: false, error: `${err && err.message ? err.message : String(err)}${stderr ? ` stderr=${stderr.trim()}` : ""}` });
      });
  });
}

function hostBoot() {
  return new Promise((resolve) => {
    const home = tmpDir("studio-mcp-host-");
    const entry = attachEntry({ provider: "cursor", home, repo: ROOT });
    const command = entry.command === "node" ? process.execPath : entry.command;
    const child = spawn(command, entry.args, {
      env: Object.assign({}, process.env, entry.env, { CHAT_ENGINE_HOME: path.join(home, "chat-engine") }),
      stdio: ["pipe", "pipe", "pipe"],
    });
    let nextId = 1;
    const pending = new Map();
    const parser = createFrameParser((message) => {
      if (message && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
      }
    });
    child.stdout.on("data", (chunk) => parser.push(chunk));
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    function call(method, params) {
      const id = nextId;
      nextId += 1;
      return new Promise((okCall, bad) => {
        const timer = setTimeout(() => bad(new Error(`timeout ${method}`)), 8000);
        pending.set(id, (message) => {
          clearTimeout(timer);
          okCall(message);
        });
        child.stdin.write(encodeFramed({ jsonrpc: "2.0", id, method, params }));
      });
    }

    Promise.resolve()
      .then(async () => {
        const init = await call("initialize", {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "studio-mcp-host" },
        });
        if (!init.result || !init.result.serverInfo || init.result.serverInfo.name !== SERVER_INFO.name) {
          throw new Error(`host initialize serverInfo ${JSON.stringify(init.result && init.result.serverInfo)}`);
        }
        if (!init.result.instructions || init.result.instructions.indexOf(CONNECT_ACK) < 0) {
          throw new Error("host initialize missing connect ack");
        }
        const seats = await call("tools/call", { name: "studio.seats.list", arguments: {} });
        const body = JSON.parse(seats.result.content[0].text);
        const cursor = body.ok && body.data.seats.find((seat) => seat.id === "cursor");
        if (!cursor || cursor.presence !== "online" || cursor.in_studio_only !== true) {
          throw new Error(`host cursor seat ${JSON.stringify(cursor)}`);
        }
        child.stdin.end();
        setTimeout(() => {
          try {
            child.kill("SIGTERM");
          } catch (_kill) {
            // already exited
          }
        }, 250);
        resolve({ ok: true });
      })
      .catch((err) => {
        try {
          child.kill("SIGTERM");
        } catch (_kill) {
          // ignore
        }
        resolve({ ok: false, error: `${err && err.message ? err.message : String(err)}${stderr ? ` stderr=${stderr.trim()}` : ""}` });
      });
  });
}

async function cases() {
  const rows = [];

  rows.push(
    runCase("provider registry is the six coding-agent ids + labels only", () => {
      const listed = listProviders();
      if (!eq(listed.map((row) => row.id), ["claude", "grok", "cursor", "codex", "gemini", "chatgpt"])) {
        return { ok: false, error: `ids ${listed.map((row) => row.id).join(",")}` };
      }
      if (!eq(listed.map((row) => row.label), ["Claude", "Grok", "Cursor", "Codex", "Gemini", "ChatGPT"])) {
        return { ok: false, error: `labels ${listed.map((row) => row.label).join(",")}` };
      }
      for (const row of PROVIDERS) {
        const fields = providerFields(row);
        if (!eq(fields, ["id", "label"])) {
          return { ok: false, error: `${row.id} fields ${fields.join(",")}` };
        }
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("package.json has no dependencies (no community MCP wrappers)", () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(MCP_ROOT, "package.json"), "utf8"));
      if (pkg.dependencies && Object.keys(pkg.dependencies).length) {
        return { ok: false, error: `dependencies ${Object.keys(pkg.dependencies).join(",")}` };
      }
      if (pkg.devDependencies && Object.keys(pkg.devDependencies).length) {
        return { ok: false, error: `devDependencies ${Object.keys(pkg.devDependencies).join(",")}` };
      }
      const lock = fs.existsSync(path.join(MCP_ROOT, "package-lock.json"));
      if (lock) {
        return { ok: false, error: "package-lock.json present — this package must stay install-free" };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("permission matrix is complete and HITL ops are not listed tools", () => {
      assertMatrixComplete();
      for (const tool of TOOLS) {
        for (const id of PROVIDER_IDS) {
          const perm = permissionFor(id, tool);
          if (perm.kind !== "allow") {
            return { ok: false, error: `${tool} × ${id} = ${perm.kind}` };
          }
        }
      }
      for (const name of Object.keys(HITL_OPS)) {
        if (TOOLS.includes(name)) {
          return { ok: false, error: `${name} must not be in tools/list` };
        }
        for (const id of PROVIDER_IDS) {
          const perm = permissionFor(id, name);
          if (perm.kind !== "hitl") {
            return { ok: false, error: `${name} × ${id} = ${perm.kind}` };
          }
        }
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("unknown provider fails construct", () => {
      try {
        createStudioMcpServer({ provider: "luke", home: tmpDir("studio-mcp-bad-") });
        return { ok: false, error: "expected throw" };
      } catch (err) {
        if (!err || err.code !== "UNKNOWN_PROVIDER") {
          return { ok: false, error: `code ${err && err.code}` };
        }
        return { ok: true };
      }
    })
  );

  rows.push(
    await runCaseAsync("tools/list before initialize is NOT_CONNECTED", async () => {
      const server = boot("claude");
      const listed = await server.handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
      const body = parseTool(listed);
      return expectCode(body, "NOT_CONNECTED", "tools/list");
    })
  );

  rows.push(
    await runCaseAsync("initialize claude → online + attached + in-studio-only + ack", async () => {
      const server = boot("claude");
      const init = await initialize(server);
      if (!init.result || init.result.serverInfo.name !== SERVER_INFO.name) {
        return { ok: false, error: "bad initialize" };
      }
      if (!init.result.instructions || init.result.instructions.indexOf(CONNECT_ACK) < 0) {
        return { ok: false, error: "missing ack" };
      }
      const seat = server.session.studio.seats.get("claude");
      const checked = expectOk(seat, "seats.get");
      if (!checked.ok) {
        return checked;
      }
      if (checked.data.seat.presence !== "online") {
        return { ok: false, error: `presence ${checked.data.seat.presence}` };
      }
      if (checked.data.seat.cutover !== "attached" || checked.data.seat.in_studio_only !== true) {
        return { ok: false, error: `cutover ${checked.data.seat.cutover} in_studio_only=${checked.data.seat.in_studio_only}` };
      }
      if (checked.data.seat.kind !== "bot" || checked.data.seat.label !== "Claude") {
        return { ok: false, error: `kind/label ${checked.data.seat.kind} ${checked.data.seat.label}` };
      }
      return { ok: true };
    })
  );

  rows.push(
    await runCaseAsync("initialize chatgpt registers a non-seed seat and cutover-attaches", async () => {
      const server = boot("chatgpt");
      await initialize(server);
      const seat = expectOk(server.session.studio.seats.get("chatgpt"), "chatgpt");
      if (!seat.ok) {
        return seat;
      }
      if (seat.data.seat.presence !== "online" || seat.data.seat.in_studio_only !== true) {
        return { ok: false, error: JSON.stringify(seat.data.seat) };
      }
      const listed = expectOk(server.session.studio.seats.list(), "list");
      if (!listed.ok) {
        return listed;
      }
      if (!listed.data.seats.some((row) => row.id === "chatgpt")) {
        return { ok: false, error: "chatgpt missing from roster" };
      }
      return { ok: true };
    })
  );

  rows.push(
    await runCaseAsync("disconnect → offline; emit is SEAT_DISCONNECTED; cutover stays attached", async () => {
      const server = boot("gemini");
      await initialize(server);
      const gone = server.disconnect();
      const checked = expectOk(gone, "disconnect");
      if (!checked.ok) {
        return checked;
      }
      if (checked.data.seat.presence !== "offline") {
        return { ok: false, error: `presence ${checked.data.seat.presence}` };
      }
      if (checked.data.seat.cutover !== "attached" || checked.data.seat.in_studio_only !== true) {
        return { ok: false, error: "cutover dropped on disconnect" };
      }
      const spoke = server.session.studio.emit({ from: "gemini", dest: "room:bots", body: "should not leave the studio" });
      return expectCode(spoke, "SEAT_DISCONNECTED", "emit");
    })
  );

  rows.push(
    await runCaseAsync("tools/list after initialize is the closed five-tool surface", async () => {
      const server = boot("grok");
      await initialize(server);
      const listed = await server.handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
      const names = (listed.result.tools || []).map((tool) => tool.name);
      if (!eq(names, TOOLS.slice())) {
        return { ok: false, error: `tools ${names.join(",")}` };
      }
      return { ok: true };
    })
  );

  rows.push(
    await runCaseAsync("studio.seats.list roundtrip includes the connected provider", async () => {
      const server = boot("codex");
      await initialize(server);
      const listed = parseTool(await callTool(server, "studio.seats.list"));
      const checked = expectOk(listed, "seats.list");
      if (!checked.ok) {
        return checked;
      }
      if (checked.data.session_provider !== "codex" || checked.data.product_lock !== PRODUCT_LOCK) {
        return { ok: false, error: "session/product_lock missing" };
      }
      const codex = checked.data.seats.find((seat) => seat.id === "codex");
      if (!codex || codex.presence !== "online") {
        return { ok: false, error: `codex ${JSON.stringify(codex)}` };
      }
      return { ok: true };
    })
  );

  rows.push(
    await runCaseAsync("studio.seats.presence reports online_count and the session seat", async () => {
      const server = boot("claude");
      await initialize(server);
      const presence = parseTool(await callTool(server, "studio.seats.presence"));
      const checked = expectOk(presence, "presence");
      if (!checked.ok) {
        return checked;
      }
      if (checked.data.online_count < 1) {
        return { ok: false, error: `online_count ${checked.data.online_count}` };
      }
      const self = checked.data.presence.find((row) => row.id === "claude");
      if (!self || self.state !== "online" || self.in_studio_only !== true) {
        return { ok: false, error: JSON.stringify(self) };
      }
      const one = parseTool(await callTool(server, "studio.seats.presence", { id: "claude" }, 3));
      const oneOk = expectOk(one, "presence.get");
      if (!oneOk.ok) {
        return oneOk;
      }
      if (oneOk.data.state !== "online") {
        return { ok: false, error: `get state ${oneOk.data.state}` };
      }
      return { ok: true };
    })
  );

  rows.push(
    await runCaseAsync("studio.chat.snapshot is live chat-engine git, not a stub transcript", async () => {
      const measured = measureGit(ROOT);
      if (!measured.ok) {
        return { ok: false, error: measured.detail };
      }
      const server = boot("claude");
      await initialize(server);
      const snap = parseTool(await callTool(server, "studio.chat.snapshot"));
      const checked = expectOk(snap, "chat.snapshot");
      if (!checked.ok) {
        return checked;
      }
      if (checked.data.stub !== false || checked.data.source !== "studio/chat-engine") {
        return { ok: false, error: `stub/source ${checked.data.stub} ${checked.data.source}` };
      }
      if (checked.data.bind.git_root !== measured.toplevel) {
        return { ok: false, error: `git_root ${checked.data.bind.git_root} != ${measured.toplevel}` };
      }
      if (checked.data.snapshot.branch !== measured.branch) {
        return { ok: false, error: `branch ${checked.data.snapshot.branch} != ${measured.branch}` };
      }
      if (checked.data.snapshot.head !== measured.head) {
        return { ok: false, error: `head ${checked.data.snapshot.head} != ${measured.head}` };
      }
      if (!checked.data.assume_snapshot_truth || checked.data.assume_snapshot_truth.indexOf("do not ask") < 0) {
        return { ok: false, error: "missing assume_snapshot_truth" };
      }
      return { ok: true };
    })
  );

  rows.push(
    await runCaseAsync("studio.board.list_gates is an empty stub with a TODO, not planted gates", async () => {
      const server = boot("grok");
      await initialize(server);
      const gates = parseTool(await callTool(server, "studio.board.list_gates"));
      const checked = expectOk(gates, "board.list_gates");
      if (!checked.ok) {
        return checked;
      }
      if (checked.data.stub !== true || checked.data.status !== "BOARD_UNBOUND") {
        return { ok: false, error: `stub/status ${checked.data.stub} ${checked.data.status}` };
      }
      if (!Array.isArray(checked.data.gates) || checked.data.gates.length !== 0) {
        return { ok: false, error: `invented gates ${JSON.stringify(checked.data.gates)}` };
      }
      if (checked.data.todo !== BOARD_GATES_TODO) {
        return { ok: false, error: "TODO drifted" };
      }
      if (checked.data.verdict !== null || checked.data.clock_started !== false) {
        return { ok: false, error: "self-cert fields" };
      }
      return { ok: true };
    })
  );

  rows.push(
    await runCaseAsync("studio.repo.bind_info matches measured git toplevel + branch", async () => {
      const measured = measureGit(ROOT);
      if (!measured.ok) {
        return { ok: false, error: measured.detail };
      }
      const server = boot("cursor");
      await initialize(server);
      const bind = parseTool(await callTool(server, "studio.repo.bind_info"));
      const checked = expectOk(bind, "repo.bind_info");
      if (!checked.ok) {
        return checked;
      }
      if (checked.data.bound !== true) {
        return { ok: false, error: "not bound" };
      }
      if (checked.data.toplevel !== measured.toplevel) {
        return { ok: false, error: `toplevel ${checked.data.toplevel} != ${measured.toplevel}` };
      }
      if (checked.data.branch !== measured.branch) {
        return { ok: false, error: `branch ${checked.data.branch} != ${measured.branch}` };
      }
      const missing = parseTool(
        await callTool(server, "studio.repo.bind_info", { cwd: path.join(os.tmpdir(), "no-such-studio-mcp-repo") }, 3)
      );
      return expectCode(missing, "BIND_PATH_MISSING", "missing repo");
    })
  );

  rows.push(
    await runCaseAsync("HITL write names reject without being listed", async () => {
      const server = boot("claude");
      await initialize(server);
      for (const name of Object.keys(HITL_OPS)) {
        const result = parseTool(await callTool(server, name, {}, 20));
        const checked = expectCode(result, "HITL_REQUIRED", name);
        if (!checked.ok) {
          return checked;
        }
        if (result.hitl !== true) {
          return { ok: false, error: `${name} missing hitl flag` };
        }
      }
      const unknown = parseTool(await callTool(server, "studio.life.food", {}, 30));
      return expectCode(unknown, "UNKNOWN_TOOL", "life.food");
    })
  );

  rows.push(
    await runCaseAsync("every registry provider can call seats.list after its own connect", async () => {
      for (const id of PROVIDER_IDS) {
        const server = boot(id);
        await initialize(server);
        const listed = parseTool(await callTool(server, "studio.seats.list"));
        const checked = expectOk(listed, id);
        if (!checked.ok) {
          return checked;
        }
        const self = checked.data.seats.find((seat) => seat.id === id);
        if (!self || self.presence !== "online") {
          return { ok: false, error: `${id} not online in its own session` };
        }
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("host attach config resolves an absolute server/bin.js that exists", () => {
      const bin = serverBinPath();
      if (!path.isAbsolute(bin)) {
        return { ok: false, error: `bin not absolute: ${bin}` };
      }
      if (bin !== BIN) {
        return { ok: false, error: `bin ${bin} != ${BIN}` };
      }
      if (!fs.existsSync(bin)) {
        return { ok: false, error: `bin missing: ${bin}` };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("host attach entry is node + [absolute bin] + STUDIO_PROVIDER, no key paste", () => {
      const entry = attachEntry({ provider: "cursor" });
      if (entry.command !== "node") {
        return { ok: false, error: `command ${entry.command}` };
      }
      if (!eq(entry.args, [serverBinPath()])) {
        return { ok: false, error: `args ${JSON.stringify(entry.args)}` };
      }
      if (!eq(entry.env, { STUDIO_PROVIDER: "cursor" })) {
        return { ok: false, error: `env ${JSON.stringify(entry.env)}` };
      }
      const custom = attachEntry({ provider: "grok", command: "/opt/node/bin/node" });
      if (custom.command !== "/opt/node/bin/node") {
        return { ok: false, error: `command override ${custom.command}` };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("host attach env includes STUDIO_HOME/STUDIO_REPO only when provided", () => {
      const bare = attachEntry({ provider: "claude" });
      if ("STUDIO_HOME" in bare.env || "STUDIO_REPO" in bare.env) {
        return { ok: false, error: `bare env leaked ${JSON.stringify(bare.env)}` };
      }
      const full = attachEntry({ provider: "claude", home: "/tmp/studio", repo: "/repo" });
      if (full.env.STUDIO_HOME !== "/tmp/studio" || full.env.STUDIO_REPO !== "/repo") {
        return { ok: false, error: `full env ${JSON.stringify(full.env)}` };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("host attach config key defaults to the server name and is overridable", () => {
      const def = attachConfig({ provider: "codex" });
      const keys = Object.keys(def.mcpServers);
      if (!eq(keys, [SERVER_INFO.name])) {
        return { ok: false, error: `keys ${keys.join(",")}` };
      }
      const named = attachConfig({ provider: "codex", key: "studio" });
      if (!Object.prototype.hasOwnProperty.call(named.mcpServers, "studio")) {
        return { ok: false, error: `override keys ${Object.keys(named.mcpServers).join(",")}` };
      }
      const parsed = JSON.parse(attachConfigJson({ provider: "gemini" }));
      if (JSON.stringify(parsed) !== JSON.stringify(attachConfig({ provider: "gemini" }))) {
        return { ok: false, error: "attachConfigJson drifted from attachConfig" };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("host attach config rejects an unknown provider with UNKNOWN_PROVIDER", () => {
      try {
        attachConfig({ provider: "luke" });
        return { ok: false, error: "expected throw" };
      } catch (err) {
        if (!err || err.code !== "UNKNOWN_PROVIDER") {
          return { ok: false, error: `code ${err && err.code}` };
        }
        return { ok: true };
      }
    })
  );

  rows.push(
    await runCaseAsync("host-generated attach config boots the stdio server (initialize online)", async () => {
      return hostBoot();
    })
  );

  rows.push(
    runCase("host preflight passes for a known provider and flags an unknown one", () => {
      const good = preflight({ provider: "cursor", repo: ROOT });
      if (!good.ok || good.provider !== "cursor" || good.reasons.length !== 0) {
        return { ok: false, error: `good ${JSON.stringify(good)}` };
      }
      if (good.binPath !== serverBinPath()) {
        return { ok: false, error: `binPath ${good.binPath}` };
      }
      const bad = preflight({ provider: "luke" });
      if (bad.ok || bad.provider !== null || !bad.reasons.some((r) => r.indexOf("unknown provider") === 0)) {
        return { ok: false, error: `bad ${JSON.stringify(bad)}` };
      }
      return { ok: true };
    })
  );

  rows.push(
    await runCaseAsync("host probe self-tests the attach: online cursor seat then shuts down", async () => {
      const home = tmpDir("studio-mcp-probe-");
      const result = await probe({ provider: "cursor", home, repo: ROOT, timeoutMs: 8000 });
      if (!result.ok) {
        return { ok: false, error: `probe ${result.code} ${result.detail || ""}` };
      }
      if (result.provider !== "cursor" || result.online !== true) {
        return { ok: false, error: `probe result ${JSON.stringify(result)}` };
      }
      if (!result.seat || result.seat.presence !== "online" || result.seat.in_studio_only !== true) {
        return { ok: false, error: `probe seat ${JSON.stringify(result.seat)}` };
      }
      return { ok: true };
    })
  );

  rows.push(
    await runCaseAsync("host probe rejects an unknown provider without spawning", async () => {
      const result = await probe({ provider: "luke" });
      if (result.ok || result.code !== "UNKNOWN_PROVIDER") {
        return { ok: false, error: `expected UNKNOWN_PROVIDER, got ${JSON.stringify(result)}` };
      }
      return { ok: true };
    })
  );

  const HOST_CLI = path.join(MCP_ROOT, "host-cli.js");

  rows.push(
    runCase("host-cli config prints valid mcpServers JSON with the absolute bin", () => {
      const out = spawnSync(process.execPath, [HOST_CLI, "config", "--provider", "cursor", "--repo", ROOT], {
        encoding: "utf8",
      });
      if (out.status !== 0) {
        return { ok: false, error: `status ${out.status} stderr=${out.stderr}` };
      }
      let parsed;
      try {
        parsed = JSON.parse(out.stdout);
      } catch (err) {
        return { ok: false, error: `unparseable stdout: ${out.stdout}` };
      }
      const entry = parsed.mcpServers && parsed.mcpServers["ai-coding-studio"];
      if (!entry || entry.command !== "node" || !eq(entry.args, [BIN])) {
        return { ok: false, error: JSON.stringify(entry) };
      }
      if (entry.env.STUDIO_PROVIDER !== "cursor" || entry.env.STUDIO_REPO !== ROOT) {
        return { ok: false, error: JSON.stringify(entry.env) };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("host-cli config exits 2 on an unknown provider", () => {
      const out = spawnSync(process.execPath, [HOST_CLI, "config", "--provider", "luke"], { encoding: "utf8" });
      if (out.status !== 2) {
        return { ok: false, error: `status ${out.status}` };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("host-cli probe self-tests to exit 0 with an online seat", () => {
      const home = tmpDir("studio-mcp-cli-");
      const out = spawnSync(process.execPath, [HOST_CLI, "probe", "--provider", "cursor", "--home", home, "--repo", ROOT], {
        encoding: "utf8",
      });
      if (out.status !== 0) {
        return { ok: false, error: `status ${out.status} stderr=${out.stderr} stdout=${out.stdout}` };
      }
      let parsed;
      try {
        parsed = JSON.parse(out.stdout);
      } catch (err) {
        return { ok: false, error: `unparseable stdout: ${out.stdout}` };
      }
      if (!parsed.ok || parsed.provider !== "cursor" || parsed.online !== true) {
        return { ok: false, error: JSON.stringify(parsed) };
      }
      return { ok: true };
    })
  );

  rows.push(
    await runCaseAsync("stdio spawn: initialize + tools/list + seats.list roundtrip", async () => {
      return stdioRoundtrip();
    })
  );

  return rows;
}

async function main() {
  const started = Date.now();
  const rows = await cases();
  const passed = rows.filter((row) => row.ok).length;
  const failed = rows.filter((row) => !row.ok);
  const wallMs = Date.now() - started;
  const packet = {
    ok: failed.length === 0,
    module: "studio/mcp",
    instrument: "mcp.connect.tools",
    measured_exit: failed.length === 0 ? 0 : 1,
    expect_exit: 0,
    wall_ms: wallMs,
    cases: rows.length,
    passed,
    failed: failed.length,
    tools: TOOLS.slice(),
    providers: PROVIDER_IDS.slice(),
    clock_started: false,
    verdict: null,
    failures: failed.map((row) => ({ name: row.name, detail: row.detail })),
  };
  process.stdout.write(`${JSON.stringify(packet)}\n`);
  if (!packet.ok) {
    for (const row of failed) {
      process.stderr.write(`FAIL ${row.name}: ${row.detail}\n`);
    }
    process.stderr.write(
      `FAIL studio/mcp (measured; cases=${packet.cases} passed=${passed} failed=${failed.length}; wall_ms=${wallMs})\n`
    );
    process.exit(1);
  }
  process.stdout.write(
    `PASS studio/mcp (measured; cases=${packet.cases} passed=${passed} failed=0; wall_ms=${wallMs})\n`
  );
}

main();
