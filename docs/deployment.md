# Deployment

## Services

Deploy web, API, code-execution worker, PostgreSQL, Redis, and S3-compatible storage as independent services. Terminate TLS at the edge and keep API, database, Redis, storage, OAuth, and AI credentials in a managed secret store.

## Release Order

1. Back up PostgreSQL.
2. Run `prisma migrate deploy` from an immutable release artifact.
3. Deploy the API and verify `/api/v1/health`.
4. Pre-pull and pin the worker's JavaScript, TypeScript, and Python runtime images by digest.
5. Deploy the worker on a dedicated execution host with access to its Docker daemon and no unrelated application secrets.
6. Deploy the web application with `NEXT_PUBLIC_API_URL` set to the public API origin.
7. Run authentication, tenant-isolation, queue, sandbox, and hidden-test leakage smoke tests.

## Security Requirements

- Rotate any credential shared through chat, tickets, or source control before deployment.
- Use independent high-entropy access and refresh JWT secrets.
- Configure exact CORS and Google callback origins.
- Verify a Resend sending domain, set server-only `RESEND_API_KEY` and `MAIL_FROM`, and monitor provider delivery failures.
- Use HTTPS; production authentication cookies use `Secure` and `SameSite=None` for cross-origin deployments.
- Restrict database and Redis networking to application services.
- Isolate worker hosts from internal services and continuously prune terminated execution containers.
- Apply provider budgets and alerts for AI usage.
- Configure Stripe API and webhook secrets only on the API service, register the exact `/api/v1/billing/webhook` URL, and monitor failed `BillingWebhookEvent` rows.
- Run dependency, container, and migration scans in CI.

## Current Limitation

The repository's Compose file provisions local dependencies only. Production application images, worker-host hardening, observability, backups, and CI/CD remain to be implemented before a commercial launch.
