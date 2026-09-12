# AI Hiring Intelligence

AI-native, multi-tenant hiring software with adaptive interviews, isolated coding execution, system-design exercises, evidence-grounded evaluation, integrity replay, candidate comparison, and Recruiter Copilot.

## Architecture

- `apps/web`: Next.js 16 landing site and recruiter application
- `apps/api`: NestJS versioned REST API
- `apps/worker`: BullMQ consumer for Docker-isolated code execution
- `packages/database`: PostgreSQL Prisma schema and migrations
- `packages/ai`: server-only provider gateway, prompts, routing, validation, and usage metadata
- `packages/auth`: roles and permissions
- `packages/validation`: shared Zod request schemas

See `docs/architecture.md`, `docs/development.md`, and `docs/deployment.md`.

## Local Setup

Requirements: Node.js 20+, npm 10+, and Docker with Compose.

```bash
npm install
cp .env.example .env
docker compose up -d postgres redis minio
npm run prisma:generate --workspace=@ai-hiring-platform/database
npm run prisma:migrate --workspace=@ai-hiring-platform/database
npm run dev
```

Web: `http://localhost:3000`

API: `http://localhost:4000/api/v1`

Never commit `.env`. Generate independent random JWT secrets of at least 32 characters. Configure AI and Google credentials only in the server environment.

## Verification

```bash
npm run build
npm run test
npm run lint
```

## Implemented Product Slice

- Responsive cinematic landing page with lazy 3D Candidate Intelligence Core
- Password signup/login, refresh rotation, logout, secure cookies, and Google OAuth
- Organization creation, membership context, RBAC, and tenant-scoped queries
- Recruiter dashboard and job list/detail/create workflows
- Candidate pipeline, tenant-scoped profiles, and expiring hashed invitation links
- Versioned assessment builder with immutable question content and publishing
- Public consent flow, resumable interview sessions, sequential question delivery, and persisted answers
- AI role analysis from the job form with validated competencies
- Sequential OpenAI/Gemini fallback, versioned prompts, and usage records
- PostgreSQL baseline migration and audit logs
- Bounded adaptive follow-ups with deterministic fallback questions
- Recruiter-authored coding tests and Docker-only JavaScript, TypeScript, and Python execution
- Candidate system-design canvas and persisted diagram submissions
- Evidence-linked evaluations, recommendation overrides, reports, comparisons, and interview replay
- Structured Recruiter Copilot tools grounded only in organization data
- Tenant/user-scoped notification inbox with unread polling and event notifications
- Owner-only Stripe checkout and portal flows, signed idempotent webhooks, subscriptions, usage, and entitlement limits

Video interviewing, production observability, and application container images remain future work.
