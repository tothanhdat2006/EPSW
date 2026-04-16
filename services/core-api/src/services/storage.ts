import * as Minio from 'minio';
import { config } from '../config.js';

let minioClient: Minio.Client | null = null;

export function getMinioClient(): Minio.Client {
  if (!minioClient) {
    minioClient = new Minio.Client({
      endPoint: config.minio.endPoint,
      port: config.minio.port,
      useSSL: config.minio.useSSL,
      accessKey: config.minio.accessKey,
      secretKey: config.minio.secretKey,
    });
  }
  return minioClient;
}

export async function ensureBucketExists(bucket: string): Promise<void> {
  const client = getMinioClient();
  const exists = await client.bucketExists(bucket);
  if (!exists) {
    await client.makeBucket(bucket, 'us-east-1');

    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetBucketLocation', 's3:ListBucket'],
          Resource: [`arn:aws:s3:::${bucket}`],
        },
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucket}/*`],
        },
      ],
    };

    await client.setBucketPolicy(bucket, JSON.stringify(policy));
  }
}

export interface UploadResult {
  objectKey: string;
  url: string;
  etag: string;
}

export async function uploadFile(
  bucket: string,
  objectKey: string,
  buffer: Buffer,
  mimeType: string,
): Promise<UploadResult> {
  const client = getMinioClient();
  await ensureBucketExists(bucket);

  const result = await client.putObject(bucket, objectKey, buffer, buffer.length, {
    'Content-Type': mimeType,
  });

  return {
    objectKey,
    url: `${config.minio.useSSL ? 'https' : 'http'}://${config.minio.endPoint}:${config.minio.port}/${bucket}/${objectKey}`,
    etag: result.etag,
  };
}

export async function downloadFile(bucket: string, objectKey: string): Promise<Buffer> {
  const client = getMinioClient();
  const stream = await client.getObject(bucket, objectKey);

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export function parseObjectKeyFromUrl(rawFileUrl: string): { bucket: string; objectKey: string } {
  const url = new URL(rawFileUrl);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const bucket = pathParts[0] ?? config.minio.bucketDocuments;
  const objectKey = pathParts.slice(1).join('/');
  return { bucket, objectKey };
}
