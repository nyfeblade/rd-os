# Shell IPC sketch

The shell CA owns Electron. This file is the consume contract. Do not edit `studio/shell` from this lane.

## Load

Main process:

```js
const { createAuth } = require("../auth");

const auth = createAuth({
  env: process.env,
  platform: process.platform,
  redirectTo: "http://127.0.0.1:7450/auth/callback",
});
```

On Mac, omit `home` to use Application Support. On any other host, pass `home` or every call returns `PLATFORM_UNSUPPORTED`.

## Channels

| Channel | Main calls | Result |
| --- | --- | --- |
| `auth:start` | `auth.startOAuth(payload)` | `{ url, state, redirectTo, supabaseCallback }` |
| `auth:callback` | `auth.handleCallback(payload)` | `{ user, provider, expires }` |
| `auth:session` | `auth.session()` | session or `null` |
| `auth:signOut` | `auth.signOut()` | `{ signedOut: true }` |

Preload exposes `window.studioAuth.start()`, `.callback(url)`, `.session()`, `.signOut()`. Renderer never talks to Supabase.

## Main loop

1. Tray `needs_auth` or Chat empty CTA calls `auth:start`.
2. Main opens `started.data.url` with `shell.openExternal`.
3. Loopback on `127.0.0.1:7450` or a custom protocol collects the redirect.
4. Main calls `auth:callback` with the full URL.
5. Renderer reads `auth:session` and flips the GitHub tray to `live`.

## Errors the tray can show

`MISSING_ANON_KEY`, `OAUTH_DENIED`, `STATE_MISMATCH`, `SESSION_EXPIRED`, `PLATFORM_UNSUPPORTED`. Use `describeReject(code)` for copy.

## Out

No Windows paths. No GitHub client secret on the wire. No implicit `#access_token=` flow.
