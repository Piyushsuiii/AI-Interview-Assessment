# Billing and Entitlements

Billing is organization-scoped and only organization owners can access its API. Stripe is the payment source of truth; `Subscription` is the local, webhook-maintained projection used by product authorization and the recruiter UI. Browsers submit only a plan identifier. The API maps that identifier to a server-only Stripe Price ID.

## Stripe Setup

1. Create recurring Stripe Prices for Starter, Growth, and Enterprise in the same Stripe account.
2. Set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, and `STRIPE_PRICE_ENTERPRISE` on the API service. Unavailable plans may have an empty Price ID.
3. Create a webhook endpoint at `https://<api-origin>/api/v1/billing/webhook`.
4. Subscribe it to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`.
5. Set the endpoint signing secret as `STRIPE_WEBHOOK_SECRET` on the API service.
6. Enable the Stripe customer portal and configure the products and plan changes customers may perform there.

For local webhook testing, run `stripe listen --forward-to localhost:4000/api/v1/billing/webhook` and use the emitted `whsec_...` secret. Never expose Stripe secrets or Price IDs through `NEXT_PUBLIC_` variables.

## Data Flow

- Checkout and portal sessions are created by authenticated, OWNER-only endpoints.
- Webhook signatures are verified against the untouched request body.
- `BillingWebhookEvent` claims Stripe event IDs and records completion or retryable failure, preventing duplicate processing.
- Subscription updates derive plans from configured server-side Price IDs. Client metadata cannot set the local plan.
- Calendar-month `UsageCounter` rows track interviews and AI tokens. Interview creation checks the resolved monthly entitlement before consuming usage.
- `OrganizationEntitlement` can override plan limits or feature access for contracted organizations without changing plan defaults.

When Stripe is unconfigured, the API still reports the database-backed Starter state and usage. Checkout and portal actions return a safe service-unavailable response.
