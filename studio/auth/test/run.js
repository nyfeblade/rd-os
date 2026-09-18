#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  createAuth,
  parseConfig,
  parseCallbackInput,
  describeReject,
  REJECT_CODES,
  FENCE,
} = require("..");

const NOW = Date.parse("2026-09-18T15:00:00.000Z");
const EXPIRES = "2026-09-18T16:00:00.000Z";
const USER_ID = "11111111-1111-1111-1111-111111111111";

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "studio-auth-"));
}

function envOk(extra) {
  return Object.assign(
    {
      GITHUB_CLIENT_ID: "Ov23li0XxVscnZ92pG17",
      SUPABASE_URL: "https://ahuvocemlpqmbcvqlxve.supabase.co",
      SUPABASE_ANON_KEY: "test-anon-key",
    },
    extra || {}
  );
}

function tokenBody(login) {
  return {
    access_token: "access-test",
    refresh_token: "refresh-test",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: USER_ID,
      user_metadata: {
        user_name: login,
        full_name: "The Octocat",
        avatar_url: "https://avatars.githubusercontent.com/u/1",
      },
      app_metadata: { provider: "github" },
      identities: [{ provider: "github", identity_data: { user_name: login } }],
    },
  };
}

function mockFetch(calls, login) {
  return async (url, init) => {
    calls.push({ url: String(url), init: init || {} });
    const body = JSON.parse(init.body);
    if (body.auth_code !== "code-1") {
      throw new Error(`unexpected auth_code ${body.auth_code}`);
    }
    if (typeof body.code_verifier !== "string" || body.code_verifier.length < 40) {
      throw new Error("missing code_verifier");
    }
    return {
      ok: true,
      status: 200,
      json: async () => tokenBody(login || "octocat"),
    };
  };
}

function expectOk(result) {
  if (!result || result.ok !== true) {
    return {
      ok: false,
      error: `expected ok, got ${result && result.code} ${result && result.detail ? result.detail : ""}`.trim(),
    };
  }
  return { ok: true, data: result.data };
}

function expectReject(result, code) {
  if (!result || result.ok !== false || result.code !== code) {
    return {
      ok: false,
      error: `expected ${code}, got ${result && result.ok ? "ok" : result && result.code} ${
        result && result.detail ? result.detail : ""
      }`.trim(),
    };
  }
  return { ok: true };
}

function expectEq(actual, expected, label) {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) {
    return { ok: false, error: `${label}: ${left} !== ${right}` };
  }
  return { ok: true };
}

function runCase(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then((result) => {
      if (result && result.ok === false && result.error) {
        return { name, ok: false, detail: result.error };
      }
      return { name, ok: true };
    })
    .catch((err) => ({
      name,
      ok: false,
      detail: err && err.message ? err.message : String(err),
    }));
}

function makeAuth(overrides) {
  const calls = [];
  const home = (overrides && overrides.home) || tmpHome();
  const fetchImpl = (overrides && overrides.fetch) || mockFetch(calls, overrides && overrides.login);
  const auth = createAuth({
    home,
    platform: (overrides && overrides.platform) || "darwin",
    env: (overrides && overrides.env) || envOk(),
    now: (overrides && overrides.now) || (() => NOW),
    fetch: fetchImpl,
    redirectTo: overrides && overrides.redirectTo,
  });
  return { auth, home, calls };
}

async function signIn(auth, calls) {
  const started = expectOk(auth.startOAuth());
  if (!started.ok) return started;
  if (calls.length !== 0) {
    return { ok: false, error: `startOAuth issued ${calls.length} fetch calls` };
  }
  const cb = await auth.handleCallback({
    url: `${started.data.redirectTo}&code=code-1`,
  });
  const session = expectOk(cb);
  if (!session.ok) return session;
  return { ok: true, started: started.data, session: session.data };
}

async function cases() {
  const rows = [];

  rows.push(
    await runCase("wrong GitHub client id is UNKNOWN_GITHUB_CLIENT", () => {
      return expectReject(
        parseConfig(envOk({ GITHUB_CLIENT_ID: "Ov23liEVIL0000000000" })),
        "UNKNOWN_GITHUB_CLIENT"
      );
    })
  );

  rows.push(
    await runCase("wrong Supabase URL is UNKNOWN_SUPABASE_URL", () => {
      return expectReject(
        parseConfig(envOk({ SUPABASE_URL: "https://other.supabase.co" })),
        "UNKNOWN_SUPABASE_URL"
      );
    })
  );

  rows.push(
    await runCase("empty env defaults to the locked public ids", () => {
      const parsed = expectOk(parseConfig({}));
      if (!parsed.ok) return parsed;
      const ids = expectEq(
        {
          githubClientId: parsed.data.githubClientId,
          supabaseUrl: parsed.data.supabaseUrl,
          supabaseCallback: parsed.data.supabaseCallback,
          supabaseRef: parsed.data.supabaseRef,
        },
        {
          githubClientId: "Ov23li0XxVscnZ92pG17",
          supabaseUrl: "https://ahuvocemlpqmbcvqlxve.supabase.co",
          supabaseCallback: "https://ahuvocemlpqmbcvqlxve.supabase.co/auth/v1/callback",
          supabaseRef: "ahuvocemlpqmbcvqlxve",
        },
        "public ids"
      );
      if (!ids.ok) return ids;
      return expectEq(parsed.data.hasAnonKey, false, "hasAnonKey");
    })
  );

  rows.push(
    await runCase("missing anon key blocks startOAuth", () => {
      const { auth } = makeAuth({ env: envOk({ SUPABASE_ANON_KEY: "" }) });
      return expectReject(auth.startOAuth(), "MISSING_ANON_KEY");
    })
  );

  rows.push(
    await runCase("win32 is PLATFORM_UNSUPPORTED", () => {
      const { auth } = makeAuth({ platform: "win32" });
      return expectReject(auth.startOAuth(), "PLATFORM_UNSUPPORTED");
    })
  );

  rows.push(
    await runCase("startOAuth builds the Supabase GitHub authorize URL", () => {
      const { auth, calls, home } = makeAuth();
      const started = expectOk(auth.startOAuth());
      if (!started.ok) return started;
      if (calls.length !== 0) {
        return { ok: false, error: "startOAuth must not fetch" };
      }
      const url = new URL(started.data.url);
      if (url.origin !== "https://ahuvocemlpqmbcvqlxve.supabase.co") {
        return { ok: false, error: `origin ${url.origin}` };
      }
      if (url.pathname !== "/auth/v1/authorize") {
        return { ok: false, error: `path ${url.pathname}` };
      }
      const qs = {
        provider: url.searchParams.get("provider"),
        method: url.searchParams.get("code_challenge_method"),
        apikey: url.searchParams.get("apikey"),
        callback: started.data.supabaseCallback,
      };
      const pinned = expectEq(
        qs,
        {
          provider: "github",
          method: "s256",
          apikey: "test-anon-key",
          callback: "https://ahuvocemlpqmbcvqlxve.supabase.co/auth/v1/callback",
        },
        "authorize query"
      );
      if (!pinned.ok) return pinned;
      if (!url.searchParams.get("code_challenge")) {
        return { ok: false, error: "code_challenge missing" };
      }
      const redirect = new URL(started.data.redirectTo);
      if (redirect.searchParams.get("state") !== started.data.state) {
        return { ok: false, error: "redirect_to state mismatch" };
      }
      const pending = JSON.parse(fs.readFileSync(path.join(home, "pending.json"), "utf8"));
      if (pending.verifier === url.searchParams.get("code_challenge")) {
        return { ok: false, error: "verifier leaked into the authorize URL" };
      }
      return { ok: true };
    })
  );

  rows.push(
    await runCase("handleCallback stores {user, provider, expires} and hides the ticket", async () => {
      const { auth, home, calls } = makeAuth();
      const signed = await signIn(auth, calls);
      if (!signed.ok) return signed;
      const expected = {
        user: {
          id: USER_ID,
          login: "octocat",
          name: "The Octocat",
          avatarUrl: "https://avatars.githubusercontent.com/u/1",
        },
        provider: "github",
        expires: EXPIRES,
      };
      const body = expectEq(signed.session, expected, "session");
      if (!body.ok) return body;
      if (calls.length !== 1) {
        return { ok: false, error: `expected 1 fetch, got ${calls.length}` };
      }
      if (!String(calls[0].url).endsWith("/auth/v1/token?grant_type=pkce")) {
        return { ok: false, error: `token url ${calls[0].url}` };
      }
      const sent = JSON.parse(calls[0].init.body);
      if (sent.auth_code !== "code-1") {
        return { ok: false, error: `auth_code ${sent.auth_code}` };
      }
      if (signed.session.accessToken || signed.session.ticket) {
        return { ok: false, error: "public session leaked ticket" };
      }
      const disk = JSON.parse(fs.readFileSync(path.join(home, "session.json"), "utf8"));
      if (disk.ticket.accessToken !== "access-test") {
        return { ok: false, error: "ticket not persisted" };
      }
      if (Object.prototype.hasOwnProperty.call(signed.session, "accessToken")) {
        return { ok: false, error: "accessToken on public session" };
      }
      if (fs.existsSync(path.join(home, "pending.json"))) {
        return { ok: false, error: "pending.json survived callback" };
      }
      return expectEq(auth.session().data, expected, "session()");
    })
  );

  rows.push(
    await runCase("session survives a new createAuth on the same home", async () => {
      const home = tmpHome();
      const first = makeAuth({ home });
      const signed = await signIn(first.auth, first.calls);
      if (!signed.ok) return signed;
      const again = createAuth({
        home,
        platform: "darwin",
        env: envOk(),
        now: () => NOW,
        fetch: first.auth.fetch,
      });
      return expectEq(
        again.session().data,
        {
          user: {
            id: USER_ID,
            login: "octocat",
            name: "The Octocat",
            avatarUrl: "https://avatars.githubusercontent.com/u/1",
          },
          provider: "github",
          expires: EXPIRES,
        },
        "reopened session"
      );
    })
  );

  rows.push(
    await runCase("expired session is SESSION_EXPIRED", async () => {
      const home = tmpHome();
      const writer = makeAuth({ home });
      const wrote = await signIn(writer.auth, writer.calls);
      if (!wrote.ok) return wrote;
      const reader = createAuth({
        home,
        platform: "darwin",
        env: envOk(),
        now: () => Date.parse("2026-09-18T16:00:00.000Z"),
      });
      return expectReject(reader.session(), "SESSION_EXPIRED");
    })
  );

  rows.push(
    await runCase("state mismatch is STATE_MISMATCH", async () => {
      const { auth } = makeAuth();
      const started = expectOk(auth.startOAuth());
      if (!started.ok) return started;
      const cb = await auth.handleCallback({
        url: "http://127.0.0.1:7450/auth/callback?state=nope&code=code-1",
      });
      return expectReject(cb, "STATE_MISMATCH");
    })
  );

  rows.push(
    await runCase("second callback without a new start is NO_PENDING", async () => {
      const { auth, calls } = makeAuth();
      const signed = await signIn(auth, calls);
      if (!signed.ok) return signed;
      const again = await auth.handleCallback({
        url: `${signed.started.redirectTo}&code=code-1`,
      });
      return expectReject(again, "NO_PENDING");
    })
  );

  rows.push(
    await runCase("access_denied is OAUTH_DENIED", async () => {
      const { auth } = makeAuth();
      expectOk(auth.startOAuth());
      const cb = await auth.handleCallback({
        url: "http://127.0.0.1:7450/auth/callback?error=access_denied&error_description=user+denied",
      });
      return expectReject(cb, "OAUTH_DENIED");
    })
  );

  rows.push(
    await runCase("implicit hash token is IMPLICIT_FLOW", () => {
      return expectReject(
        parseCallbackInput("http://127.0.0.1:7450/auth/callback#access_token=steal"),
        "IMPLICIT_FLOW"
      );
    })
  );

  rows.push(
    await runCase("signOut clears the Mac files", async () => {
      const { auth, home, calls } = makeAuth();
      const signed = await signIn(auth, calls);
      if (!signed.ok) return signed;
      const out = expectOk(auth.signOut());
      if (!out.ok) return out;
      if (fs.existsSync(path.join(home, "session.json"))) {
        return { ok: false, error: "session.json remained" };
      }
      return expectEq(auth.session().data, null, "signed out session");
    })
  );

  rows.push(
    await runCase("linux without home is PLATFORM_UNSUPPORTED", () => {
      const auth = createAuth({ platform: "linux", env: envOk(), now: () => NOW });
      return expectReject(auth.session(), "PLATFORM_UNSUPPORTED");
    })
  );

  rows.push(
    await runCase(".env.example holds the locked public ids and empty secrets", () => {
      const text = fs.readFileSync(path.join(__dirname, "..", ".env.example"), "utf8");
      if (!text.includes("GITHUB_CLIENT_ID=Ov23li0XxVscnZ92pG17")) {
        return { ok: false, error: "client id line missing" };
      }
      if (!text.includes("SUPABASE_URL=https://ahuvocemlpqmbcvqlxve.supabase.co")) {
        return { ok: false, error: "supabase url line missing" };
      }
      if (!/SUPABASE_ANON_KEY=\s*$/m.test(text) && !text.includes("SUPABASE_ANON_KEY=\n")) {
        return { ok: false, error: "anon key must be an empty assignment" };
      }
      if (!text.includes("GITHUB_CLIENT_SECRET=")) {
        return { ok: false, error: "client secret placeholder missing" };
      }
      if (/eyJ[A-Za-z0-9_-]{20,}/.test(text) || /ghp_/.test(text) || /sk-/.test(text)) {
        return { ok: false, error: "secret-shaped value in .env.example" };
      }
      return { ok: true };
    })
  );

  rows.push(
    await runCase("describeReject is exhaustive for the closed code list", () => {
      for (const code of REJECT_CODES) {
        const text = describeReject(code);
        if (typeof text !== "string" || text.length < 8) {
          return { ok: false, error: `empty describe for ${code}` };
        }
      }
      if (FENCE !== "studio/auth") {
        return { ok: false, error: `fence ${FENCE}` };
      }
      return { ok: true };
    })
  );

  return rows;
}

cases().then((rows) => {
  let failed = 0;
  for (const row of rows) {
    if (row.ok) {
      process.stdout.write(`PASS ${row.name}\n`);
    } else {
      failed += 1;
      process.stderr.write(`FAIL ${row.name}: ${row.detail}\n`);
    }
  }
  process.stdout.write(
    failed === 0
      ? `studio-auth ${rows.length} ok; not a 14d verdict\n`
      : `studio-auth ${failed} failed / ${rows.length}\n`
  );
  process.exit(failed === 0 ? 0 : 1);
});
