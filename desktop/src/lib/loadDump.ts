import { invoke } from "@tauri-apps/api/core";
import emptyDump from "../../fixtures/attention.dump.empty.json";
import flightDump from "../../fixtures/attention.dump.flight.json";
import humanDump from "../../fixtures/attention.dump.json";
import { parseAttentionDump, type AttentionDump } from "./attention";

export type DumpRead = {
  path: string;
  home: string | null;
  json: unknown | null;
  error: string | null;
  mtimeMs: number | null;
};

export type DumpState =
  | { status: "loading" }
  | { status: "ok"; dump: AttentionDump; path: string; mtimeMs: number | null }
  | { status: "missing"; path: string; home: string | null; detail: string };

type FixtureName = "human" | "empty" | "flight";

function fixturePayload(name: string): { json: unknown; path: string } | null {
  switch (name) {
    case "human":
      return { json: humanDump, path: "desktop/fixtures/attention.dump.json" };
    case "empty":
      return { json: emptyDump, path: "desktop/fixtures/attention.dump.empty.json" };
    case "flight":
      return { json: flightDump, path: "desktop/fixtures/attention.dump.flight.json" };
    case "missing":
      return null;
    default:
      return null;
  }
}

function isFixtureName(name: string): name is FixtureName | "missing" {
  return name === "human" || name === "empty" || name === "flight" || name === "missing";
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function searchParams(): URLSearchParams {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }
  const fromSearch = new URLSearchParams(window.location.search);
  if (fromSearch.get("fixture") || fromSearch.get("home")) {
    return fromSearch;
  }
  const hash = window.location.hash;
  const queryAt = hash.indexOf("?");
  if (queryAt >= 0) {
    return new URLSearchParams(hash.slice(queryAt));
  }
  return fromSearch;
}

async function readViaTauri(): Promise<DumpRead> {
  return invoke<DumpRead>("read_attention_dump");
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

export async function loadDump(): Promise<DumpState> {
  const params = searchParams();
  const fixture = params.get("fixture");

  if (fixture === "missing") {
    return {
      status: "missing",
      path: "$RDOS_HOME/board/attention.dump.json",
      home: params.get("home") || processEnvHome(),
      detail: "Fixture asked for a missing dump. Nothing was invented.",
    };
  }

  if (fixture) {
    if (!isFixtureName(fixture)) {
      return {
        status: "missing",
        path: `?fixture=${fixture}`,
        home: null,
        detail: "Unknown fixture. Use human, empty, flight, or missing.",
      };
    }
    const payload = fixturePayload(fixture);
    if (!payload) {
      return {
        status: "missing",
        path: `?fixture=${fixture}`,
        home: null,
        detail: "Unknown fixture. Use human, empty, flight, or missing.",
      };
    }
    return parseLoaded(payload.json, payload.path, Date.now());
  }

  if (isTauriRuntime()) {
    try {
      const read = await readViaTauri();
      if (read.error || read.json == null) {
        return {
          status: "missing",
          path: read.path,
          home: read.home,
          detail: read.error || "attention.dump is missing",
        };
      }
      return parseLoaded(read.json, read.path, read.mtimeMs);
    } catch (err) {
      return {
        status: "missing",
        path: "$RDOS_HOME/board/attention.dump.json",
        home: processEnvHome(),
        detail: err instanceof Error ? err.message : "invoke failed",
      };
    }
  }

  const envDump = import.meta.env.VITE_RDOS_DUMP;
  if (envDump) {
    try {
      const json = await fetchJson(envDump);
      return parseLoaded(json, envDump, Date.now());
    } catch (err) {
      return {
        status: "missing",
        path: envDump,
        home: processEnvHome(),
        detail: err instanceof Error ? err.message : "dump fetch failed",
      };
    }
  }

  return {
    status: "missing",
    path: "$RDOS_HOME/board/attention.dump.json",
    home: processEnvHome(),
    detail: "No attention.dump. This shell is a view — it will not invent a P0.",
  };
}

function processEnvHome(): string | null {
  return null;
}

function parseLoaded(json: unknown, path: string, mtimeMs: number | null): DumpState {
  const parsed = parseAttentionDump(json);
  if (!parsed.ok) {
    return {
      status: "missing",
      path,
      home: null,
      detail: parsed.reason,
    };
  }
  return { status: "ok", dump: parsed.dump, path, mtimeMs };
}
