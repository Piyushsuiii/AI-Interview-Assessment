# AI Hiring Intelligence Platform - API Architecture

## 1. Design Principles

- **RESTful:** Resource-oriented URLs (`/users`, `/organizations/:id/jobs`).
- **Versioning:** All routes are prefixed with `/api/v1/`.
- **JSON Format:** Standardized JSON responses for both success and error payloads.
- **Validation:** Strict payload validation using Zod schemas transformed into NestJS validation pipes.

## 2. Standardized Response Formats

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [ ... ]
  }
}
```

## 3. Core Modules & Endpoints

### Auth Module
- `POST /api/v1/auth/signup` - Register an organization admin
- `POST /api/v1/auth/login` - Login and receive JWT
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Revoke the active refresh session
- `GET /api/v1/auth/me` - Return the authenticated user and memberships
- `GET /api/v1/auth/google` - Begin Google OAuth
- `POST /api/v1/auth/forgot-password` - Request a one-time password reset link (always neutral)
- `POST /api/v1/auth/reset-password` - Consume a reset token and revoke all user sessions
- `POST /api/v1/auth/email-verification/request` - Request or resend a verification link (always neutral)
- `POST /api/v1/auth/verify-email` - Consume a one-time email verification token

### Organization Module
- `GET /api/v1/organizations` - List user's organizations
- `POST /api/v1/organizations` - Create organization
- `GET /api/v1/organizations/:id/members` - List organization members

### Jobs Module
- `GET /api/v1/jobs` - List jobs for current context organization
- `POST /api/v1/jobs` - Create a new job requisition
- `GET /api/v1/jobs/:id` - Get job details

### Recruiter Modules
- `/api/v1/organizations/:orgId/jobs` - List, create, read, update, and close jobs
- `/api/v1/organizations/:orgId/candidates` - List, create, read, update, and invite candidates
- `/api/v1/organizations/:orgId/assessments` - Versioned assessment CRUD, question editing, publish, and duplicate
- `GET /api/v1/organizations/:orgId/interviews/:id` - Interview detail
- `GET /api/v1/organizations/:orgId/interviews/:id/replay` - Ordered interview replay
- `POST /api/v1/organizations/:orgId/interviews/:id/evaluate` - Run structured evaluation
- `GET|PATCH /api/v1/organizations/:orgId/interviews/:id/evaluation[/override]` - Read or override a recommendation
- `GET /api/v1/organizations/:orgId/reports/interviews/:interviewId` - Evidence-grounded report
- `POST /api/v1/organizations/:orgId/reports/compare` - Compare two to five candidates
- `POST /api/v1/organizations/:orgId/copilot/query` - Run a structured, organization-scoped Copilot tool

### Candidate Modules
- `GET /api/v1/candidate/invitations/:token` - Invitation metadata and consent status
- `POST /api/v1/candidate/invitations/:token/start` - Consent and start or resume an interview
- `GET /api/v1/candidate/invitations/:token/question` - Current question only
- `POST /api/v1/candidate/invitations/:token/answers` - Submit the current answer and advance
- `/api/v1/candidate/invitations/:token/coding/:questionId` - Challenge, run, submit, and execution polling
- `GET|PUT /api/v1/candidate/invitations/:token/system-design/:questionId` - Load or save a design
- `POST /api/v1/candidate/invitations/:token/integrity` - Record a client integrity signal

Candidate tokens are secret bearer credentials. Coding and system-design routes reject questions other than the interview's current question, and hidden coding tests are never included in responses.

## 4. Authorization Guards

NestJS guards will enforce access:
- **`JwtAuthGuard`:** Ensures valid JWT token.
- **`RolesGuard`:** Enforces RBAC (e.g., `@Roles('admin', 'recruiter')`).
- **`OrgContextGuard`:** Ensures the user belongs to the organization ID provided in the route parameters or headers (`x-org-id`).

## 5. Pagination and Filtering

Standard query parameters:
- `?page=1&limit=20` for pagination.
- `?sort=-createdAt` for descending sort.
- `?status=ACTIVE` for filtering.
