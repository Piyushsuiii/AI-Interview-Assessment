# AI Hiring Intelligence Platform - System Architecture

This document describes the implemented application architecture.

## 1. System Context

The platform is a multi-tenant B2B SaaS application designed to help organizations manage the hiring process through AI-assisted job generation, assessment building, and automated technical/behavioral interviews.

- **Actors:**
  - **Recruiters/Admins (Organization Users):** Create jobs, generate assessments, view reports, and manage organization settings.
  - **Candidates:** Receive assessment links, perform AI-led chat/video interviews, solve coding challenges, and submit answers.
  - **System Admin:** Platform owners managing global billing, overarching AI models, and monitoring.

## 2. Monorepo Architecture

The repository uses npm workspaces to share validation, data, authorization, and AI contracts across services.

```text
/apps
  /web       - Next.js (Frontend for both Recruiters and Candidates)
  /api       - NestJS (Main REST/WebSocket API)
  /worker    - BullMQ process for isolated candidate code execution
/packages
  /database  - Prisma schema, generated client, and migrations
  /ai        - OpenAI/Gemini gateway, output contracts, and prompt registry
  /auth      - Shared authentication logic (JWT, RBAC)
  /validation- Zod schemas for request validation
```

## 3. Frontend Architecture (Next.js)

- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS, shadcn/ui, Framer Motion for animations.
- **Rendering:** App Router server pages with focused client components for forms, interview state, code editing, diagrams, replay, and Copilot.
- **Candidate resilience:** Text, code, and diagram drafts are stored locally while authoritative progress remains in PostgreSQL.
- **Public access:** A random invitation token is sent to the candidate; only its SHA-256 hash is stored.

## 4. Backend Architecture (NestJS)

- **Framework:** NestJS
- **API Design:** RESTful APIs with strict versioning (`/api/v1/`).
- **Authorization:** HTTP-only JWT cookies, organization membership guards, permission guards, and tenant-scoped Prisma queries.
- **Interview engine:** PostgreSQL owns current question, section, progress, immutable question snapshots, answers, and event history.
- **Adaptive orchestration:** The API may insert a bounded follow-up after a text answer. Invalid or unavailable AI output produces a deterministic fallback rather than blocking the interview.
- **Background processing:** The API enqueues code jobs in BullMQ. The worker executes only fixed runtime images in short-lived Docker containers.
- **Evaluation:** Structured AI output is validated before persistence and claims are linked to stored answer, code, design, or integrity evidence.

## 5. Execution and Isolation

Candidate code is never evaluated in the API or browser. The worker creates a temporary read-only workspace and starts Docker with networking disabled, capabilities dropped, a non-root user, memory/CPU/PID limits, and a hard timeout. There is deliberately no host-process fallback when Docker is unavailable.

Recruiter endpoints derive organization context from authenticated membership and include `organizationId` in tenant-owned queries. Candidate endpoints are limited to the interview identified by the hashed invitation token; coding and design operations are limited to its current question. Hidden coding tests are read only by the worker and are not returned by candidate APIs.

## 6. Deployment Architecture (Target)

- **Containers:** Dockerized applications deployed to a container registry.
- **Orchestration:** Kubernetes or managed container services (e.g., AWS ECS, Vercel for frontend).
- **Database:** Managed PostgreSQL (e.g., AWS RDS, Supabase, Neon).
- **Cache/Queue:** Managed Redis (e.g., Upstash, AWS ElastiCache).
- **Storage:** S3 for candidate resumes, interview recordings, and generated assets.
