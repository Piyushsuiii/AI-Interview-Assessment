# Supabase Storage for Candidate Resumes

The API already uses the S3-compatible object-storage protocol. Supabase Storage can therefore back recruiter and candidate resume uploads without exposing privileged credentials to the browser or changing the database schema.

## 1. Create the bucket

In the Supabase dashboard, open **Storage** and create a bucket named `candidate-resumes`.

- Keep the bucket **private**.
- Do not add a public read policy.
- The API generates signed download URLs that expire after five minutes.
- Existing object keys remain tenant-prefixed as `organizations/<organization-id>/candidates/<candidate-id>/resumes/<file>.pdf`.

## 2. Generate S3 credentials

Open the project's Storage S3 settings and generate an S3 access-key pair. Store both values in the API's server-only secret store. These credentials are different from the browser publishable key and must never use a `NEXT_PUBLIC_` prefix.

Configure the API environment:

```env
S3_ENDPOINT="https://<project-ref>.storage.supabase.co/storage/v1/s3"
S3_REGION="<project-region>"
S3_ACCESS_KEY="<generated-access-key>"
S3_SECRET_KEY="<generated-secret-key>"
S3_BUCKET_NAME="candidate-resumes"
S3_FORCE_PATH_STYLE="true"
```

The project reference and region are shown in the Supabase project settings. Configure all six values together; partial storage configuration is rejected during API startup.

## 3. Verify the integration

Restart the API and request `GET /api/v1/health/ready`. The response must report `storage: "ok"` rather than `disabled` or `failed`.

The storage connection can also be verified without exposing credentials or retaining a test object:

```bash
npm run storage:verify --workspace=@ai-hiring-platform/api
```

Then verify both access paths:

1. Upload a PDF of 10 MB or less from the candidate portal.
2. Download it through the generated short-lived URL.
3. Replace it and confirm the previous object is removed from the private bucket.
4. Delete it and confirm candidate metadata is cleared.
5. Repeat upload, download, and deletion from the recruiter candidate-detail page.

Only valid PDF files are accepted. The API checks the MIME type, `.pdf` extension, size, and `%PDF-` signature before writing to Supabase. CVerify classification is fail-open: classifier downtime does not prevent the resume from being stored.

## Security notes

- Keep the bucket private and use signed downloads only.
- Never send S3 credentials or private object keys to the web application.
- Rotate any credential exposed in source control, screenshots, chat, or logs.
- Use separate access keys for development and production.
- Monitor the API readiness endpoint and Supabase storage usage.
