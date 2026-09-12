# AI Hiring Intelligence Platform - Security Architecture

Security is critical, given the handling of PII (Candidate data) and proprietary assessments.

## 1. Authentication & Authorization

- **Strategy:** JWT (JSON Web Tokens) with short-lived access tokens (e.g., 15m) and long-lived HTTP-only, secure, SameSite refresh tokens.
- **Multi-Tenancy Isolation:**
  - Row-level isolation in the application layer.
  - Every table (except global tables like `User`) has an `organizationId`.
  - Prisma queries automatically inject the `organizationId` based on the user's current context.
- **RBAC (Role-Based Access Control):**
  - Roles: `SUPER_ADMIN`, `ORG_ADMIN`, `RECRUITER`, `REVIEWER`.
  - Permissions are mapped to roles.

## 2. Data Protection

- **Encryption in Transit:** All communications over TLS (HTTPS/WSS).
- **Encryption at Rest:** Managed by the cloud provider (AWS RDS / S3).
- **PII Handling:** Candidate emails, names, and contact info are strictly controlled. Can be anonymized for bias-free evaluation mode.

## 3. API Security

- **Rate Limiting:** IP-based and User-based rate limiting via Redis to prevent brute force and DDoS.
- **CORS:** Strictly configured to allow only the known frontend origins.
- **Input Validation:** Zod schemas sanitize and validate all inputs. No raw SQL queries (Prisma prevents SQL injection).
- **Helmet:** HTTP headers secured via Helmet in NestJS.

## 4. Candidate Integrity (Anti-Cheat)

- **Browser Tab Tracking:** Detect when candidates leave the assessment tab.
- **Copy/Paste Detection:** Track paste events in code editors.
- **Code Execution Sandbox:** Remote code execution must run in heavily isolated, ephemeral Docker containers or WebAssembly (e.g., Firecracker microVMs) to prevent malicious code from harming the server.

## 5. Secrets Management

- **Environment Variables:** No secrets in code. Use `.env` locally and secure secret managers (AWS Secrets Manager, Vercel Env Vars) in production.
- **API Keys:** If the platform provides an API to external ATS systems, API keys are hashed in the database before storage (similar to passwords).
