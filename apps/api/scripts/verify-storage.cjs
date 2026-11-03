const { randomUUID } = require("node:crypto");
const path = require("node:path");
const {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const requiredVariables = [
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
  "S3_BUCKET_NAME",
];

const missingVariables = requiredVariables.filter((name) => !process.env[name]?.trim());
if (missingVariables.length > 0) {
  throw new Error(`Missing storage configuration: ${missingVariables.join(", ")}`);
}

const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});

const bucket = process.env.S3_BUCKET_NAME;
const key = `_verification/resume-${randomUUID()}.pdf`;
const body = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n");
let objectExists = false;

async function verify() {
  try {
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "application/pdf",
    }));
    objectExists = true;

    const signedUrl = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentDisposition: 'attachment; filename="verification-resume.pdf"',
      }),
      { expiresIn: 60 },
    );
    const response = await fetch(signedUrl);
    if (!response.ok) throw new Error(`Signed download returned HTTP ${response.status}`);

    const downloaded = Buffer.from(await response.arrayBuffer());
    if (!downloaded.equals(body)) throw new Error("Downloaded bytes did not match uploaded bytes");

    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    objectExists = false;

    let removed = false;
    try {
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    } catch (error) {
      removed = error?.$metadata?.httpStatusCode === 404;
    }
    if (!removed) throw new Error("Deleted verification object is still present");

    console.log(JSON.stringify({
      upload: "ok",
      signedDownload: "ok",
      contentMatch: "ok",
      delete: "ok",
      cleanup: "complete",
    }));
  } finally {
    if (objectExists) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
    }
    client.destroy();
  }
}

verify().catch((error) => {
  console.error(error instanceof Error ? error.message : "Storage verification failed");
  process.exitCode = 1;
});
