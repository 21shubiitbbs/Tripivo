import { mkdir, writeFile } from 'node:fs/promises';
import { env } from '../config/env.js';

// Where uploaded files (photos, chat media) are kept, chosen by STORAGE_PROVIDER:
//   local: UPLOAD_DIR on this server, served from /uploads. Only works with a single API instance.
//   s3:    any S3-compatible bucket (AWS S3, Cloudflare R2, MinIO), served from S3_PUBLIC_URL.

export type StoredObject = { url: string };

export interface ObjectStorage {
  /** Stores `bytes` under `key` (e.g. "avatars/<uuid>.jpg"). `origin` is this API's public origin. */
  put(key: string, bytes: Buffer, contentType: string, origin: string): Promise<StoredObject>;
}

const localStorage: ObjectStorage = {
  async put(key, bytes, _contentType, origin) {
    const target = new URL(key, env.uploadDir);
    await mkdir(new URL('./', target), { recursive: true });
    await writeFile(target, bytes);
    return { url: `${origin}/uploads/${key}` };
  },
};

function s3Storage(): ObjectStorage {
  const config = env.storage.s3!;
  // Loaded on first use so the (large) AWS SDK isn't imported when storage is local.
  const client = import('@aws-sdk/client-s3').then(
    ({ S3Client }) =>
      new S3Client({
        region: config.region,
        endpoint: config.endpoint,
        forcePathStyle: config.forcePathStyle,
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      }),
  );
  return {
    async put(key, bytes, contentType) {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      await (await client).send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: bytes,
          ContentType: contentType,
          // File names are random and never reused, so they can be cached forever.
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      return { url: `${config.publicUrl}/${key}` };
    },
  };
}

export const storage: ObjectStorage = env.storage.provider === 's3' ? s3Storage() : localStorage;
