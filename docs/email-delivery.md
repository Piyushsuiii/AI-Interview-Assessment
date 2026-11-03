# Candidate Magic-Link Email Delivery

Candidate sign-in links are sent through Resend. Supabase Storage credentials do not configure email delivery.

## Resend setup

1. Create or open a Resend account.
2. For initial testing, create an API key in **API Keys**. Resend's default testing sender can normally deliver only to the email address associated with that Resend account.
3. For delivery to arbitrary candidates, open **Domains**, add a domain that you control, and add the displayed DNS records at the domain provider.
4. Wait until Resend reports the domain as verified.
5. Configure the ignored local `.env` with server-only values:

```env
RESEND_API_KEY="<resend-api-key>"
MAIL_FROM="AI Hiring <accounts@your-verified-domain.com>"
```

6. Restart the API after changing `.env`.

Do not use a Gmail, Outlook, or arbitrary address in `MAIL_FROM` unless its domain has been verified by Resend. Never put the Resend API key in `NEXT_PUBLIC_*` variables or frontend environment files.

## Verification

Open the candidate login page and enter an email already attached to a candidate application. The response is intentionally identical for known and unknown email addresses, so unknown addresses do not reveal candidate records.

For a valid candidate:

- A one-time link is sent to the application email.
- The link expires after 15 minutes.
- A link can be used only once.
- In development, if the provider is not configured or rejects delivery, the UI displays an **Open development link** button.

If mail does not arrive, inspect the Resend **Emails** and **Logs** pages for rejected, bounced, or suppressed delivery, and check the spam folder. The API logs only the subject and provider status; it does not log recipients, tokens, or magic-link URLs.
