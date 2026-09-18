# Studio connectors catalog

**SoT for the connectors tray.** Official vendor docs fetched 2026-09-18; cited HTTP URLs re-scanned the same day (docs 2xx; hosted MCP often 401/405 on bare GET). A cell marked **UNVERIFIED** means no official page confirmed the endpoint; do not invent one.

`verdict` stays null. `clock_started` stays false. Listing a tool is not a claim that Studio is wired to it.

**Columns:** name · priority · type (`MCP` \| `API` \| `CLI` \| `connector`) · official MCP/docs URL · auth (public) · tray use.

Two-way columns live in the section below (`ingest` \| `reply` \| `bot_send` \| `tray_state` \| `p0_wire`). Catalog tier is unchanged: Slack stays P1 in the table; P0 wire is the runtime, not a priority rewrite.

---

## Two-way (P0 wire)

Connectors are **bidirectional** (CONNECTORS-TWO-WAY lock). Runtime SoT: [`runtime/`](runtime/). Inbox: Chat thread preferred; Board card if `needs_gate`. Reply composer is the same Chat composer, **bound** to the active notification (`bound_to`). Tray is not read-only. Shell does not invent providers or endpoints.

| Name | ingest | reply | bot_send | tray_state | p0_wire |
| --- | --- | --- | --- | --- | --- |
| GitHub MCP | [Webhook events](https://docs.github.com/en/webhooks/webhook-events-and-payloads): PR/issue comments, review requests, **CI@you** (`check_suite` / `workflow_run` failure and `at_you===true`) → inbox (`need_you`) | closed ops `create_issue_comment` \| `create_pull_request_review_comment` \| `create_pull_request_review` — [REST issue comments](https://docs.github.com/en/rest/issues/comments); composer `bound_to` the inbox item | same ops; requires **in-studio-only cutover attached** *and* `human_gate.status===approved` (no silent bot spam) | `live` \| `needs_auth` \| `error` \| `disconnected` | yes |
| Slack (eng) | [Events API](https://docs.slack.dev/apis/events-api/): eng channel `app_mention` + DM `@mentions` (`channel_type=im` and `<@…>` in text) → inbox | closed op `post_message` — [chat.postMessage](https://docs.slack.dev/reference/methods/chat.postMessage); composer `bound_to` the inbox item | same op; same cutover + human-gate hooks | `live` \| `needs_auth` \| `error` \| `disconnected` | yes |

P1+ rows keep the same two-way pattern when a later runtime PR enables them. `p0_wire` is not a catalog-tier change.

---

## P0

| Name | Priority | Type | Official MCP / docs | Auth (public) | Tray use |
| --- | --- | --- | --- | --- | --- |
| GitHub MCP | P0 | MCP | [github/github-mcp-server](https://github.com/github/github-mcp-server) · remote `https://api.githubcopilot.com/mcp/` · [docs.github.com setup](https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp/set-up-the-github-mcp-server) | OAuth or PAT (`GITHUB_PERSONAL_ACCESS_TOKEN` / Bearer). Toolsets + optional `/readonly`. | Repos, issues, PRs, Actions for the Code pane and board gates. |
| Cursor / Cloud Agents | P0 | connector | [Cloud Agents](https://cursor.com/docs/cloud-agent) · [MCP in Cursor](https://cursor.com/docs/mcp) · [Cloud Agents API](https://cursor.com/docs/cloud-agent/api/endpoints) | Cursor Dashboard API key (Basic or Bearer). Team MCP via Dashboard → Integrations & MCP. | Seat host: launch/inspect Cloud Agent runs; attach other tray MCPs to the run. |
| Claude | P0 | connector | [MCP connector (Messages API)](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector) · [Claude Code MCP](https://code.claude.com/docs/en/mcp) · [Claude API](https://platform.claude.com/docs) | API key (`x-api-key`) for the Messages API. Remote MCP: OAuth / `authorization_token` on `mcp_servers`. Claude Code: `/mcp` login. | Seat: Claude Code / API complete; pull remote MCP tools into the thread. |
| Grok / xAI | P0 | API | [docs.x.ai overview](https://docs.x.ai/overview) · [quickstart / API key](https://docs.x.ai/developers/quickstart) · REST [api.x.ai/docs](https://api.x.ai/docs/) | Bearer `XAI_API_KEY` minted from the xAI console (steps on the quickstart). **No official xAI MCP found** — do not invent one. | Seat: Grok / Grok Build complete. |
| Linear MCP | P0 | MCP | [linear.app/docs/mcp](https://linear.app/docs/mcp) · hosted `https://mcp.linear.app/mcp` | OAuth 2.1 (DCR) or `Authorization: Bearer` API key. Read-only: `https://mcp.linear.app/mcp/readonly`. | Issues / projects for board intake and eng tickets. |
| Sentry MCP | P0 | MCP | [mcp.sentry.dev](https://mcp.sentry.dev/) · [getsentry/sentry-mcp](https://github.com/getsentry/sentry-mcp) · hosted `https://mcp.sentry.dev/mcp` | OAuth on first connect. Optional org/project path scope. Token header: `Authorization: Sentry-Bearer` (not `Bearer`). | Live errors / traces for the current repo. |
| Vercel MCP | P0 | MCP | [Vercel MCP docs](https://vercel.com/docs/agent-resources/vercel-mcp) · hosted `https://mcp.vercel.com` | OAuth. Public doc tools without auth; project tools after Vercel login. Project-scoped URL via `vercel mcp --project`. | Preview deploys, logs, project status for the current app. |

---

## P1

| Name | Priority | Type | Official MCP / docs | Auth (public) | Tray use |
| --- | --- | --- | --- | --- | --- |
| Atlassian Rovo MCP | P1 | MCP | [Getting started](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/) · [developer.atlassian.com/cloud/rovo-mcp](https://developer.atlassian.com/cloud/rovo-mcp/) · [atlassian/atlassian-mcp-server](https://github.com/atlassian/atlassian-mcp-server) · hosted `https://mcp.atlassian.com/v2/mcp` | OAuth 2.1 or API token. Actions stay inside the user's Atlassian ACL. | Jira / Confluence / Bitbucket for tickets and specs. |
| GitLab | P1 | MCP | [GitLab MCP server](https://docs.gitlab.com/user/model_context_protocol/mcp_server/) · HTTP path `/api/v4/mcp` on the GitLab host · [glab mcp serve](https://docs.gitlab.com/cli/mcp/serve/) (stdio, experimental) | OAuth (dynamic client registration) or PAT on the GitLab instance. | GitLab issues / MRs / pipelines when the repo is not GitHub. |
| Datadog | P1 | MCP | [Datadog MCP Server](https://docs.datadoghq.com/mcp_server/) · [setup](https://docs.datadoghq.com/mcp_server/setup/) | OAuth 2.0, or headers `DD_API_KEY` + `DD_APPLICATION_KEY`. URL is **site-specific** (see setup page). Official Datadog Labs README documents US1 `https://mcp.datadoghq.com/v1/mcp`. | Prod metrics / logs / monitors next to a failing deploy. |
| Grafana | P1 | MCP | [grafana/mcp-grafana](https://github.com/grafana/mcp-grafana) · [Grafana MCP client setup](https://grafana.com/docs/grafana/latest/developer-resources/mcp/set-up/client-configuration-examples/) | Service account token: `GRAFANA_URL` + `GRAFANA_SERVICE_ACCOUNT_TOKEN`. Local `uvx mcp-grafana` (stdio). **No vendor-hosted MCP URL published** on those pages. | Dashboards / datasources for the same on-call slice as Datadog. |
| Cloudflare MCP | P1 | MCP | [Cloudflare's own MCP servers](https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/) · hosted `https://mcp.cloudflare.com/mcp` · docs server `https://docs.mcp.cloudflare.com/mcp` | OAuth (permission picker) or Cloudflare API token. | Workers / DNS / cache / logs for edge deploys. |
| Figma MCP | P1 | MCP | [Figma MCP server](https://developers.figma.com/docs/figma-mcp-server/) · remote `https://mcp.figma.com/mcp` | Figma OAuth. Remote recommended; desktop Dev Mode server is `http://127.0.0.1:3845/mcp`. Client allowlist applies. | Design-to-code context for UI work in the Code pane. |
| Docker | P1 | MCP | [Docker MCP Catalog](https://docs.docker.com/ai/mcp-catalog-and-toolkit/catalog/) · [MCP Toolkit](https://docs.docker.com/ai/mcp-catalog-and-toolkit/toolkit/) · browse [hub.docker.com/mcp](https://hub.docker.com/mcp) | Docker Desktop login. Remote catalog servers often OAuth via Toolkit. Local servers run as signed `mcp/*` images. | Run / attach containerized MCP servers; image + compose context. |
| Kubernetes | P1 | CLI | [Kubernetes API](https://kubernetes.io/docs/reference/using-api/) · [kubectl](https://kubernetes.io/docs/reference/kubectl/) | kubeconfig / in-cluster SA. **No Kubernetes-project official MCP** on kubernetes.io. Docker Catalog lists a third-party `mcp/kubernetes` image — not K8s SIGs. | Cluster get/apply/logs via kubectl or official API only until an official MCP exists. |
| Terraform MCP | P1 | MCP | [Terraform MCP server](https://developer.hashicorp.com/terraform/mcp-server) · [hashicorp/terraform-mcp-server](https://github.com/hashicorp/terraform-mcp-server) | Public registry: none. HCP / TFE: `TFE_TOKEN` (+ `TFE_HOSTNAME` / `TFE_ADDRESS` for TFE). | Provider docs + workspace/runs when generating or reviewing Terraform. |
| Notion | P1 | MCP | [Notion MCP overview](https://developers.notion.com/guides/mcp/overview) · [get started](https://developers.notion.com/guides/mcp/get-started-with-mcp) · hosted `https://mcp.notion.com/mcp` | OAuth (hosted). Legacy SSE: `https://mcp.notion.com/sse`. Open-source bearer server is unmaintained per Notion. | Specs / experiment notes (eng-readable), not a second board SoT. |
| Slack (eng) | P1 | MCP | [Slack MCP server](https://docs.slack.dev/ai/slack-mcp-server) · hosted `https://mcp.slack.com/mcp` | Confidential OAuth (`client_id` / `client_secret`) on a registered Slack app. Admin-approved clients. Partner one-click: Claude, Cursor, others. | Eng channels / threads — search and post, not a chat home. |
| LaunchDarkly | P1 | MCP | [Hosted MCP](https://launchdarkly.com/docs/home/getting-started/mcp-hosted) · hosted `https://mcp.launchdarkly.com/mcp/launchdarkly` | OAuth. | Flag read/toggle while shipping a gated change. |
| Neon | P1 | MCP | [Neon MCP server](https://neon.com/docs/ai/neon-mcp-server) · hosted `https://mcp.neon.tech/mcp` | OAuth or Bearer API key. Optional `?readonly=true`, `?projectId=`, `?category=`. | Postgres branches / SQL for the app database. |
| Supabase | P1 | MCP | [Supabase MCP](https://supabase.com/docs/guides/ai-tools/mcp) · hosted `https://mcp.supabase.com/mcp` · [supabase/mcp](https://github.com/supabase/mcp) | OAuth 2.1 (DCR). Local CLI: `http://localhost:54321/mcp` (subset, no OAuth). Query: `project_ref`, `read_only`, `features`. | Project schema / SQL / auth config. |
| Prisma | P1 | MCP | [Prisma MCP server](https://www.prisma.io/docs/ai/tools/mcp-server) · hosted `https://mcp.prisma.io/mcp` · [prisma/mcp](https://github.com/prisma/mcp) | Prisma Console OAuth on first use. Local: `npx -y prisma mcp`. | Prisma Postgres + schema/migrate from the seat. |
| Postman | P1 | MCP | [Remote Postman MCP](https://learning.postman.com/docs/developer/postman-api/postman-mcp-server/postman-mcp-remote-server) · US full `https://mcp.postman.com/mcp` · default `https://mcp.postman.com/minimal` | US: OAuth (DCR/PKCE) or Bearer Postman API key. EU: API key only (`mcp.eu.postman.com`). | Collections / specs so agents call the real API, not a guessed path. |
| CodeRabbit | P1 | connector | [CodeRabbit API](https://docs.coderabbit.ai/api) · [CLI](https://docs.coderabbit.ai/cli/headless-cli-integration) · [MCP *client*](https://docs.coderabbit.ai/connections/mcp-servers) | API: `https://api.coderabbit.ai` + `x-coderabbitai-api-key`. CLI: Agentic API key. **CodeRabbit is an MCP client, not a hosted MCP server.** | PR review bot + CLI review; do not add a fake `mcp.coderabbit` URL. |

---

## P2

### Cloud providers

| Name | Priority | Type | Official MCP / docs | Auth (public) | Tray use |
| --- | --- | --- | --- | --- | --- |
| AWS MCP | P2 | MCP | [awslabs/mcp](https://github.com/awslabs/mcp) · Knowledge MCP [docs](https://awslabs.github.io/mcp/servers/aws-knowledge-mcp-server) · hosted `https://knowledge-mcp.global.api.aws` ([GA announcement](https://aws.amazon.com/about-aws/whats-new/2025/10/aws-knowledge-mcp-server-generally-available/)) | Knowledge MCP: none (rate-limited). AWS API MCP (preview, managed): IAM; no long-lived keys in the agent. Local AWS Labs servers: local AWS creds. | Docs + (preview) audited AWS API ops for infra questions. |
| Azure MCP | P2 | MCP | [Azure MCP Server](https://learn.microsoft.com/en-us/azure/developer/azure-mcp-server/) · [overview](https://learn.microsoft.com/en-us/azure/developer/azure-mcp-server/overview) · [microsoft/mcp Azure.Mcp.Server](https://github.com/microsoft/mcp/tree/main/servers/Azure.Mcp.Server) | Azure CLI / Entra (`az login`). Common local launch: `npx -y @azure/mcp@latest server start`. | Subscription resources, logs, azd from the seat. |
| Google Cloud MCP | P2 | MCP | [Google Cloud MCP overview](https://docs.cloud.google.com/mcp/overview) · [manage servers](https://docs.cloud.google.com/mcp/manage-mcp-servers) | Google / ADC identity + IAM role `roles/mcp.toolUser` and service perms. Remote MCP is **per enabled product** (example in docs: `https://bigquery.googleapis.com/mcp`). No single catch-all GCP MCP URL. | Product-scoped GCP tools after the API is enabled. |

### IaC / CI / incident / AppSec / data / browser / registries

| Name | Priority | Type | Official MCP / docs | Auth (public) | Tray use |
| --- | --- | --- | --- | --- | --- |
| Pulumi | P2 | MCP | [Pulumi MCP server](https://www.pulumi.com/docs/ai/mcp-server/) · hosted `https://mcp.ai.pulumi.com/mcp` | OAuth + Pulumi access token / org picker on first connect. Local `@pulumi/mcp-server` needs Pulumi CLI. | Stack search, registry schema, preview/up from the seat. |
| CircleCI (CI alt) | P2 | MCP | [CircleCI MCP](https://circleci.com/product/mcp/) · hosted `https://mcp.circleci.com/v1/mcp` | OAuth2 (hosted) or existing CircleCI CLI login (local `circleci mcp`). Headless: Bearer API token. | Pipeline / test failures for the current SHA. |
| Buildkite (CI alt) | P2 | MCP | [Buildkite MCP server](https://buildkite.com/docs/apis/mcp-server) · hosted `https://mcp.buildkite.com/mcp` | OAuth (interactive). Headless token pass-through on a separate remote URL documented on that page. | Pipelines / jobs / Test Engine. |
| Jenkins (CI alt) | P2 | API | [Jenkins Remote Access API](https://www.jenkins.io/doc/book/using/remote-access-api/) | API token or crumb + session, per Jenkins security realm. **No official Jenkins MCP** on jenkins.io. | Job status / console when the org still runs Jenkins. |
| PagerDuty | P2 | MCP | [PagerDuty MCP (support)](https://support.pagerduty.com/main/docs/pagerduty-mcp-server) · [developer MCP docs](https://developer.pagerduty.com/docs/mcp-server) · hosted `https://mcp.pagerduty.com/mcp` · EU `https://mcp.eu.pagerduty.com/mcp` | OAuth or User API token (`Token token=`). Local: `uvx pagerduty-mcp` (read-only default). | Incidents / on-call next to Sentry and Datadog. |
| Snyk | P2 | MCP | [Snyk Studio / MCP](https://docs.snyk.io/agent-security) · [getting started](https://docs.snyk.io/agent-security/agentic-security-with-snyk-studio/getting-started-with-snyk-studio) | Snyk CLI auth (`snyk_auth`). Local only: `npx -y snyk@latest mcp -t stdio`. **Snyk does not host a remote MCP.** | SCA / Code / IaC / container scans on the working tree. |
| Checkmarx | P2 | MCP | [Checkmarx MCP Server](https://docs.checkmarx.com/en/34965-659697-checkmarx-mcp-server.html) | OAuth (predefined `cx-mcp-client` or DCR) or API key. Path: `<CX_BASE_URL>/api/security-mcp/mcp` (+ optional `/{tenant}`). | Trigger / read Checkmarx One findings. |
| Port | P2 | MCP | [Port MCP overview](https://docs.port.io/agent-management/port-mcp-server/overview/) · [install](https://docs.port.io/agent-management/port-mcp-server/installation/) · EU `https://mcp.port.io/v1` · US `https://mcp.us.port.io/v1` | Port user session / OAuth (remote). Optional header `x-read-only-mode`. | Software catalog / scorecards / self-service actions. |
| Jam | P2 | MCP | [Jam MCP](https://jam.dev/docs/jam-mcp) · hosted `https://mcp.jam.dev/mcp` | Browser OAuth, or PAT Bearer (`mcp:read` / `mcp:write`) from Settings → MCP. | Paste a Jam link → console, network, events, transcript in the seat. |
| dbt | P2 | MCP | [About dbt MCP](https://docs.getdbt.com/docs/dbt-ai/about-mcp) · [remote setup](https://docs.getdbt.com/docs/dbt-ai/setup-remote-mcp) · [dbt-labs/dbt-mcp](https://github.com/dbt-labs/dbt-mcp) | Remote: OAuth or `Authorization: Token` / `Bearer` PAT + `x-dbt-prod-environment-id`. Use the MCP Endpoint URL from Account settings (path `/api/ai/v1/mcp` on the dbt host). Local: `uvx dbt-mcp`. | Models / Semantic Layer / job runs for analytics eng. |
| Temporal | P2 | MCP | [Temporal + AI / docs MCP](https://docs.temporal.io/with-ai) · hosted docs KB `https://temporal.mcp.kapa.ai` | Docs MCP: OAuth (Google / GitHub). Cluster ops: Temporal Cloud API key or mTLS via Temporal CLI / SDK. Code Exchange lists a workflow MCP; **no official hosted cluster MCP URL** on docs.temporal.io. | Docs-grounded Temporal answers; cluster control stays CLI/API unless you run a listed server. |
| Langfuse | P2 | MCP | [Langfuse MCP server](https://langfuse.com/docs/api-and-data-platform/features/mcp-server) · data `https://cloud.langfuse.com/api/public/mcp` · public docs MCP `https://langfuse.com/api/mcp` | Data plane: HTTP Basic (`pk:sk` base64). Docs MCP: none. US/HIPAA hosts documented on the same page. | Prompts / traces for LLM experiments. |
| Chrome DevTools MCP | P2 | MCP | [Chrome for Developers post](https://developer.chrome.com/blog/chrome-devtools-mcp) · [ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) | Local Chrome. Typical: `npx -y chrome-devtools-mcp@latest`. Optional attach `http://127.0.0.1:9222`. | Live DOM / network / perf traces for the app under test. |
| npm registry | P2 | API | [npm Public Registry API](https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md) · registry host [registry.npmjs.org](https://registry.npmjs.org/) | Read: none. Publish: npm token. | Resolve versions / packuments before adding a dependency. |
| PyPI | P2 | API | [PyPI APIs](https://docs.pypi.org/api/) · [JSON API](https://docs.pypi.org/api/json/) | Read: none. Upload: Trusted Publisher or token to `upload.pypi.org`. | Resolve project / release metadata. |
| crates.io | P2 | API | Cargo [registry web API](https://doc.rust-lang.org/stable/cargo/reference/registry-web-api.html) · [sparse index](https://index.crates.io/) | Read: none (rate limits / identifying User-Agent; see Cargo book). Publish: API token via `cargo login`. | Crate search / owners for Rust deps. |
| Docker Hub | P2 | API | [Docker Hub API](https://docs.docker.com/reference/api/hub/latest/) | Public pulls: none / limited. Private: Hub PAT / OAuth. | Image tags / repos for the deploy path. |
| Maven Central | P2 | API | [Central Portal / search APIs](https://central.sonatype.org/search/rest-api-guide/) | Read: none. Publish: Central Portal token. | Java / JVM coordinate lookup. |

---

## Notes

- **Type** is the tray-primary surface. Most MCP rows also have a REST API; do not duplicate the row unless the tray treats them as separate tiles.
- **UNVERIFIED** is reserved for endpoints we could not pin to an official page. None of the hosted MCP URLs above are marked UNVERIFIED.
- Kubernetes, Jenkins, CodeRabbit, and xAI have official **API/CLI/connector** docs but **no official MCP server URL** on the pages checked.
- Grafana and Snyk official MCPs are **local** (stdio / CLI), not a single public vendor MCP host.
- Google Cloud MCP URLs are **per product**, not one org-wide host.
- Shell / seats: consume this file only. Auth material never lands in `studio/connectors/**`.
