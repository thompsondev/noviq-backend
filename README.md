# Noviq Backend

Backend API for **Noviq** — AI Employees for Revenue Growth. This service is the current MVP: a NestJS API that exposes an AI-powered assistant, backed by PostgreSQL (TypeORM) and Claude via the official Anthropic SDK. It's the foundation the fuller Noviq platform (company discovery, research, personalized content generation, outreach, CRM, and specialized AI agents) will be built on top of.

## Features

- **Auth** – `modules/auth`: signup, email OTP verification, resend-OTP (60s cooldown), signin, forgot/reset password, logout — httpOnly-cookie sessions backed by Redis, bcrypt-hashed passwords. `GET /v1/user/session` reads the current session. Emails send via Resend or ZeptoMail, switched with one env var (`EMAIL_PROVIDER`) — see Email provider below; if unset, OTP/reset codes are logged server-side instead of emailed
- **Companies / Discover** – `modules/companies`: `POST /v1/companies/search` (org-scoped, domain-deduped) and `GET /v1/companies`, both behind session auth. Company data comes from Claude's web search tool (`CompanySourceService` → `ClaudeAiService.generateWithWebSearch`) rather than a paid provider — results must come from an actual search hit, never fabricated; a failed/unavailable search degrades to an empty list
- **Research Agent** – `modules/agents`: `POST /v1/companies/:id/research` fetches a company's real website via Claude's web fetch tool (`ClaudeAiService.generateWithWebFetch`) and extracts products/pricing/competitors/tech stack/pain points — never fabricated, 24h freshness cache, bounded retries (2 attempts). `GET /v1/agents/runs` / `/:id` expose a generic `AgentRun` monitoring surface shared by future agent types
- **Email generation (Studio)** – `modules/assets`: `POST /v1/assets/generate` writes a personalized `GeneratedAsset` (email) from a company's completed research via `ClaudeAiService.generatePlain` — no web tools needed since it synthesizes from research already gathered. Blocks with a clear error if research isn't `completed` yet rather than generating a generic email. `GET /v1/assets` lists an org's generated assets
- **AI chat endpoint** – `POST /v1/chat/prompt` returns a complete AI-generated text response
- **Streaming endpoint** – `POST /v1/chat/prompt/stream` streams the AI response as SSE (`text/event-stream`); emits `text` delta events → `done`
- **Configurable AI** – Calls Claude directly via [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript); model and API key via env
- **Optional API key auth** – Set `API_KEY` in env to require an `x-api-key` header on all routes; omit for open access. When open access: only domains listed in `DOMAIN_CHAT` (one or more, comma-separated) have a per-day-per-IP limit (default **5**, or `PROMPTS_PER_DAY_CHAT`); all other domains are **unlimited**. Omit `DOMAIN_CHAT` for unlimited prompts everywhere. Orthogonal to the per-user session auth above.
- **Demo page** – Root URL serves a streaming chat UI (`public/index.html`): prompt box, Enter to send, Shift+Enter for new line, paste-to-attachment for long text
- **API docs** – [Scalar](https://scalar.com/) API reference at `/v1/docs` with configurable servers and Bearer auth
- **Security** – Helmet, rate limiting, CORS, global validation pipe, and a custom exception filter
- **Database** – PostgreSQL with TypeORM (migrations)
- **Logging** – Custom logger service; timezone set to Africa/Lagos

## Tech stack

- [NestJS](https://nestjs.com/) 11
- [TypeORM](https://typeorm.io/) (PostgreSQL)
- [Redis](https://redis.io/) (`ioredis`) — sessions, OTP codes, password reset codes
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) (`@anthropic-ai/sdk`) — direct Claude integration
- [Scalar](https://scalar.com/) + [NestJS Swagger](https://docs.nestjs.com/openapi/introduction) (OpenAPI)
- TypeScript, class-validator, class-transformer, Winston, bcrypt

## Prerequisites

- **Node.js** 22.10.7+ (see `engines` in `package.json`)
- **pnpm** (recommended) or npm/yarn
- **PostgreSQL** (local or remote)
- **Anthropic API key**

## Project setup

```bash
pnpm install
```

## Environment variables

Copy the example file and set your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/noviq`) |
| `REDIS_URL` | Yes | Redis connection string — required for auth sessions, OTP, and password reset codes |
| `ANTHROPIC_API_KEY` | Yes | API key for Claude |
| `ANTHROPIC_MODEL` | No | Model identifier (default: `claude-sonnet-5`) |
| `PORT` | No | Server port (default: `3000`) |
| `NODE_ENV` | No | Set to `production` to mark the session cookie `Secure` (HTTPS only) |
| `API_KEY` | No | If set, all routes require an `x-api-key: <value>` header. Omit or leave blank for open access. |
| `DOMAIN_CHAT` | No | When `API_KEY` is not set: comma-separated list of hostnames that get a per-day-per-IP limit (request `Host` must match one). Only these domains are limited; all other domains are **unlimited**. Omit for unlimited everywhere. |
| `PROMPTS_PER_DAY_CHAT` | No | For domains listed in `DOMAIN_CHAT`, this many prompts per day per IP (default **5**). Ignored if `DOMAIN_CHAT` is not set. |
| `PLATFORM_NAME` | No | Name used in API docs title (default: `Noviq`) |
| `PLATFORM_URL` | No | Main app URL (for API docs). Also used for branding: copyright is shown on localhost and when the request host is the same as or a subdomain of this URL's host; otherwise it is hidden. |
| `DEVELOPMENT_URL` | No | Dev server host (for API docs) |
| `PRODUCTION_URL` | No | Production host (for API docs) |
| `AUTHOR_NAME` | No | Author handle shown in the demo UI header ("by X") and footer when the request is from `PLATFORM_URL` or a subdomain; omit to hide both |
| `AUTHOR_URL` | No | URL for the footer author link; only used when `AUTHOR_NAME` is set and branding is shown |
| `CORS_ORIGINS` | No | Comma-separated list of extra allowed origins (e.g. `https://app.com,https://other.com`). All `http(s)://localhost` and `http(s)://127.0.0.1` ports are always allowed by default. |
| `EMAIL_PROVIDER` | No | `resend` or `zeptomail`. Omit to log OTP/reset emails to the console instead of sending them (local dev). See [Email provider](#email-provider) below. |
| `EMAIL_FROM` | If `EMAIL_PROVIDER` is set | Sender address, e.g. `noreply@yourdomain.com` |
| `EMAIL_FROM_NAME` | No | Sender display name (e.g. `Noviq`) |
| `RESEND_API_KEY` | If `EMAIL_PROVIDER=resend` | API key from the [Resend dashboard](https://resend.com/api-keys) |
| `ZEPTOMAIL_API_TOKEN` | If `EMAIL_PROVIDER=zeptomail` | The full `Authorization` header value ZeptoMail gives you (starts with `Zoho-enczapikey `) |
| `ZEPTOMAIL_API_URL` | No | Override for a non-default ZeptoMail region (default: `https://api.zeptomail.com/v1.1/email`) |

## Email provider

`EmailService` (`src/lib/email/email.service.ts`) sends every OTP/password-reset email in the app through one method, backed by a swappable provider:

- **No provider configured** (`EMAIL_PROVIDER` unset): emails are logged to the server console instead of sent — this is the default and is fine for local dev
- **Resend** (`EMAIL_PROVIDER=resend`): set `RESEND_API_KEY`, `EMAIL_FROM`
- **ZeptoMail** (`EMAIL_PROVIDER=zeptomail`): set `ZEPTOMAIL_API_TOKEN`, `EMAIL_FROM`

Switching providers is a one-line env change (`EMAIL_PROVIDER`) plus that provider's credentials — no code change. To add a third provider, implement `EmailProvider` (`src/lib/email/providers/email-provider.interface.ts`) and add one branch to `EmailService.buildProvider()`.

## Database

Run migrations:

```bash
pnpm run migration:run
```

To create a new migration after editing an entity:

```bash
pnpm run migration:generate -- src/lib/database/migrations/<Name>
```

## Run the project

```bash
# Development (watch mode)
pnpm run start:dev

# Production build and run (runs migrations, then nest build)
pnpm run build
pnpm run start:prod
```

- **App / demo UI**: `http://localhost:3000` (streaming chat page)
- **API**: `http://localhost:3000/v1` (all API routes use the `v1` prefix)
- **API docs (Scalar)**: `http://localhost:3000/v1/docs`

On startup the server logs `Unlimited prompts: true/false` and `Copyright: enabled/disabled` (enabled when `AUTHOR_NAME` is set; copyright is always shown on localhost and on `PLATFORM_URL` or its subdomains).

## Run tests

```bash
# Unit tests
pnpm run test

# E2E tests
pnpm run test:e2e

# Coverage
pnpm run test:cov
```

## API overview

- **Server** – `GET /v1` – Health / hello
- **Branding** – `GET /v1/branding` – Returns `{ authorName, authorUrl }` on localhost or when the request host is the same as or a subdomain of `PLATFORM_URL`; otherwise returns nulls (copyright hidden). Used by the demo UI to hydrate the header and footer.
- **Auth** – `POST /v1/auth/{signup,verify,resend-otp,signin,forgot,reset,logout}`, `GET /v1/user/session` – see [docs/10-api-specification.md](../docs/10-api-specification.md) for the full contract
- **Companies** – `POST /v1/companies/search`, `GET /v1/companies`, `POST /v1/companies/:id/research` – session-gated, org-scoped
- **Agents** – `GET /v1/agents/runs`, `GET /v1/agents/runs/:id` – agent run monitoring, session-gated, org-scoped
- **Assets** – `POST /v1/assets/generate`, `GET /v1/assets` – Studio email generation, session-gated, org-scoped
- **Chat** – `POST /v1/chat/prompt` – Body: `{ "prompt": "string" }` – Returns a complete AI-generated text response
- **Chat (Claude direct)** – `POST /v1/chat/prompt/claude` – Body: `{ "prompt": "string" }` – Same backend as `/prompt`
- **Chat (stream)** – `POST /v1/chat/prompt/stream` – Body: `{ "prompt": "string", "history"?: [...], "attachments"?: [...] }` – Streams the response as `text/event-stream` SSE

### SSE event types (streaming endpoint)

Each event is a JSON object on a `data:` line.

| Event | Fields | Description |
|-------|--------|-------------|
| `text` | `v` | Incremental text delta from the model |
| `done` | — | Stream complete |
| `error` | `msg` | Stream-level error |

Full request/response details and auth options are in the API docs at `/v1/docs`.

## Project structure (high level)

```
public/                  # Static assets; root serves index.html (streaming chat UI)
src/
├── app/                 # App module, controller, service
├── lib/                 # Shared libs
│   ├── claude-ai/       # Claude service (Anthropic SDK), system prompt (sp.ts), tools (database, media)
│   ├── company-source/ # Company discovery via Claude's web search tool
│   ├── database/        # TypeORM data source, entities, migrations
│   ├── email/           # Email sender — providers/ (Resend, ZeptoMail), switched via EMAIL_PROVIDER
│   ├── loggger/         # Custom logger
│   ├── google/          # Google Sheets client
│   └── redis/           # Redis service (sessions, OTP, reset codes)
├── middleware/          # Exception filter, API key guard, session guard, current-user decorator
├── modules/
│   ├── auth/            # Auth + user session controllers/service
│   ├── agents/          # Generic AgentRun tracking + Research Agent
│   ├── companies/       # Discover: search + list + per-company research
│   ├── assets/          # Studio: email generation from a company's research
│   └── chat/            # Chat controller & service (prompt, stream)
└── main.ts              # Bootstrap, static files, Scalar API docs, CORS, rate limit, cookie parser
```

To change the assistant's personality and scope, edit the system prompt in `src/lib/claude-ai/sp.ts`.

## Roadmap

Auth, Discover (company search, grounded in Claude web search), a Research Agent (grounded in Claude web fetch), and email generation (Noviq Studio, MVP scope) are implemented — all confirmed working against real companies, not placeholders. Per the Noviq product plan, upcoming modules include:

- **Noviq Studio** — beyond email: AI-generated UGC, ads, images, landing pages
- **Noviq Reach** — email and LinkedIn outreach campaigns (email send is next up)
- **Noviq CRM** — deals, companies, pipeline
- **More Noviq Agents** — Sales and an Executive Assistant (Research and Content/Marketing agents are done)

See [docs/12-roadmap.md](../docs/12-roadmap.md) for the full build order and current status.

## Scripts reference

| Script | Description |
|--------|-------------|
| `pnpm run start` | Start once |
| `pnpm run start:dev` | Start in watch mode |
| `pnpm run start:prod` | Run production build (`node dist/main`) |
| `pnpm run build` | Run migrations, then `nest build` |
| `pnpm run migration:run` | Apply pending TypeORM migrations |
| `pnpm run migration:generate` | Generate a migration from entity changes |
| `pnpm run migration:revert` | Revert the last applied migration |
| `pnpm run lint` | ESLint with fix |
| `pnpm run format` | Prettier on `src` and `test` |

## License

This project is [MIT licensed](LICENSE).

## Contributing

Contributions are welcome. Open an issue or a pull request as needed.
