(() => {
  const view = document.getElementById("view");
  const repoHead = document.getElementById("repo-head");
  const sourceMeta = document.getElementById("source-meta");
  const treeAside = document.getElementById("tree");
  const pane = document.getElementById("code-pane");

  const params = new URLSearchParams(window.location.search);
  const embed = params.get("embed") === "1";
  const forceDraw = params.get("draw") === "1";
  document.documentElement.dataset.embed = embed ? "1" : "0";
  if (pane) {
    pane.dataset.embed = embed ? "1" : "0";
    pane.dataset.draw = "on-demand";
    pane.dataset.defaultVisible = "false";
  }

  let drawn = !embed || forceDraw;

  let state = null;
  let tree = [];
  let rootTree = [];
  let pulls = [];
  let blob = null;
  let connectors = [];
  let loadError = null;
  let loading = true;
  let selected = 0;
  let flash = null;
  let surfaceFile = null;
  let surfacePr = null;

  function applyDrawn() {
    if (!pane) {
      return;
    }
    pane.dataset.drawn = drawn ? "1" : "0";
    pane.hidden = !drawn;
  }

  window.StudioGithub = {
    pane: "code",
    draw: "on-demand",
    defaultVisible: false,
    threePaneAlways: false,
    defaultChrome: ["chat", "board"],
    owns: ["repo-switcher", "file-tree", "file-preview", "pr-list", "connector-attach"],
    doesNotOwn: ["shell", "chat", "board", "titlebar", "presence", "connectors-tray"],
    mount(host) {
      if (!host) {
        return { ok: false, detail: "host required" };
      }
      host.setAttribute("data-pane", "code");
      document.dispatchEvent(new CustomEvent("studio:mount-code", { detail: { host } }));
      return window.StudioGithub.show();
    },
    show() {
      drawn = true;
      applyDrawn();
      document.dispatchEvent(new CustomEvent("studio:draw-code", { detail: { visible: true } }));
      refresh();
      return { ok: true, pane: "code", visible: true, draw: "on-demand" };
    },
    hide() {
      drawn = false;
      applyDrawn();
      document.dispatchEvent(new CustomEvent("studio:hide-code", { detail: { visible: false } }));
      return { ok: true, pane: "code", visible: false, draw: "on-demand" };
    },
    hooks: {
      openFile(filePath) {
        document.dispatchEvent(new CustomEvent("studio:open-file", { detail: { path: filePath } }));
      },
      openPull(number) {
        document.dispatchEvent(new CustomEvent("studio:open-pr", { detail: { number } }));
      },
      attach(id) {
        document.dispatchEvent(new CustomEvent("studio:attach", { detail: { id } }));
      },
    },
  };

  function parseRoute() {
    const pathName = window.location.pathname || "/";
    if (pathName === "/" || pathName === "/code" || pathName === "/index.html" || pathName === "/surface") {
      return { name: "code", dir: "" };
    }
    const treeMatch = pathName.match(/^\/tree\/(.*)$/);
    if (treeMatch) {
      return { name: "code", dir: decodeURIComponent(treeMatch[1]) };
    }
    const blobMatch = pathName.match(/^\/blob\/(.*)$/);
    if (blobMatch) {
      return { name: "blob", path: decodeURIComponent(blobMatch[1]) };
    }
    if (pathName === "/pulls") {
      return { name: "pulls" };
    }
    if (pathName === "/connectors") {
      return { name: "connectors" };
    }
    return { name: "code", dir: "" };
  }

  function assertNeverRoute(name) {
    throw new Error(`unhandled route: ${name}`);
  }

  function go(pathName) {
    if (window.location.pathname !== pathName) {
      window.history.pushState({}, "", pathName);
    }
    selected = 0;
    refresh();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatAge(iso) {
    if (!iso) {
      return "—";
    }
    const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${Math.floor(hours / 24)}d`;
  }

  function fileIcon(type) {
    if (type === "dir") {
      return `<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M1.75 2A1.75 1.75 0 0 0 0 3.75v8.5C0 13.216.784 14 1.75 14h12.5A1.75 1.75 0 0 0 16 12.25v-6.5A1.75 1.75 0 0 0 14.25 4H7.5l-.884-1.326A.75.75 0 0 1 6 2.25H1.75Z"/></svg>`;
    }
    return `<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 1.75A.75.75 0 0 1 2.75 1h6.5a.75.75 0 0 1 .53.22l4 4a.75.75 0 0 1 .22.53v8.5A.75.75 0 0 1 13.25 15h-10.5A.75.75 0 0 1 2 14.25Zm7 1.44L12.81 7H9.75a.75.75 0 0 1-.75-.75Z"/></svg>`;
  }

  function crumbs(dirPath) {
    const parts = String(dirPath || "")
      .split("/")
      .filter(Boolean);
    const links = [`<a href="/code">root</a>`];
    let acc = "";
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      links.push(`<a href="/tree/${encodeURI(acc)}">${escapeHtml(part)}</a>`);
    }
    return `<div class="crumb">${links.join("<span>/</span>")}</div>`;
  }

  async function refresh() {
    loading = !state;
    const route = parseRoute();
    try {
      const stateRes = await fetch("/api/state");
      const stateBody = await stateRes.json();
      if (!stateBody.ok) {
        loadError = stateBody;
        state = null;
      } else {
        state = stateBody.data;
        loadError = null;
      }
      if (state) {
        const rootRes = await fetch("/api/tree?path=");
        const rootBody = await rootRes.json();
        if (rootBody.ok) {
          rootTree = rootBody.data;
        }
        if (route.name === "code") {
          const treeRes = await fetch(`/api/tree?path=${encodeURIComponent(route.dir || "")}`);
          const treeBody = await treeRes.json();
          if (!treeBody.ok) {
            loadError = treeBody;
          } else {
            tree = treeBody.data;
          }
        }
        if (route.name === "blob") {
          const blobRes = await fetch(`/api/blob?path=${encodeURIComponent(route.path)}`);
          const blobBody = await blobRes.json();
          if (!blobBody.ok) {
            loadError = blobBody;
            blob = null;
          } else {
            blob = blobBody.data;
            surfaceFile = route.path;
          }
        }
        if (route.name === "pulls") {
          const pullRes = await fetch("/api/pulls");
          const pullBody = await pullRes.json();
          if (!pullBody.ok) {
            loadError = pullBody;
          } else {
            pulls = pullBody.data;
          }
        }
        if (route.name === "connectors") {
          const connRes = await fetch("/api/connectors");
          const connBody = await connRes.json();
          connectors = connBody.ok ? connBody.data : [];
        }
      }
    } catch (_err) {
      loadError = { ok: false, code: "NETWORK_ERROR", detail: "studio did not return state" };
    }
    loading = false;
    render();
  }

  function renderNav(route) {
    const current = route.name === "blob" ? "code" : route.name;
    document.querySelectorAll("[data-nav]").forEach((el) => {
      if (el.getAttribute("data-nav") === current) {
        el.setAttribute("aria-current", "page");
      } else {
        el.removeAttribute("aria-current");
      }
    });
  }

  function renderHead() {
    if (!state || !state.repo) {
      repoHead.innerHTML = `<p class="quiet">Code</p><h1>repo</h1>`;
      sourceMeta.textContent = "offline";
      return;
    }
    const repo = state.repo;
    repoHead.innerHTML = `<p class="quiet">Code</p>
      <h1><span class="name">${escapeHtml(repo.owner)}</span><span class="slash"> / </span>${escapeHtml(repo.name)}</h1>
      <p class="desc">${escapeHtml(repo.description || "")}</p>`;
    sourceMeta.textContent = `${state.source} · ${repo.default_branch}`;
  }

  function renderTree() {
    const repo = state && state.repo ? state.repo.full_name : "repo";
    const route = parseRoute();
    const current = route.name === "blob" ? route.path : route.dir || "";
    const rows = rootTree
      .map((entry) => {
        const href = entry.type === "dir" ? `/tree/${encodeURI(entry.path)}` : `/blob/${encodeURI(entry.path)}`;
        const on = current === entry.path || (current && current.startsWith(`${entry.path}/`)) ? " on" : "";
        return `<button type="button" class="${on.trim()}" data-path="${escapeHtml(entry.path)}" data-type="${escapeHtml(entry.type)}" data-href="${escapeHtml(href)}">${escapeHtml(entry.name)}</button>`;
      })
      .join("");
    treeAside.innerHTML = `<div class="repo">${escapeHtml(repo)}</div>${rows}`;
    treeAside.querySelectorAll("[data-href]").forEach((btn) => {
      btn.onclick = () => {
        const filePath = btn.getAttribute("data-path");
        window.StudioGithub.hooks.openFile(filePath);
        go(btn.getAttribute("data-href"));
      };
    });
  }

  function render() {
    const route = parseRoute();
    renderNav(route);
    renderHead();
    if (state) {
      renderTree();
    }
    if (loading) {
      view.innerHTML = `<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>`;
      return;
    }
    if (loadError) {
      view.innerHTML = errorView(loadError);
      bindError();
      return;
    }
    switch (route.name) {
      case "code":
        view.innerHTML = codeView(route.dir);
        bindCode();
        break;
      case "blob":
        view.innerHTML = blobView(route.path);
        bindBlob(route.path);
        break;
      case "pulls":
        view.innerHTML = pullsView();
        bindPulls();
        break;
      case "connectors":
        view.innerHTML = connectorsView();
        bindConnectors();
        break;
      default:
        assertNeverRoute(route.name);
    }
    if (flash) {
      const node = document.createElement("p");
      node.className = "flash";
      node.textContent = flash;
      view.appendChild(node);
    }
  }

  function errorView(err) {
    const stop = Boolean(err && err.stop) || (err && err.code === "RESOURCE_EXHAUSTED");
    const title = stop ? "Stopped" : "Can’t reach the repo";
    const detail = err && err.detail ? err.detail : "The studio did not return a browse snapshot.";
    const extra = stop
      ? `<p class="quiet">ResourceExhausted. Do not retry the live connector.</p>
         <div class="actions"><button class="secondary" type="button" id="use-fixture">Use fixture browse</button></div>`
      : `<div class="actions"><button class="secondary" type="button" id="retry">Retry</button></div>`;
    return `<section class="error${stop ? " stop" : ""}" data-testid="browse-error">
      <h1>${escapeHtml(title)}</h1>
      <p class="quiet">${escapeHtml(detail)}</p>
      ${extra}
    </section>`;
  }

  function bindError() {
    const retry = document.getElementById("retry");
    if (retry) {
      retry.onclick = refresh;
    }
    const fixture = document.getElementById("use-fixture");
    if (fixture) {
      fixture.onclick = async () => {
        await post("/api/source", { source: "fixture" });
        flash = "Switched to fixture browse. Live GitHub was not retried.";
        refresh();
      };
    }
  }

  function codeView(dirPath) {
    const rows = tree
      .map((entry) => {
        const href = entry.type === "dir" ? `/tree/${encodeURI(entry.path)}` : `/blob/${encodeURI(entry.path)}`;
        return `<tr data-path="${escapeHtml(entry.path)}" data-type="${escapeHtml(entry.type)}" data-href="${escapeHtml(href)}" tabindex="0">
          <td><span class="file-name">${fileIcon(entry.type)}<a href="${escapeHtml(href)}">${escapeHtml(entry.name)}</a></span></td>
          <td class="message quiet">${escapeHtml(entry.message || "")}</td>
          <td class="num quiet">${escapeHtml(formatAge(entry.updated_at))}</td>
        </tr>`;
      })
      .join("");
    return `${crumbs(dirPath)}
      <div class="page-pad"><span class="branch">${escapeHtml((state.repo && state.repo.default_branch) || "main")}</span></div>
      <table data-testid="file-table">
        <thead><tr><th>Name</th><th class="message">Message</th><th>Age</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="3">Empty directory</td></tr>`}</tbody>
      </table>`;
  }

  function bindCode() {
    view.querySelectorAll("[data-href]").forEach((row) => {
      const href = row.getAttribute("data-href");
      row.onclick = (event) => {
        if (event.target.closest("a")) {
          event.preventDefault();
        }
        const filePath = row.getAttribute("data-path");
        window.StudioGithub.hooks.openFile(filePath);
        go(href);
      };
    });
  }

  function blobView(filePath) {
    if (!blob) {
      return `<section class="empty"><h1>File not on the tree</h1><p class="quiet">${escapeHtml(filePath)}</p></section>`;
    }
    const parent = filePath.split("/").slice(0, -1).join("/");
    const body =
      blob.encoding === "binary"
        ? `<p class="page-pad quiet">Binary file</p>`
        : `<pre class="blob" data-testid="blob">${escapeHtml(blob.content)}</pre>`;
    return `${crumbs(filePath)}
      <div class="actions"><button class="secondary" type="button" id="back-tree">Parent</button></div>
      ${body}`;
  }

  function bindBlob(filePath) {
    const back = document.getElementById("back-tree");
    if (back) {
      const parent = filePath.split("/").slice(0, -1).join("/");
      back.onclick = () => go(parent ? `/tree/${encodeURI(parent)}` : "/code");
    }
  }

  function pullsView() {
    const rows = pulls
      .map((item) => {
        const pill = item.draft ? "draft" : item.state;
        const on = surfacePr === item.number ? " selected" : "";
        return `<tr class="${on.trim()}" data-pr="${escapeHtml(String(item.number))}" tabindex="0">
          <td><a href="${escapeHtml(item.html_url)}">#${escapeHtml(String(item.number))}</a> ${escapeHtml(item.title)}</td>
          <td><span class="pill ${escapeHtml(pill)}">${escapeHtml(pill)}</span></td>
          <td class="quiet">${escapeHtml(item.author || "")}</td>
          <td class="quiet">${escapeHtml(formatAge(item.updated_at))}</td>
        </tr>`;
      })
      .join("");
    return `<h2>Pull requests</h2>
      <table data-hook="pr-list" data-testid="pr-list">
        <thead><tr><th>Title</th><th>State</th><th>Author</th><th>Age</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4">No pull requests in this browse snapshot.</td></tr>`}</tbody>
      </table>`;
  }

  function bindPulls() {
    view.querySelectorAll("[data-pr]").forEach((row) => {
      row.onclick = (event) => {
        if (event.target.closest("a")) {
          return;
        }
        const number = Number(row.getAttribute("data-pr"));
        window.StudioGithub.hooks.openPull(number);
        surfacePr = number;
        flash = `PR #${number} selected (Code pane hook).`;
        render();
      };
    });
  }

  function connectorsView() {
    const cards = connectors
      .map((item) => {
        const status = item.attached ? "attached" : item.status;
        const action =
          item.id === "github"
            ? ""
            : `<div class="actions"><button class="secondary" type="button" data-stub="${escapeHtml(item.id)}" disabled>${escapeHtml(item.label)} stub</button></div>`;
        return `<div class="row" data-connector="${escapeHtml(item.id)}">
          <span><strong>${escapeHtml(item.label)}</strong> · ${escapeHtml(item.kind)} · ${escapeHtml(status)}<br /><span class="quiet">${escapeHtml(item.summary)}</span></span>
        </div>${action}`;
      })
      .join("");
    const repo = (state.attach && state.attach.github && state.attach.github.repo) || "nyfeblade/rd-os";
    return `<h2>Attach</h2>
      <p class="page-pad quiet">GitHub first. Seat stubs later via studio/seats. This is not the shell connectors tray.</p>
      <form id="attach-form" data-hook="connector-attach" data-testid="connector-attach">
        <label>GitHub repo<input name="repo" required value="${escapeHtml(repo)}" placeholder="owner/name" /></label>
        <label>Token (optional, public repos work without)<input name="token" type="password" autocomplete="off" /></label>
        ${cards}
        <div class="actions">
          <button type="submit">Attach GitHub</button>
          <button class="secondary" type="button" id="print-recipe">Show attach recipe</button>
        </div>
      </form>
      <pre class="blob" id="recipe-box" hidden></pre>`;
  }

  function bindConnectors() {
    const form = document.getElementById("attach-form");
    if (form) {
      form.onsubmit = async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        window.StudioGithub.hooks.attach("github");
        const result = await post("/api/connectors/attach", {
          id: "github",
          repo: String(data.get("repo") || ""),
          token: String(data.get("token") || ""),
          source: "github",
        });
        if (!result.ok) {
          flash = result.detail || result.code;
        } else {
          flash = `Attached ${result.data.repo}. Live browse uses GitHub. ResourceExhausted ⇒ STOP.`;
        }
        refresh();
      };
    }
    const recipeBtn = document.getElementById("print-recipe");
    if (recipeBtn) {
      recipeBtn.onclick = async () => {
        const result = await fetch("/api/recipe/github").then((res) => res.json());
        const box = document.getElementById("recipe-box");
        box.hidden = false;
        box.textContent = JSON.stringify(result.data || result, null, 2);
      };
    }
    view.querySelectorAll("[data-stub]").forEach((btn) => {
      btn.onclick = async () => {
        const result = await post("/api/connectors/attach", { id: btn.getAttribute("data-stub") });
        flash = result.detail || "Seat stub";
        render();
      };
    });
  }

  async function post(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    return res.json();
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "j" && event.key !== "k" && event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    const rows = Array.from(view.querySelectorAll("tr[data-path], tr[data-pr]"));
    if (!rows.length) {
      return;
    }
    event.preventDefault();
    const dir = event.key === "j" || event.key === "ArrowDown" ? 1 : -1;
    selected = Math.max(0, Math.min(rows.length - 1, selected + dir));
    rows.forEach((row, idx) => row.classList.toggle("selected", idx === selected));
    rows[selected].focus();
  });

  document.querySelector("nav[aria-label='Code pane']").addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link) {
      return;
    }
    event.preventDefault();
    go(link.getAttribute("href"));
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest("#view a[href^='/']");
    if (!link) {
      return;
    }
    event.preventDefault();
    go(link.getAttribute("href"));
  });

  document.addEventListener("studio:open-file", (event) => {
    surfaceFile = event.detail && event.detail.path;
  });
  document.addEventListener("studio:open-pr", (event) => {
    surfacePr = event.detail && event.detail.number;
  });

  window.addEventListener("popstate", refresh);
  applyDrawn();
  if (drawn) {
    refresh();
  }
})();
