import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

@Injectable()
export class StorageService {
  private readonly bucket: string;
  private readonly client: S3Client | null;

  constructor(private readonly config: ConfigService) {
    const endpoint = config.get<string>("S3_ENDPOINT") ?? "";
    const region = config.get<string>("S3_REGION") ?? "";
    const accessKeyId = config.get<string>("S3_ACCESS_KEY") ?? "";
    const secretAccessKey = config.get<string>("S3_SECRET_KEY") ?? "";
    this.bucket = config.get<string>("S3_BUCKET_NAME") ?? "";
    this.client = endpoint && region && accessKeyId && secretAccessKey && this.bucket
      ? new S3Client({
          endpoint,
          region,
          forcePathStyle: config.get<boolean>("S3_FORCE_PATH_STYLE") ?? true,
          credentials: { accessKeyId, secretAccessKey },
        })
      : null;
  }

  async putObject(key: string, body: Buffer, contentType: string) {
    const client = this.requireClient();
    await client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
  }

  async getSignedDownloadUrl(key: string, fileName: string, expiresInSeconds = 300) {
    const client = this.requireClient();
    const safeFileName = fileName.replace(/["\\\r\n]/g, "_");
    return getSignedUrl(client, new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${safeFileName}"`,
    }), { expiresIn: expiresInSeconds });
  }

  async deleteObject(key: string) {
    const client = this.requireClient();
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  isConfigured() {
    return Boolean(this.client);
  }

  async checkHealth() {
    const client = this.requireClient();
    await client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  private requireClient() {
    if (!this.client) {
      throw new ServiceUnavailableException({
        code: "STORAGE_NOT_CONFIGURED",
        message: "Object storage is not configured",
      });
    }
    return this.client;
  }
}
