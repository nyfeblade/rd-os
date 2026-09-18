export type Provider = "github";

export type RejectCode =
  | "PLATFORM_UNSUPPORTED"
  | "UNKNOWN_GITHUB_CLIENT"
  | "UNKNOWN_SUPABASE_URL"
  | "MISSING_ANON_KEY"
  | "BAD_ARGUMENT"
  | "NO_PENDING"
  | "PENDING_EXPIRED"
  | "STATE_MISMATCH"
  | "OAUTH_DENIED"
  | "OAUTH_ERROR"
  | "IMPLICIT_FLOW"
  | "TOKEN_EXCHANGE"
  | "TOKEN_PARSE"
  | "USER_PARSE"
  | "WRONG_PROVIDER"
  | "SESSION_EXPIRED"
  | "STORE_CORRUPT";

export interface AuthUser {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface Session {
  user: AuthUser;
  provider: Provider;
  expires: string;
}

export interface Ok<T> {
  ok: true;
  data: T;
}

export interface Err {
  ok: false;
  code: RejectCode;
  detail: string;
}

export type Result<T> = Ok<T> | Err;

export interface PublicIds {
  readonly GITHUB_CLIENT_ID: "Ov23li0XxVscnZ92pG17";
  readonly SUPABASE_PROJECT_REF: "ahuvocemlpqmbcvqlxve";
  readonly SUPABASE_URL: "https://ahuvocemlpqmbcvqlxve.supabase.co";
  readonly SUPABASE_CALLBACK: "https://ahuvocemlpqmbcvqlxve.supabase.co/auth/v1/callback";
}

export const PUBLIC: PublicIds;
export const REJECT_CODES: readonly RejectCode[];
export const SCHEMA: "studio.auth/v1";
export const FENCE: "studio/auth";
export const PROVIDER: Provider;
export const DEFAULT_REDIRECT: string;

export interface StartOAuthInput {
  redirectTo?: string;
}

export interface StartOAuth {
  url: string;
  state: string;
  redirectTo: string;
  supabaseCallback: PublicIds["SUPABASE_CALLBACK"];
}

export interface CallbackInput {
  url?: string;
  code?: string;
  state?: string;
  error?: string;
}

export interface Auth {
  startOAuth(input?: StartOAuthInput): Result<StartOAuth>;
  handleCallback(input: CallbackInput | string): Promise<Result<Session>>;
  session(): Result<Session | null>;
  signOut(): Result<{ signedOut: true }>;
}

export interface CreateAuthOptions {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  home?: string;
  platform?: NodeJS.Platform | string;
  redirectTo?: string;
  now?: () => number;
  fetch?: typeof fetch;
}

export function createAuth(opts?: CreateAuthOptions): Auth;
export function describeReject(code: RejectCode): string;
export function parseConfig(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>
): Result<{
  githubClientId: PublicIds["GITHUB_CLIENT_ID"];
  supabaseUrl: PublicIds["SUPABASE_URL"];
  supabaseAnonKey: string;
  supabaseCallback: PublicIds["SUPABASE_CALLBACK"];
  supabaseRef: PublicIds["SUPABASE_PROJECT_REF"];
  hasAnonKey: boolean;
}>;
