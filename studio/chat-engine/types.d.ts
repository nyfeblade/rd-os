export type Mode = "coding" | "general";

export type RejectCode =
  | "UNBOUND_THREAD"
  | "THREAD_NOT_FOUND"
  | "BIND_PATH_MISSING"
  | "BIND_NOT_GIT"
  | "GIT_UNAVAILABLE"
  | "GIT_EXEC"
  | "PATH_OUTSIDE_REPO"
  | "TOOL_DENIED"
  | "UNKNOWN_TOOL"
  | "UNKNOWN_MODE"
  | "UNKNOWN_HANDOFF_TARGET"
  | "UNKNOWN_OUTCOME_SOURCE"
  | "UNKNOWN_OUTCOME_STATUS"
  | "UNKNOWN_MEMORY_KIND"
  | "STORE_CORRUPT"
  | "BAD_ARGUMENT"
  | "LIFE_OS_DENIED";

export type ToolFamily = "fs" | "git" | "github" | "handoff" | "test" | "web" | "fleet" | "life";

export type ToolId =
  | "fs.read"
  | "fs.list"
  | "fs.diff"
  | "git.status"
  | "git.log"
  | "git.show"
  | "git.diff"
  | "git.branch"
  | "github.pr.read"
  | "github.ci.read"
  | "github.review.read"
  | "handoff.cursor_ca"
  | "handoff.claude_code"
  | "test.run"
  | "web.browse"
  | "fleet.ack"
  | "life.food"
  | "life.flights"
  | "life.calendar"
  | "life.journal";

export type MemoryKind = "decision" | "path" | "attempt" | "note";
export type FocusSource = "code" | "last_touched" | "explicit";
export type HandoffTarget = "cursor_ca" | "claude_code";
export type HandoffMode = "dry_run" | "stub";
export type OutcomeSource = "ca" | "pr" | "ci" | "claude_code";
export type OutcomeStatus = "queued" | "running" | "success" | "failure" | "cancelled" | "unknown";

export type Ok<T> = { ok: true; data: T };
export type Err = { ok: false; code: RejectCode; detail: string };
export type Result<T> = Ok<T> | Err;

export type DirtyFile = { status: string; path: string };
export type CommitInfo = { sha: string; subject: string; author: string; date: string };

export type GithubRemote = { owner: string; repo: string; full_name: string };

export type OpenPr = {
  number: number;
  title: string;
  state: string;
  draft: boolean;
  html_url: string;
  updated_at: string | null;
  head: string | null;
};

export type CheckSummary = {
  conclusion: string;
  failing: string[];
  runs: Array<{ name: string; status: string; conclusion: string | null }>;
};

export type RootSnapshot = {
  git_root: string;
  empty: boolean;
  detached: boolean;
  branch: string | null;
  head: string | null;
  head_short: string | null;
  dirty: boolean;
  dirty_files: DirtyFile[];
  commits: CommitInfo[];
  remote_url: string | null;
};

export type WorkspaceSnapshot = RootSnapshot & {
  repo_path: string;
  project_id: string;
  github: GithubRemote | null;
  open_pr: OpenPr | null;
  checks: CheckSummary | null;
  roots: RootSnapshot[];
  captured_at: string;
};

export type FocusPointer = {
  path: string;
  abs_path: string;
  line: number | null;
  column: number | null;
  end_line: number | null;
  end_column: number | null;
  source: FocusSource;
  updated_at: string;
};

export type BindRecord = {
  repo_path: string;
  git_root: string;
  roots: string[];
  project_id: string;
  bound_at: string;
};

export type ThreadRecord = {
  schema: "studio.chat.thread/v1";
  id: string;
  created_at: string;
  updated_at: string;
  mode: Mode;
  bind: BindRecord;
  focus: FocusPointer | null;
  last_handoff_id: string | null;
  poll_fingerprint: string | null;
};

export type MemoryEntry = {
  id: string;
  scope: "thread" | "project";
  kind: MemoryKind;
  text: string;
  paths: string[];
  created_at: string;
  thread_id: string;
};

export type ToolList = {
  mode: Mode;
  allow: ToolId[];
  allow_if_asked: ToolId[];
  deny: ToolId[];
};

export type ContextPack = {
  schema: "studio.chat.context/v1";
  fence: "studio/chat-engine";
  product_lock: "no_orphan_generic_chat";
  mode: Mode;
  thread_id: string;
  bind: {
    repo_path: string;
    git_root: string;
    roots: string[];
    project_id: string;
  };
  snapshot: {
    branch: string | null;
    detached: boolean;
    dirty: boolean;
    dirty_files: DirtyFile[];
    head: string | null;
    head_short: string | null;
    commits: CommitInfo[];
    captured_at: string;
    open_pr: OpenPr | null;
    checks: CheckSummary | null;
  };
  focus: FocusPointer | null;
  memory: { thread: MemoryEntry[]; project: MemoryEntry[] };
  tools: ToolList;
  system: string[];
  packed_at: string;
};

export type HandoffPayload = {
  schema: "studio.chat.handoff/v1";
  target: HandoffTarget;
  brief: string;
  bind: BindRecord;
  snapshot: WorkspaceSnapshot;
  focus: FocusPointer | null;
  pack: ContextPack;
};

export type HandoffReceipt = {
  id: string;
  target: HandoffTarget;
  created_at: string;
  thread_id: string;
  status?: string;
  mode?: HandoffMode;
};

export type HandoffResult = {
  mode: HandoffMode;
  target: HandoffTarget;
  status: string;
  reason?: string;
  payload: HandoffPayload;
  receipt: HandoffReceipt;
};

export type OutcomeEvent = {
  schema?: "studio.chat.outcome/v1";
  id: string;
  kind: "outcome" | "handoff";
  source: OutcomeSource | string;
  status: string;
  ref?: string | null;
  summary: string;
  created_at: string;
  thread_id?: string;
  fingerprint?: string | null;
  payload_attached?: boolean;
};

export type ShellHints = {
  pane: "Chat";
  role: "engine";
  chrome: "not-owned";
  sibling_later: "Board";
  dashboard: false;
  marketplace: false;
  paste_and_pray: false;
  owns: string[];
  does_not_own: string[];
};

export type EngineDump = {
  schema: "studio.chat.engine/v1";
  fence: "studio/chat-engine";
  product_lock: "no_orphan_generic_chat";
  clock_started: false;
  verdict: null;
  shell: ShellHints;
  thread: ThreadRecord;
  snapshot: WorkspaceSnapshot;
  pack: ContextPack;
  memory: { thread: MemoryEntry[]; project: MemoryEntry[] };
  events: OutcomeEvent[];
};

export type ExecGit = (
  args: string[],
  options: { cwd: string; timeout?: number }
) => { ok: true; stdout: string; stderr?: string } | Err;

export type GithubReader = {
  mode?: string;
  parseRemote: (url: string) => GithubRemote | null;
  readPrForBranch: (query: { owner: string; repo: string; branch: string }) => Promise<Result<OpenPr | null>>;
  readChecks: (query: { owner: string; repo: string; sha?: string; ref?: string }) => Promise<Result<CheckSummary | null>>;
  readReviews: (query: { owner: string; repo: string; number: number }) => Promise<Result<unknown>>;
};

export type ChatEngineOptions = {
  home?: string;
  clock?: () => number;
  execGit?: ExecGit;
  github?: Partial<GithubReader> & { fetch?: typeof fetch; env?: NodeJS.ProcessEnv };
  fetch?: typeof fetch;
  env?: NodeJS.ProcessEnv;
  adapters?: {
    cursor_ca?: (payload: HandoffPayload) => Promise<{ mode?: HandoffMode; status?: string; reason?: string }>;
    claude_code?: (payload: HandoffPayload) => Promise<{ mode?: HandoffMode; status?: string; reason?: string }>;
  };
  commitCount?: number;
};

export type ChatEngine = {
  home: string;
  threads: {
    open: (input: { repo: string; mode?: Mode; focus?: Partial<FocusPointer> & { path: string }; roots?: string[] }) => Result<{ thread: ThreadRecord }>;
    get: (id: string) => Result<{ thread: ThreadRecord }>;
    list: () => Result<{ threads: ThreadRecord[] }>;
  };
  bind: {
    resolve: (input: string | { repo?: string; path?: string; roots?: string[] }) => Result<{
      repo_path: string;
      git_root: string;
      roots: string[];
      project_id: string;
    }>;
  };
  snapshot: {
    refresh: (id: string) => Promise<Result<{ thread: ThreadRecord; snapshot: WorkspaceSnapshot }>>;
  };
  focus: {
    set: (id: string, pointer: Partial<FocusPointer> & { path: string }) => Result<{ thread: ThreadRecord; focus: FocusPointer }>;
    get: (id: string) => Result<{ focus: FocusPointer | null }>;
    clear: (id: string) => Result<{ thread: ThreadRecord; focus: null }>;
  };
  memory: {
    write: (id: string, input: { scope?: "thread" | "project"; kind: MemoryKind; text: string; paths?: string[] }) => Result<MemoryEntry>;
    list: (id: string, query?: { scope?: "thread" | "project" }) => Result<{ thread: MemoryEntry[]; project: MemoryEntry[] }>;
  };
  mode: {
    get: (id: string) => Result<{ mode: Mode; tools: ToolList }>;
    set: (id: string, mode: Mode) => Result<{ mode: Mode; tools: ToolList }>;
  };
  tools: {
    list: (id?: string) => Result<ToolList>;
    authorize: (id: string, toolId: string, args?: { asked?: boolean }) => Result<{ tool: string; mode: Mode; family: ToolFamily }>;
    invoke: (id: string, toolId: string, args?: Record<string, unknown>) => Promise<Result<unknown>>;
  };
  context: {
    pack: (id: string) => Promise<Result<{ thread: ThreadRecord; snapshot: WorkspaceSnapshot; pack: ContextPack }>>;
  };
  handoff: {
    play: (id: string, input: { target: HandoffTarget; brief?: string; dry_run?: boolean }) => Promise<Result<HandoffResult>>;
    list: (id: string) => Result<OutcomeEvent[]>;
  };
  outcomes: {
    ingest: (id: string, input: { source: OutcomeSource; status: OutcomeStatus; ref?: string; summary?: string; fingerprint?: string }) => Result<OutcomeEvent>;
    poll: (id: string) => Promise<Result<{ polled: true; mode: string; fingerprint: string; ingested: OutcomeEvent[]; events: OutcomeEvent[] }>>;
    list: (id: string) => Result<OutcomeEvent[]>;
  };
  dump: (id: string) => Promise<Result<EngineDump>>;
};

export function createChatEngine(options?: ChatEngineOptions): ChatEngine;
export function authorizeTool(mode: Mode, toolId: string, args?: { asked?: boolean }): Result<{ tool: string; mode: Mode; family: ToolFamily }>;
export function listTools(mode?: Mode): ToolList;
export function normalizeMode(mode?: string): Mode | null;
export function parseGithubRemote(url: string): GithubRemote | null;
export function publicRemoteUrl(url: string | null | undefined): string | null;
export function resolveGitRoot(input: string, execGit?: ExecGit): Result<{ git_root: string; requested: string }>;
export function describeReject(code: RejectCode): string;
export function describeFamily(family: ToolFamily): string;
export function shellHints(): ShellHints;

export const SCHEMA: "studio.chat.engine/v1";
export const FENCE: "studio/chat-engine";
export const PRODUCT_LOCK: "no_orphan_generic_chat";
export const ASSUME_SNAPSHOT_TRUTH: string;
export const DEFAULT_MODE: "coding";
export const MODES: readonly Mode[];
export const TOOL_IDS: readonly ToolId[];
export const CODING_ALLOW: readonly ToolId[];
export const CODING_DENY: readonly ToolId[];
export const REJECT_CODES: readonly RejectCode[];
export const HANDOFF_TARGETS: readonly HandoffTarget[];
export const OUTCOME_SOURCES: readonly OutcomeSource[];
export const MEMORY_KINDS: readonly MemoryKind[];
