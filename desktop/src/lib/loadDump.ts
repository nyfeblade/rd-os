import { invoke } from "@tauri-apps/api/core";
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

const FIXTURES: Record<FixtureName, string> = {
  human: "/fixtures/human.dump.json",
  empty: "/fixtures/empty.dump.json",
  flight: "/fixtures/flight.dump.json",
};

function fixtureUrl(name: string): string | null {
  switch (name) {
    case "human":
    case "empty":
    case "flight":
      return FIXTURES[name];
    case "missing":
      return null;
    default:
      return null;
  }
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
    const url = fixtureUrl(fixture);
    if (!url) {
      return {
        status: "missing",
        path: `?fixture=${fixture}`,
        home: null,
        detail: "Unknown fixture. Use human, empty, flight, or missing.",
      };
    }
    try {
      const json = await fetchJson(url);
      return parseLoaded(json, url, Date.now());
    } catch (err) {
      return {
        status: "missing",
        path: url,
        home: null,
        detail: err instanceof Error ? err.message : "fixture missing",
      };
    }
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
