(() => {
  const copy = window.RdosCopy;
  const view = document.getElementById("view");
  const plate = document.getElementById("plate");
  const dialogRoot = document.getElementById("dialog-root");

  const settings = loadSettings();
  applySettings();

  let state = null;
  let loadError = null;
  let loading = true;
  let selected = 0;
  let filter = "";
  let flash = null;

  function loadSettings() {
    try {
      return {
        mute: true,
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        theme: "dark",
        ...JSON.parse(localStorage.getItem("rdos-settings") || "{}"),
      };
    } catch (_err) {
      return { mute: true, reducedMotion: false, theme: "dark" };
    }
  }

  function saveSettings() {
    localStorage.setItem("rdos-settings", JSON.stringify(settings));
    applySettings();
  }

  function applySettings() {
    document.documentElement.classList.toggle("reduce-motion", Boolean(settings.reducedMotion));
    document.documentElement.dataset.theme = settings.theme;
  }

  function beep(kind) {
    if (settings.mute || settings.reducedMotion) {
      return;
    }
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = kind === "reject" ? 140 : kind === "needs" ? 520 : 360;
    gain.gain.value = 0.03;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.07);
  }

  function parseRoute() {
    const path = window.location.pathname || "/";
    if (path === "/" || path === "/index.html") {
      return { name: "waiting" };
    }
    if (path === "/experiments") {
      return { name: "experiments" };
    }
    const detail = path.match(/^\/experiments\/([^/]+)$/);
    if (detail) {
      return { name: "detail", id: decodeURIComponent(detail[1]) };
    }
    if (path === "/history") {
      return { name: "history" };
    }
    if (path === "/settings") {
      return { name: "settings" };
    }
    return { name: "waiting" };
  }

  function go(path) {
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
    selected = 0;
    render();
    view.focus();
  }

  async function refresh() {
    loading = !state;
    try {
      const res = await fetch("/api/state");
      if (!res.ok) {
        throw new Error("board");
      }
      state = await res.json();
      loadError = null;
    } catch (_err) {
      loadError = "board";
    }
    loading = false;
    render();
  }

  function experiments() {
    return (state && state.experiments) || [];
  }

  function dump() {
    return (state && state.attention) || null;
  }

  function isEmptyBoard() {
    return experiments().length === 0;
  }

  function p0() {
    const d = dump();
    if (!d || !d.p0) {
      return null;
    }
    if (isEmptyBoard() || d.p0.id === "idle") {
      return null;
    }
    return d.p0;
  }

  function experimentById(id) {
    return experiments().find((exp) => exp.experiment_id === id) || null;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderNav(route) {
    document.querySelectorAll("[data-nav]").forEach((el) => {
      const current = el.getAttribute("data-nav") === route.name || (route.name === "detail" && el.getAttribute("data-nav") === "experiments");
      if (current) {
        el.setAttribute("aria-current", "page");
      } else {
        el.removeAttribute("aria-current");
      }
    });
  }

  function render() {
    const route = parseRoute();
    renderNav(route);
    if (loading) {
      view.innerHTML = `<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>`;
      return;
    }
    if (loadError || !state) {
      view.innerHTML = `<section class="error" data-testid="board-error"><h1>Can’t reach the board</h1><p class="muted">The lab did not return attention.dump. Nothing was invented.</p><div class="actions"><button type="button" id="retry">Retry</button></div></section>`;
      document.getElementById("retry").onclick = refresh;
      return;
    }
    switch (route.name) {
      case "waiting":
        view.innerHTML = waitingView();
        bindWaiting();
        break;
      case "experiments":
        view.innerHTML = experimentsView();
        bindList("/experiments");
        break;
      case "detail":
        view.innerHTML = detailView(route.id);
        bindDetail(route.id);
        break;
      case "history":
        view.innerHTML = historyView();
        break;
      case "settings":
        view.innerHTML = settingsView();
        bindSettings();
        break;
      default:
        view.innerHTML = waitingView();
        bindWaiting();
    }
    if (flash) {
      const node = document.createElement("p");
      node.className = flash.ok ? "flash ok" : "flash";
      node.textContent = flash.text;
      view.appendChild(node);
    }
  }

  function waitingView() {
    const top = p0();
    if (!top) {
      return `<section class="empty" data-testid="empty-waiting"><h1>Nothing waiting</h1><p>Nothing waiting. Open an experiment to start.</p><div class="actions"><button class="primary" type="button" id="cta-open" data-testid="cta-open">New experiment</button></div></section>`;
    }
    const others = experiments().filter((exp) => exp.experiment_id !== top.id && exp.stage !== "finished" && exp.stage !== "killed");
    const gates = (dump().open_gates || []).map((entry) => copy.parseGate(entry));
    const hint = dump().envelope_hint || {};
    const baseline =
      typeof hint.baseline_ca_hours === "number"
        ? `Last similar run: ${hint.baseline_ca_hours} CA hours`
        : "No baseline yet";
    let hero = "";
    if (top.waiting_on === "human") {
      plate.classList.add("needs-you-plate");
      hero = `<section class="hero needs-you" data-testid="needs-you">
        <div class="hero-top"><div class="hero-kicker">Needs you</div><div class="meta">${escapeHtml(copy.formatAge(top.age_s))}</div></div>
        <h1>${escapeHtml(copy.whyPlain(top.why))}</h1>
        <div class="actions">
          <button class="primary" type="button" id="btn-approve" data-testid="btn-approve">Approve</button>
          <button class="danger" type="button" id="btn-reject" data-testid="btn-reject">Reject</button>
          <button type="button" id="btn-details">Details</button>
        </div>
      </section>`;
    } else {
      plate.classList.remove("needs-you-plate");
      const cls = top.waiting_on === "proof" ? "proof" : "agent";
      const testid = top.waiting_on === "proof" ? "proof-waiting" : "agent-waiting";
      hero = `<section class="hero" data-testid="${testid}">
        <div class="hero-top"><div class="status ${cls}">${escapeHtml(copy.waitingRowLabel(top.waiting_on))}</div><div class="meta">${escapeHtml(copy.formatAge(top.age_s))}</div></div>
        <h1>${escapeHtml(copy.whyPlain(top.why))}</h1>
        <div class="actions"><button type="button" id="btn-details">Details</button></div>
      </section>`;
    }
    const flight = others
      .map((exp) => {
        const wait = exp.stage === "accepted" && (exp.human_gates || []).some((g) => g.kind === "merge" && !g.resolved) ? "human" : exp.stage === "open" || exp.stage === "fanout" ? "agent" : "proof";
        return `<button type="button" class="row" data-id="${escapeHtml(exp.experiment_id)}"><span>${escapeHtml(copy.waitingRowLabel(wait))}</span><span class="meta">${escapeHtml(exp.experiment_id)}</span></button>`;
      })
      .join("");
    const gateRows = gates
      .map((gate) => `<div class="row"><span>${escapeHtml(copy.gatePlain(gate.kind))} on ${escapeHtml(gate.experiment_id)}</span></div>`)
      .join("");
    return `${hero}
      ${flight ? `<h2>Also in flight</h2>${flight}` : ""}
      <h2>Open gates</h2>
      ${gateRows || `<p class="muted">None</p>`}
      <p class="muted" data-testid="baseline">${escapeHtml(baseline)}</p>`;
  }

  function bindWaiting() {
    const top = p0();
    const open = document.getElementById("cta-open");
    if (open) {
      open.onclick = () => openSheet();
    }
    const details = document.getElementById("btn-details");
    if (details && top) {
      details.onclick = () => go(`/experiments/${encodeURIComponent(top.id)}`);
    }
    const approve = document.getElementById("btn-approve");
    if (approve) {
      approve.onclick = () => confirmApprove();
    }
    const reject = document.getElementById("btn-reject");
    if (reject) {
      reject.onclick = () => openReject();
    }
    view.querySelectorAll(".row[data-id]").forEach((row) => {
      row.onclick = () => go(`/experiments/${encodeURIComponent(row.getAttribute("data-id"))}`);
    });
  }

  function experimentsView() {
    const rows = experiments().filter((exp) => {
      if (!filter) {
        return true;
      }
      const hay = `${exp.experiment_id} ${exp.title} ${exp.stage}`.toLowerCase();
      return hay.includes(filter.toLowerCase());
    });
    if (!experiments().length) {
      return `<section class="empty"><h1>No experiments</h1><p>Nothing waiting. Open an experiment to start.</p><div class="actions"><button class="primary" type="button" id="cta-open">New experiment</button></div></section>`;
    }
    const list = rows
      .map((exp, idx) => {
        const gates = (exp.human_gates || []).filter((gate) => !gate.resolved).length;
        const cls = idx === selected ? "row selected" : "row";
        return `<a class="${cls}" href="/experiments/${encodeURIComponent(exp.experiment_id)}"><span>${escapeHtml(exp.title || exp.experiment_id)} · ${escapeHtml(exp.stage)}</span><span class="meta">${escapeHtml(String(exp.estimate_ca_hours))}h · ${gates} gates</span></a>`;
      })
      .join("");
    return `<h1>Experiments</h1><input class="filter" id="filter" placeholder="Filter" value="${escapeHtml(filter)}" />
      <div data-testid="experiments-list">${list || `<p class="muted">No matches</p>`}</div>`;
  }

  function bindList() {
    const open = document.getElementById("cta-open");
    if (open) {
      open.onclick = () => openSheet();
    }
    const input = document.getElementById("filter");
    if (input) {
      input.oninput = (event) => {
        filter = event.target.value;
        render();
        const next = document.getElementById("filter");
        if (next) {
          next.focus();
          next.selectionStart = next.value.length;
        }
      };
    }
    view.querySelectorAll("a.row").forEach((row) => {
      row.onclick = (event) => {
        event.preventDefault();
        go(row.getAttribute("href"));
      };
    });
  }

  function detailView(id) {
    const exp = experimentById(id);
    if (!exp) {
      return `<section class="empty"><h1>Not on the board</h1><p class="muted">${escapeHtml(id)}</p></section>`;
    }
    const wait = dump() && dump().p0 && dump().p0.id === id ? dump().p0 : null;
    const probes = ((exp.fanout && exp.fanout.probes) || [])
      .map((probe) => `<div class="row"><span>${escapeHtml(probe.id)} · ${escapeHtml(probe.kind)} · ${escapeHtml(probe.status || "pending")}</span><span class="meta">${escapeHtml(probe.evidence_uri || probe.command_or_url || "")}</span></div>`)
      .join("");
    const claims = ((state && state.packets) || [])
      .filter((packet) => (packet.experiment_id || (packet.claim && packet.claim.experiment_id)) === id)
      .map((packet) => {
        const result = packet.runner_result || (packet.claim && packet.claim.runner_result) || "packet";
        return `<div class="row"><span>${escapeHtml(result)}</span><span class="meta">verdict ${packet.verdict == null ? "open" : "set"}</span></div>`;
      })
      .join("");
    const gates = (exp.human_gates || [])
      .map((gate) => `<div class="row"><span>${escapeHtml(copy.gatePlain(gate.kind))}${gate.resolved ? " · resolved" : ""}</span><span class="meta">${escapeHtml(gate.reason || "")}</span></div>`)
      .join("");
    const weeksBanned = !(exp.human_gates || []).length;
    return `<p class="muted"><a href="/experiments" id="back">Experiments</a></p>
      <h1>${escapeHtml(exp.title)}</h1>
      <p>${escapeHtml(wait ? copy.whyPlain(wait.why) : exp.stage)}</p>
      <h2>Time</h2>
      <p>${escapeHtml(String(exp.estimate_ca_hours))} CA hours · ${escapeHtml(String(exp.estimate_proof_min))} proof minutes${weeksBanned ? "" : ""}</p>
      <h2>Probes</h2>
      ${probes || `<p class="muted">None yet</p>`}
      <h2>Claims</h2>
      ${claims || `<p class="muted">No instrument packets</p>`}
      <h2>Gates</h2>
      ${gates || `<p class="muted">None</p>`}
      <div class="actions">
        <button class="primary" type="button" id="btn-approve">Approve</button>
        <button class="danger" type="button" id="btn-reject">Reject</button>
        <button type="button" id="btn-resolve">Resolve gate</button>
      </div>`;
  }

  function bindDetail(id) {
    const back = document.getElementById("back");
    if (back) {
      back.onclick = (event) => {
        event.preventDefault();
        go("/experiments");
      };
    }
    const approve = document.getElementById("btn-approve");
    if (approve) {
      approve.onclick = () => confirmApprove(id);
    }
    const reject = document.getElementById("btn-reject");
    if (reject) {
      reject.onclick = () => openReject(id);
    }
    const resolve = document.getElementById("btn-resolve");
    if (resolve) {
      resolve.onclick = () => human({ action: "approve", experiment_id: id });
    }
  }

  function historyView() {
    const rows = (state && state.baselines) || [];
    if (!rows.length) {
      return `<section class="empty" data-testid="empty-history"><h1>History</h1><p>No finished baselines yet.</p></section>`;
    }
    return `<h1>History</h1>${rows
      .map((row) => `<div class="row"><span>${escapeHtml(row.title || row.experiment_id)}</span><span class="meta">${escapeHtml(String(row.actuals_ca_hours))} CA hours</span></div>`)
      .join("")}`;
  }

  function settingsView() {
    return `<h1>Settings</h1>
      <label><input type="checkbox" id="set-mute" ${settings.mute ? "checked" : ""} /> Mute sounds</label>
      <label><input type="checkbox" id="set-motion" ${settings.reducedMotion ? "checked" : ""} /> Reduced motion</label>
      <h2>Rules</h2>
      <ol data-testid="rules">${copy.RULES_PLAIN.map((rule) => `<li>${escapeHtml(rule)}</li>`).join("")}</ol>
      <p class="muted">Product UI is a view of attention.dump. It does not store experiments.</p>`;
  }

  function bindSettings() {
    document.getElementById("set-mute").onchange = (event) => {
      settings.mute = event.target.checked;
      saveSettings();
    };
    document.getElementById("set-motion").onchange = (event) => {
      settings.reducedMotion = event.target.checked;
      saveSettings();
    };
  }

  function openSheet() {
    dialogRoot.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="New experiment">
      <form class="sheet-card" id="open-form">
        <h1>New experiment</h1>
        <label>Name<input name="title" required value="New experiment" /></label>
        <label>CA hours<input name="estimate_ca_hours" type="number" step="0.1" required value="1.5" /></label>
        <label>Proof minutes<input name="estimate_proof_min" type="number" required value="20" /></label>
        <div class="actions"><button class="primary" type="submit">Open</button><button type="button" id="cancel">Cancel</button></div>
      </form>
    </div>`;
    document.getElementById("cancel").onclick = closeDialog;
    document.getElementById("open-form").onsubmit = async (event) => {
      event.preventDefault();
      const data = new FormData(event.target);
      const payload = {
        experiment_id: `exp-${Date.now()}`,
        title: String(data.get("title")),
        estimate_ca_hours: Number(data.get("estimate_ca_hours")),
        estimate_proof_min: Number(data.get("estimate_proof_min")),
        human_gates: [{ kind: "merge", reason: "human-owned merge" }],
        actuals: { ca_hours: null, proof_min: null, human_hours: null, finished_at: null },
      };
      const result = await post("/api/tool", { tool: "experiment.open", payload, actor: "agent" });
      closeDialog();
      setFlash(result);
      await refresh();
    };
  }

  function confirmApprove(id) {
    const expId = id || (p0() && p0().id);
    const exp = experimentById(expId);
    const merge = exp && (exp.human_gates || []).some((gate) => gate.kind === "merge" && !gate.resolved);
    if (!merge) {
      human({ action: "approve", experiment_id: expId });
      return;
    }
    dialogRoot.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Confirm approve">
      <div class="sheet-card">
        <h1>Approve merge?</h1>
        <p>This clears the merge gate on the current packet.</p>
        <div class="actions">
          <button class="primary" type="button" id="confirm-approve">Approve</button>
          <button type="button" id="cancel">Cancel</button>
        </div>
      </div>
    </div>`;
    document.getElementById("cancel").onclick = closeDialog;
    document.getElementById("confirm-approve").onclick = () => {
      closeDialog();
      human({ action: "approve", experiment_id: expId });
    };
    document.getElementById("confirm-approve").focus();
  }

  function openReject(id) {
    const expId = id || (p0() && p0().id);
    const options = Object.entries(copy.REJECT_PLAIN)
      .map(([code, label]) => `<option value="${escapeHtml(code)}">${escapeHtml(label)}</option>`)
      .join("");
    dialogRoot.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Reject" data-testid="reject-sheet">
      <form class="sheet-card" id="reject-form">
        <h1>Reject</h1>
        <label>Reason<select name="code">${options}</select></label>
        <label>Constraint (optional)<input name="constraint" placeholder="Named physics or human constraint" /></label>
        <div class="actions"><button class="danger" type="submit">Reject</button><button type="button" id="cancel">Cancel</button></div>
      </form>
    </div>`;
    document.getElementById("cancel").onclick = closeDialog;
    document.getElementById("reject-form").onsubmit = (event) => {
      event.preventDefault();
      const data = new FormData(event.target);
      closeDialog();
      human({
        action: "reject",
        experiment_id: expId,
        code: String(data.get("code")),
        constraint: String(data.get("constraint") || ""),
      });
    };
  }

  function closeDialog() {
    dialogRoot.innerHTML = "";
  }

  async function human(body) {
    const result = await post("/api/human", body);
    setFlash(result);
    if (result.ok) {
      beep(body.action === "reject" ? "reject" : "ok");
    }
    await refresh();
  }

  function setFlash(result) {
    if (!result) {
      flash = null;
      return;
    }
    if (result.ok) {
      flash = { ok: true, text: "Saved" };
      return;
    }
    flash = { ok: false, text: copy.rejectPlain(result.code) };
  }

  async function post(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    return res.json();
  }

  function listRows() {
    return Array.from(view.querySelectorAll("a.row, button.row[data-id]"));
  }

  document.addEventListener("keydown", (event) => {
    const route = parseRoute();
    const dialog = dialogRoot.querySelector("[role=dialog]");
    if (event.key === "Escape") {
      if (dialog) {
        closeDialog();
        return;
      }
      if (route.name === "detail") {
        go("/experiments");
      }
      return;
    }
    if (event.key === "/" && route.name === "experiments" && document.activeElement.tagName !== "INPUT") {
      event.preventDefault();
      const input = document.getElementById("filter");
      if (input) {
        input.focus();
      }
      return;
    }
    if ((event.key === "Enter" || (event.key === "Enter" && (event.metaKey || event.ctrlKey))) && !dialog) {
      if (route.name === "waiting" && p0() && p0().waiting_on === "human" && document.activeElement.tagName !== "INPUT") {
        event.preventDefault();
        confirmApprove();
      }
    }
    if ((event.key === "j" || event.key === "k" || event.key === "ArrowDown" || event.key === "ArrowUp") && !dialog) {
      const rows = listRows();
      if (!rows.length) {
        return;
      }
      event.preventDefault();
      const dir = event.key === "j" || event.key === "ArrowDown" ? 1 : -1;
      selected = Math.max(0, Math.min(rows.length - 1, selected + dir));
      rows.forEach((row, idx) => row.classList.toggle("selected", idx === selected));
      rows[selected].focus();
    }
  });

  document.querySelector(".tabs").addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link) {
      return;
    }
    event.preventDefault();
    go(link.getAttribute("href"));
  });

  window.addEventListener("popstate", render);

  if (window.EventSource) {
    const stream = new EventSource("/api/stream");
    stream.addEventListener("attention", (event) => {
      state = JSON.parse(event.data);
      loadError = null;
      loading = false;
      render();
    });
  }

  refresh();
})();
