(() => {
  const $ = (id) => document.getElementById(id);
  let state = null;
  let selectedId = null;

  const templates = {
    open: {
      experiment_id: "exp-drive",
      title: "Drive a new packet",
      estimate_ca_hours: 1.5,
      estimate_proof_min: 20,
      human_gates: [{ kind: "merge", reason: "playbook: human-owned merges" }],
      actuals: { ca_hours: null, proof_min: null, human_hours: null, finished_at: null },
      opened_n: 3,
      kill: "instrument packet + envelope query before ACCEPT",
      instrument: "apl prove",
    },
    fanout: {
      experiment_id: "",
      n: 3,
      probes: [
        { id: "p0", kind: "run", command_or_url: "npm run demo:reject" },
        { id: "p1", kind: "fetch", command_or_url: "https://github.com/nyfeblade/agent-proof-layer" },
        { id: "p2", kind: "run", command_or_url: "./scripts/stranger-check.sh" },
      ],
    },
    accept: {
      experiment_id: "",
      n: 3,
      no_baseline: true,
      probes: [
        { id: "p0", kind: "run", command_or_url: "npm run demo:reject", status: "ran", evidence_uri: "evidence/proof-layer" },
        { id: "p1", kind: "fetch", command_or_url: "https://github.com/nyfeblade/agent-proof-layer", status: "fetched", evidence_uri: "https://github.com/nyfeblade/agent-proof-layer" },
        { id: "p2", kind: "run", command_or_url: "./scripts/stranger-check.sh", status: "ran", evidence_uri: "scripts/stranger-check.sh" },
      ],
    },
    claim: {
      experiment_id: "",
      packet: {
        experiment_id: "",
        runner_result: "REJECTED",
        measured_exit: 1,
        verdict: null,
      },
    },
  };

  function render(next) {
    state = next;
    const experiments = next.experiments || [];
    const attention = next.attention || {};
    const thesis = attention.thesis || experiments[0] || null;
    selectedId = selectedId && experiments.some((exp) => exp.experiment_id === selectedId)
      ? selectedId
      : thesis && thesis.id
        ? thesis.id
        : experiments[0]
          ? experiments[0].experiment_id
          : null;
    const active = experiments.find((exp) => exp.experiment_id === selectedId) || null;

    $("top-meta").textContent = `MCP stdio · ${next.mcp ? next.mcp.command : "node bin/mcp.js"} · home ${next.home || "var"} · clock_started ${next.clock_started}`;

    $("board-list").innerHTML = experiments
      .map((exp) => {
        const cls = exp.experiment_id === selectedId ? "active" : "";
        return `<li class="${cls}"><button type="button" data-id="${escapeHtml(exp.experiment_id)}">${escapeHtml(exp.experiment_id)} · ${escapeHtml(exp.stage)}</button></li>`;
      })
      .join("") || "<li class='muted'>no packets</li>";

    $("envelope-list").innerHTML = (next.baselines || [])
      .map((row) => `<li>${escapeHtml(row.experiment_id)} · ${row.actuals_ca_hours ?? "NO_BASELINE"} CA-h</li>`)
      .join("") || "<li>NO_BASELINE</li>";

    $("thesis-title").textContent = active ? active.title : thesis ? thesis.title : "No open thesis";
    $("thesis-kill").textContent = active && active.kill ? active.kill : thesis && thesis.kill ? thesis.kill : "Open a packet with machine-time fields.";
    $("machine-time").innerHTML = active
      ? chip("ca-h", active.estimate_ca_hours) +
        chip("proof-min", active.estimate_proof_min) +
        chip("gates", (active.human_gates || []).length) +
        chip("instrument", active.instrument || "—") +
        chip("stage", active.stage)
      : "";

    const probes = active && active.fanout ? active.fanout.probes : [];
    $("lanes").innerHTML = probes.length
      ? probes.map((probe) => `<li>${escapeHtml(probe.id)} · ${escapeHtml(probe.kind)} · ${escapeHtml(probe.status || "pending")}<div class="muted">${escapeHtml(probe.command_or_url || "")}</div></li>`).join("")
      : "<li class='muted'>no fan-out yet</li>";

    $("evidence").innerHTML = (next.packets || [])
      .map((packet) => {
        const result = packet.runner_result || (packet.claim && packet.claim.runner_result) || "packet";
        const id = packet.experiment_id || (packet.claim && packet.claim.experiment_id) || "claim";
        return `<li>${escapeHtml(id)} · ${escapeHtml(result)} · verdict ${packet.verdict == null && (!packet.claim || packet.claim.verdict == null) ? "null" : "set"}</li>`;
      })
      .join("") || "<li class='muted'>no instrument packets</li>";

    const p0 = attention.p0 || { id: "idle", why: "", waiting_on: "agent" };
    $("p0-id").textContent = p0.id;
    $("p0-why").textContent = `${p0.why} · waiting_on ${p0.waiting_on} · ${p0.age_s || 0}s`;
    $("p0").className = `p0 waiting-${p0.waiting_on}`;

    $("hard-law").innerHTML = (attention.hard_law || []).map((id) => `<li>${escapeHtml(id)}</li>`).join("");
    const bottleneck = attention.bottleneck || p0;
    $("bottleneck").textContent = `${bottleneck.waiting_on}: ${bottleneck.why}`;
    $("redirect-note").textContent = attention.redirect ? attention.redirect.note : "Human steer only.";
    $("gates").innerHTML = (attention.open_gates || []).map((gate) => `<li>${escapeHtml(gate)}</li>`).join("") || "<li class='muted'>no open gates</li>";
    if (active) {
      $("steer-id").value = active.experiment_id;
    }
  }

  function chip(label, value) {
    return `<div class="chip">${escapeHtml(label)} ${escapeHtml(String(value))}</div>`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setPayload(value) {
    $("payload").value = JSON.stringify(value, null, 2);
  }

  function payload() {
    return JSON.parse($("payload").value || "{}");
  }

  async function post(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const json = await res.json();
    $("result").textContent = JSON.stringify(json, null, 2);
    return json;
  }

  async function refresh() {
    const res = await fetch("/api/state");
    render(await res.json());
  }

  $("board-list").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-id]");
    if (!button) {
      return;
    }
    selectedId = button.getAttribute("data-id");
    render(state);
  });

  $("btn-open").addEventListener("click", async () => {
    const body = $("payload").value.trim() ? payload() : templates.open;
    await post("/api/tool", { tool: "experiment.open", payload: body, actor: "agent" });
    await refresh();
  });
  $("btn-fanout").addEventListener("click", async () => {
    const body = payload();
    body.experiment_id = body.experiment_id || selectedId;
    await post("/api/tool", { tool: "plan.fanout", payload: body, actor: "agent" });
    await refresh();
  });
  $("btn-accept").addEventListener("click", async () => {
    const body = payload();
    body.experiment_id = body.experiment_id || selectedId;
    await post("/api/tool", { tool: "plan.accept", payload: body, actor: "agent" });
    await refresh();
  });
  $("btn-claim").addEventListener("click", async () => {
    const body = payload();
    body.experiment_id = body.experiment_id || selectedId;
    await post("/api/tool", { tool: "claim.submit", payload: body, actor: "agent" });
    await refresh();
  });
  $("btn-proof").addEventListener("click", async () => {
    $("result").textContent = "running npm run demo:reject…";
    await post("/api/proof-layer", {});
    await refresh();
  });

  $("steer-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await post("/api/steer", {
      experiment_id: $("steer-id").value,
      kind: $("steer-kind").value,
      reason: $("steer-reason").value,
    });
    await refresh();
  });
  $("btn-resolve").addEventListener("click", async () => {
    await post("/api/steer", {
      experiment_id: $("steer-id").value,
      resolve: $("steer-kind").value,
      kind: $("steer-kind").value,
      reason: $("steer-reason").value,
    });
    await refresh();
  });

  setPayload(templates.fanout);
  refresh();
  if (window.EventSource) {
    const stream = new EventSource("/api/stream");
    stream.addEventListener("attention", (event) => {
      render(JSON.parse(event.data));
    });
  }
})();
