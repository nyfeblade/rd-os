"use strict";

const fs = require("fs");
const path = require("path");
const {
  STATE_SCHEMA,
  DUMP_SCHEMA,
  PRODUCT_LOCK,
  CUTOVER_LABEL,
  CONNECT_ACK,
  LEGAL_CHANNEL,
  EMPTY_INSTALLED,
  NO_MATCHES,
  CLEAR_FILTERS,
  STATE_FIELDS,
  SEAT_CUTOVER_DOES,
  isTab,
  isInstalledState,
  isInstallState,
  primaryCta,
  actionsFor,
  reject,
  ok,
} = require("./codes");
const { loadCatalog } = require("./catalog");
const { emptyInstall, transition } = require("./machine");

const STATE_FILE = "state.json";

function nowIso(clock) {
  return (clock && typeof clock.now === "function" ? new Date(clock.now()) : new Date()).toISOString();
}

function seedState() {
  return {
    schema: STATE_SCHEMA,
    installs: {},
  };
}

function pickInstall(raw) {
  const row = emptyInstall();
  if (!raw || typeof raw !== "object") {
    return row;
  }
  if (isInstallState(raw.state)) {
    row.state = raw.state;
  }
  row.error = typeof raw.error === "string" && raw.error.length > 0 ? raw.error : null;
  row.installed_at = typeof raw.installed_at === "string" ? raw.installed_at : null;
  row.updated_at = typeof raw.updated_at === "string" ? raw.updated_at : null;
  if (row.state === "available") {
    row.error = null;
    row.installed_at = null;
  }
  return row;
}

function loadState(home) {
  if (!home) {
    return seedState();
  }
  const file = path.join(home, STATE_FILE);
  if (!fs.existsSync(file)) {
    const seeded = seedState();
    persistState(home, seeded);
    return seeded;
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    return { corrupt: true, detail: err && err.message ? err.message : "state.json" };
  }
  if (!parsed || typeof parsed !== "object" || parsed.schema !== STATE_SCHEMA || !parsed.installs || typeof parsed.installs !== "object") {
    return { corrupt: true, detail: "schema" };
  }
  const installs = {};
  for (const [id, raw] of Object.entries(parsed.installs)) {
    installs[id] = pickInstall(raw);
  }
  return { schema: STATE_SCHEMA, installs };
}

function persistState(home, state) {
  if (!home) {
    return;
  }
  fs.mkdirSync(home, { recursive: true });
  const dest = path.join(home, STATE_FILE);
  const tmp = `${dest}.tmp`;
  const body = {
    schema: STATE_SCHEMA,
    installs: {},
  };
  for (const [id, row] of Object.entries(state.installs)) {
    const clean = {};
    for (const field of STATE_FIELDS) {
      clean[field] = row[field];
    }
    body.installs[id] = clean;
  }
  fs.writeFileSync(tmp, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, dest);
}

function composeDoes(entry) {
  if (entry.kind === "seat") {
    return `${entry.does} ${SEAT_CUTOVER_DOES}`;
  }
  return entry.does;
}

function publicEntry(entry, install) {
  const state = install.state;
  const cutover = entry.kind === "seat" ? CUTOVER_LABEL : null;
  return {
    id: entry.id,
    kind: entry.kind,
    tab: entry.tab,
    tier: entry.tier,
    name: entry.name,
    job: entry.job,
    does: composeDoes(entry),
    auth_required: entry.auth_required,
    cost_class: entry.cost_class,
    two_way: entry.two_way,
    hitl: entry.hitl,
    cutover,
    tools_pointer: entry.tools_pointer,
    state,
    error: install.error,
    installed_at: install.installed_at,
    updated_at: install.updated_at,
    cta: primaryCta(entry.kind, state),
    actions: actionsFor(entry.kind, state),
    badges: {
      two_way: entry.two_way,
      hitl: entry.hitl,
      cost_class: entry.cost_class,
      cutover,
    },
  };
}

function haystack(entry) {
  return `${entry.id} ${entry.name} ${entry.job} ${entry.kind}`.toLowerCase();
}

function createStudioMarketplace(options) {
  const opts = options || {};
  const home = opts.home || null;
  const clock = opts.clock || null;
  const catalogFile = opts.catalog || null;
  const loaded = loadCatalog(catalogFile);
  if (!loaded.ok) {
    throw new Error(`${loaded.code}: ${loaded.detail}`);
  }
  const catalog = loaded.data;
  const byId = new Map(catalog.entries.map((entry) => [entry.id, entry]));
  const loadedState = loadState(home);
  if (loadedState.corrupt) {
    const fail = () => reject("STORE_CORRUPT", loadedState.detail);
    return {
      catalog: fail,
      list: fail,
      get: fail,
      browse: fail,
      installed: fail,
      install: fail,
      connect: fail,
      revoke: fail,
      dump: fail,
    };
  }
  const state = loadedState;

  function save() {
    persistState(home, state);
  }

  function installOf(id) {
    return state.installs[id] || emptyInstall();
  }

  function view(id) {
    const entry = byId.get(id);
    if (!entry) {
      return reject("UNKNOWN_ENTRY", id);
    }
    return ok({ entry: publicEntry(entry, installOf(id)) });
  }

  function apply(id, command, extra) {
    const entry = byId.get(id);
    if (!entry) {
      return reject("UNKNOWN_ENTRY", id);
    }
    const next = transition(installOf(id), command, {
      authRequired: entry.auth_required,
      error: extra && extra.error,
      now: nowIso(clock),
    });
    if (next.state === "available") {
      delete state.installs[id];
    } else {
      state.installs[id] = next;
    }
    save();
    return ok({ entry: publicEntry(entry, installOf(id)) });
  }

  function listMerged() {
    return catalog.entries.map((entry) => publicEntry(entry, installOf(entry.id)));
  }

  return {
    catalog() {
      return ok({
        schema: catalog.schema,
        product_lock: catalog.product_lock,
        not: catalog.not.slice(),
        tabs: catalog.tabs.slice(),
        ids: catalog.entries.map((entry) => entry.id),
      });
    },
    list() {
      return ok({ entries: listMerged() });
    },
    get(id) {
      return view(id);
    },
    browse(query) {
      const q = query || {};
      if (q.tab !== undefined && q.tab !== null && !isTab(q.tab)) {
        return reject("UNKNOWN_TAB", String(q.tab));
      }
      const needle = typeof q.q === "string" ? q.q.trim().toLowerCase() : "";
      const filter = q.filter === "installed" || q.filter === "available" ? q.filter : "all";
      const lowToken = q.low_token === true;
      const rows = listMerged().filter((entry) => {
        if (q.tab && entry.tab !== q.tab) {
          return false;
        }
        if (filter === "installed" && !isInstalledState(entry.state)) {
          return false;
        }
        if (filter === "available" && entry.state !== "available") {
          return false;
        }
        if (lowToken && entry.cost_class !== "lean") {
          return false;
        }
        if (needle && !haystack(entry).includes(needle)) {
          return false;
        }
        return true;
      });
      let empty = null;
      let emptyCopy = null;
      if (rows.length === 0) {
        if (filter === "installed" && !needle && !q.tab) {
          empty = "empty_installed";
          emptyCopy = EMPTY_INSTALLED;
        } else {
          empty = "no_matches";
          emptyCopy = NO_MATCHES;
        }
      }
      return ok({
        tab: q.tab || null,
        filter,
        q: needle,
        low_token: lowToken,
        entries: rows,
        empty,
        empty_copy: emptyCopy,
        hint: empty === "no_matches" ? CLEAR_FILTERS : null,
      });
    },
    installed() {
      const entries = listMerged().filter((entry) => isInstalledState(entry.state));
      return ok({
        entries,
        empty: entries.length === 0 ? "empty_installed" : null,
        empty_copy: entries.length === 0 ? EMPTY_INSTALLED : null,
      });
    },
    install(id) {
      return apply(id, "install");
    },
    connect(id, connectOpts) {
      const extra = {};
      if (connectOpts && typeof connectOpts.error === "string") {
        extra.error = connectOpts.error;
      }
      return apply(id, "connect", extra);
    },
    revoke(id) {
      return apply(id, "revoke");
    },
    dump() {
      const entries = listMerged();
      return ok({
        schema: DUMP_SCHEMA,
        product_lock: PRODUCT_LOCK,
        not: catalog.not.slice(),
        tabs: catalog.tabs.slice(),
        connect_ack: CONNECT_ACK,
        legal_channel: LEGAL_CHANNEL,
        cutover_label: CUTOVER_LABEL,
        chrome: "not-owned",
        empty_installed: EMPTY_INSTALLED,
        no_matches: NO_MATCHES,
        entries,
        installed_count: entries.filter((entry) => isInstalledState(entry.state)).length,
      });
    },
  };
}

module.exports = {
  createStudioMarketplace,
};
