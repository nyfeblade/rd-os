/**
 * Thin llm.complete surface. Runtime: src/providers/*.js (CommonJS).
 * Shipped provider: OpenAI Chat Completions (env-keyed).
 */

export type LlmProvider = "openai";

export type LlmRejectCode =
  | "MISSING_KEY"
  | "MISSING_PROMPT"
  | "UNKNOWN_PROVIDER"
  | "RESOURCE_EXHAUSTED"
  | "PROVIDER_ERROR"
  | "NETWORK_ERROR";

export interface LlmCompleteRequest {
  prompt: string;
  system?: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

export interface LlmUsage {
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
}

export interface LlmCompleteOk {
  ok: true;
  data: {
    text: string;
    model: string;
    provider: LlmProvider;
    usage: LlmUsage | null;
    wall_ms: number;
    stop: false;
  };
}

export interface LlmCompleteReject {
  ok: false;
  code: LlmRejectCode;
  detail: string;
  wall_ms: number;
  /** Playbook: ResourceExhausted ⇒ STOP, no retry. */
  stop: boolean;
}

export type LlmCompleteResult = LlmCompleteOk | LlmCompleteReject;

export function assertNeverReject(code: never): never {
  throw new Error(`unhandled LlmRejectCode: ${code}`);
}

export function assertNeverProvider(name: never): never {
  throw new Error(`unhandled LlmProvider: ${name}`);
}

export function describeReject(code: LlmRejectCode): string {
  switch (code) {
    case "MISSING_KEY":
      return "OPENAI_API_KEY is required";
    case "MISSING_PROMPT":
      return "prompt is required";
    case "UNKNOWN_PROVIDER":
      return "LLM_PROVIDER is not the shipped openai adapter";
    case "RESOURCE_EXHAUSTED":
      return "quota or rate limit — STOP, no retry";
    case "PROVIDER_ERROR":
      return "provider rejected the request";
    case "NETWORK_ERROR":
      return "network or fetch failed";
    default: {
      const _exhaustive: never = code;
      return assertNeverReject(_exhaustive);
    }
  }
}
