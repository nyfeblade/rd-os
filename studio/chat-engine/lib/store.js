"use strict";

const fs = require("fs");
const path = require("path");
const { ok, reject, isObject } = require("./result");
const { SCHEMA, THREAD_SCHEMA, MEMORY_SCHEMA, MEMORY_CAP, EVENT_CAP, FENCE } = require("./codes");
const { isThreadId, isProjectKey } = require("./ids");
const { writeJsonAtomic, readJson, exists } = require("./fsutil");

function layout(home) {
  return {
    home,
    meta: path.join(home, "meta.json"),
    threadsDir: path.join(home, "threads"),
    projectsDir: path.join(home, "projects"),
    threadDir(id) {
      return path.join(home, "threads", id);
    },
    thread(id) {
      return path.join(home, "threads", id, "thread.json");
    },
    memory(id) {
      return path.join(home, "threads", id, "memory.json");
    },
    events(id) {
      return path.join(home, "threads", id, "events.json");
    },
    project(hash) {
      return path.join(home, "projects", hash, "project.json");
    },
    projectMemory(hash) {
      return path.join(home, "projects", hash, "memory.json");
    },
  };
}

function ensureHome(home, nowIso) {
  const paths = layout(home);
  fs.mkdirSync(paths.threadsDir, { recursive: true });
  fs.mkdirSync(paths.projectsDir, { recursive: true });
  if (!exists(paths.meta)) {
    writeJsonAtomic(paths.meta, {
      schema: SCHEMA,
      fence: FENCE,
      created_at: nowIso(),
    });
  }
  return paths;
}

function saveThread(home, thread) {
  if (!isThreadId(thread.id)) {
    return reject("BAD_ARGUMENT", "invalid thread id");
  }
  writeJsonAtomic(layout(home).thread(thread.id), thread);
  return ok(thread);
}

function loadThread(home, id) {
  if (!isThreadId(id)) {
    return reject("BAD_ARGUMENT", "invalid thread id");
  }
  const file = layout(home).thread(id);
  const loaded = readJson(file);
  if (!loaded.ok) {
    if (loaded.missing) {
      return reject("THREAD_NOT_FOUND", id);
    }
    return loaded;
  }
  if (!isObject(loaded.data) || loaded.data.schema !== THREAD_SCHEMA || loaded.data.id !== id) {
    return reject("STORE_CORRUPT", `thread ${id} failed schema check`);
  }
  return ok(loaded.data);
}

function listThreadIds(home) {
  const dir = layout(home).threadsDir;
  if (!exists(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((name) => isThreadId(name) && exists(layout(home).thread(name)))
    .sort();
}

function emptyMemoryDoc(nowIso) {
  return { schema: MEMORY_SCHEMA, updated_at: nowIso(), entries: [] };
}

function loadMemoryDoc(file, nowIso) {
  const loaded = readJson(file);
  if (!loaded.ok) {
    if (loaded.missing) {
      return ok(emptyMemoryDoc(nowIso));
    }
    return loaded;
  }
  if (!isObject(loaded.data) || !Array.isArray(loaded.data.entries)) {
    return reject("STORE_CORRUPT", `${file} is not a memory document`);
  }
  return ok(loaded.data);
}

function saveMemoryDoc(file, entries, nowIso) {
  const clipped = entries.slice(-MEMORY_CAP);
  const doc = { schema: MEMORY_SCHEMA, updated_at: nowIso(), entries: clipped };
  writeJsonAtomic(file, doc);
  return ok(doc);
}

function loadThreadMemory(home, id, nowIso) {
  return loadMemoryDoc(layout(home).memory(id), nowIso);
}

function saveThreadMemory(home, id, entries, nowIso) {
  if (!isThreadId(id)) {
    return reject("BAD_ARGUMENT", "invalid thread id");
  }
  return saveMemoryDoc(layout(home).memory(id), entries, nowIso);
}

function loadProjectMemory(home, hash, nowIso) {
  if (!isProjectKey(hash)) {
    return reject("BAD_ARGUMENT", "invalid project key");
  }
  return loadMemoryDoc(layout(home).projectMemory(hash), nowIso);
}

function saveProjectMemory(home, hash, entries, nowIso) {
  if (!isProjectKey(hash)) {
    return reject("BAD_ARGUMENT", "invalid project key");
  }
  return saveMemoryDoc(layout(home).projectMemory(hash), entries, nowIso);
}

function saveProject(home, project) {
  if (!isProjectKey(project.id)) {
    return reject("BAD_ARGUMENT", "invalid project key");
  }
  writeJsonAtomic(layout(home).project(project.id), project);
  return ok(project);
}

function loadProject(home, hash) {
  if (!isProjectKey(hash)) {
    return reject("BAD_ARGUMENT", "invalid project key");
  }
  const loaded = readJson(layout(home).project(hash));
  if (!loaded.ok) {
    if (loaded.missing) {
      return { ok: false, missing: true };
    }
    return loaded;
  }
  return ok(loaded.data);
}

function loadEvents(home, id) {
  if (!isThreadId(id)) {
    return reject("BAD_ARGUMENT", "invalid thread id");
  }
  const loaded = readJson(layout(home).events(id));
  if (!loaded.ok) {
    if (loaded.missing) {
      return ok([]);
    }
    return loaded;
  }
  if (!Array.isArray(loaded.data)) {
    return reject("STORE_CORRUPT", `events for ${id} are not an array`);
  }
  return ok(loaded.data);
}

function appendEvent(home, id, event) {
  const loaded = loadEvents(home, id);
  if (!loaded.ok) {
    return loaded;
  }
  const next = loaded.data.concat([event]).slice(-EVENT_CAP);
  writeJsonAtomic(layout(home).events(id), next);
  return ok(event);
}

module.exports = {
  layout,
  ensureHome,
  saveThread,
  loadThread,
  listThreadIds,
  loadThreadMemory,
  saveThreadMemory,
  loadProjectMemory,
  saveProjectMemory,
  saveProject,
  loadProject,
  loadEvents,
  appendEvent,
};
