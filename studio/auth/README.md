# studio/auth

In-app GitHub login for AI Coding Studio on Mac. A human signs in with GitHub. Supabase project `ahuvocemlpqmbcvqlxve` is the shared sync plane for every signed-in human. This tree issues and caches the session. It does not draw chrome and it does not edit `studio/shell`.

`verdict` stays null. `clock_started` stays false.

## Stranger path

Node 18+. No `npm install`.

```bash
git clone https://github.com/nyfeblade/rd-os.git
cd rd-os/studio/auth
npm test
echo "exit=$?"
```

Expected: **exit 0**. The harness mocks the token exchange. It does not call GitHub or Supabase.

Live login on a Mac needs a secret-requested `SUPABASE_ANON_KEY`. Copy `.env.example` to `.env` on your machine. Do not commit `.env`.

## Auth model

1. Studio opens `{SUPABASE_URL}/auth/v1/authorize?provider=github` with PKCE (`s256`).
2. GitHub sees the Studio OAuth app `Ov23li0XxVscnZ92pG17`.
3. GitHub returns to `https://ahuvocemlpqmbcvqlxve.supabase.co/auth/v1/callback`.
4. Supabase returns to the app `redirect_to` with `?code=` and `?state=`.
5. `handleCallback` POSTs `/auth/v1/token?grant_type=pkce` and stores `{ user, provider, expires }`.

GitHub user OAuth is not a GitHub App installation and not a bot token. Auth failures stay in the connectors tray as `needs_auth`. They are not inbox items.

The GitHub client secret never enters this process. It lives in the GitHub app and the Supabase Auth provider settings.

## Env contract

| Name | In git | Value |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | `.env.example` | `Ov23li0XxVscnZ92pG17` |
| `SUPABASE_URL` | `.env.example` | `https://ahuvocemlpqmbcvqlxve.supabase.co` |
| `SUPABASE_ANON_KEY` | empty placeholder | secret-request. Tests inject a fake key. |
| `GITHUB_CLIENT_SECRET` | empty placeholder | never read by this module |

A different `GITHUB_CLIENT_ID` or `SUPABASE_URL` is `UNKNOWN_GITHUB_CLIENT` or `UNKNOWN_SUPABASE_URL`.

## Public API

```js
const { createAuth } = require("@rd-os/studio-auth");

const auth = createAuth({
  home: "/tmp/studio-auth-home",
  env: process.env,
  fetch,
});

const started = auth.startOAuth();
const session = await auth.handleCallback({ url: incoming });
auth.session();
auth.signOut();
```

`user` is `{ id, login, name, avatarUrl }`. `id` is the Supabase user id (sync-plane key). `login` is the GitHub username.

Access and refresh tokens stay in `session.json` on disk. `session()` does not return them.

Default Mac home is `~/Library/Application Support/AI Coding Studio/auth`. Tests and Linux hosts must pass `home`. `win32` is `PLATFORM_UNSUPPORTED`.

## Shell later

See [SHELL-IPC.md](./SHELL-IPC.md). This package does not register Electron IPC.

## Fence

WRITE: `studio/auth/**` only.

Do not edit `studio/shell/**`, `studio/mcp/**`, `studio/seats/**`, `studio/chat-engine/**`, or `studio/connectors/runtime/**`.
