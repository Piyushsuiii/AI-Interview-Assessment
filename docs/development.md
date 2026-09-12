# Development

## Environment

Copy `.env.example` to `.env` and replace placeholders. Required API values are `DATABASE_URL`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET`. `FRONTEND_URL` and `API_URL` default to local ports 3000 and 4000.

Google OAuth requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and a callback URI registered exactly as `GOOGLE_CALLBACK_URL`.

Password reset and email verification use Resend's HTTP API. Set server-only `RESEND_API_KEY` and `MAIL_FROM` to exercise delivery. In development, missing mail configuration safely skips delivery and logs only the message subject and skip reason; raw tokens, links, recipients, and message bodies are never logged or returned by the API.

AI role analysis requires at least one of `OPENAI_API_KEY` or `GEMINI_API_KEY`. When both are present, `AI_PRIMARY_PROVIDER` is attempted first and the other provider is used only after a retryable failure. Keys are server-only and must never use a `NEXT_PUBLIC_` prefix.

Stripe is optional for local development. See `docs/billing.md` for product, Price, customer portal, and signed webhook setup. With empty Stripe variables, billing pages remain readable and payment actions are disabled.

Coding execution requires Redis and a running Docker daemon. Start the API and `apps/worker` together when exercising coding questions. The worker intentionally fails jobs if Docker is unavailable; do not add a local process fallback.

## Database

Start PostgreSQL, then run:

```bash
npm run prisma:generate --workspace=@ai-hiring-platform/database
npm run prisma:migrate --workspace=@ai-hiring-platform/database
```

The migration directory contains a clean baseline for new installations. Use `prisma migrate dev --name <change>` for later schema changes and commit both schema and migration.

## API Conventions

- Prefix: `/api/v1`
- Browser authentication: HTTP-only access and refresh cookies
- Tenant routes: `/organizations/:orgId/...`
- Tenant access: membership guard followed by permission guard
- Responses: `{ success: true, data }` or `{ success: false, error }`
- Browser requests: `credentials: "include"`

Do not trust organization IDs from clients without `OrgContextGuard`. Every tenant-owned database query must include `organizationId`.

## Tests

```bash
npm run test --workspace=@ai-hiring-platform/api
npm run test --workspace=@ai-hiring-platform/ai
npm run test --workspace=@ai-hiring-platform/worker
npm run build --workspace=@ai-hiring-platform/api
npm run build --workspace=@ai-hiring-platform/web
npm run build --workspace=@ai-hiring-platform/worker
npm run lint --workspace=@ai-hiring-platform/web
```
