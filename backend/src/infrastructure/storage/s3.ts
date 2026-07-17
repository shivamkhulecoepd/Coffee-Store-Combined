import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../../lib/logger.js';

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  } : undefined,
  // Use endpoint for S3-compatible services (MinIO, DigitalOcean Spaces, etc.)
  ...(process.env.S3_ENDPOINT && {
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true, // Required for MinIO
  }),
});

const BUCKET = process.env.S3_BUCKET || 'bean-brew-uploads';
const PRESIGN_EXPIRY = 3600; // 1 hour for private files

export type FileVisibility = 'public' | 'private';

export interface UploadResult {
  key: string;
  url: string;
  bucket: string;
  etag: string;
}

export interface UploadOptions {
  folder?: string;
  visibility?: FileVisibility;
  contentType?: string;
  metadata?: Record<string, string>;
}

class S3StorageService {
  /**
   * Upload a file to S3
   */
  async upload(
    key: string,
    body: Buffer | Uint8Array | string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const {
      folder = 'uploads',
      visibility = 'public',
      contentType = 'application/octet-stream',
      metadata = {},
    } = options;

    const fullKey = `${folder}/${key}`;
    const acl = visibility === 'public' ? 'public-read' : 'private';

    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: fullKey,
        Body: body,
        ContentType: contentType,
        ACL: acl,
        Metadata: metadata,
      });

      await s3Client.send(command);

      const url = visibility === 'public'
        ? this.getPublicUrl(fullKey)
        : await this.getSignedUrl(fullKey);

      logger.info('File uploaded to S3', { key: fullKey, bucket: BUCKET, visibility });

      return {
        key: fullKey,
        url,
        bucket: BUCKET,
        etag: `uploaded-${Date.now()}`, // ETag would be returned in production
      };
    } catch (error) {
      logger.error('S3 upload failed', { error, key: fullKey });
      throw error;
    }
  }

  /**
   * Get a signed URL for private files
   */
  async getSignedUrl(key: string, expiresIn = PRESIGN_EXPIRY): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      logger.error('Failed to generate signed URL', { error, key });
      throw error;
    }
  }

  /**
   * Get public URL for a file
   */
  getPublicUrl(key: string): string {
    // For CloudFront or custom domain, use that instead
    const endpoint = process.env.CDN_URL || `https://${BUCKET}.s3.amazonaws.com`;
    return `${endpoint}/${key}`;
  }

  /**
   * Delete a file from S3
   */
  async delete(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
      });

      await s3Client.send(command);
      logger.info('File deleted from S3', { key, bucket: BUCKET });
    } catch (error) {
      logger.error('S3 delete failed', { error, key });
      throw error;
    }
  }

  /**
   * Check if a file exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: BUCKET,
        Key: key,
      });

      await s3Client.send(command);
      return true;
    } catch (error) {
      if ((error as { name: string }).name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Upload invoice PDF
   */
  async uploadInvoice(orderId: string, pdfBuffer: Buffer): Promise<string> {
    const key = `invoices/${orderId}.pdf`;
    const result = await this.upload(key, pdfBuffer, {
      folder: 'invoices',
      visibility: 'private',
      contentType: 'application/pdf',
      metadata: {
        orderId,
        generatedAt: new Date().toISOString(),
      },
    });

    return result.url;
  }

  /**
   * Upload product image
   */
  async uploadProductImage(
    productId: string,
    imageBuffer: Buffer,
    contentType: string
  ): Promise<string> {
    const key = `products/${productId}/${Date.now()}`;
    const result = await this.upload(key, imageBuffer, {
      folder: 'products',
      visibility: 'public',
      contentType,
    });

    return result.url;
  }

  /**
   * Upload user avatar
   */
  async uploadAvatar(
    userId: string,
    imageBuffer: Buffer,
    contentType: string
  ): Promise<string> {
    const key = `avatars/${userId}`;
    const result = await this.upload(key, imageBuffer, {
      folder: 'avatars',
      visibility: 'public',
      contentType,
    });

    return result.url;
  }

  /**
   * Get signed URL for downloading invoice
   */
  async getInvoiceDownloadUrl(orderId: string): Promise<string> {
    const key = `invoices/${orderId}.pdf`;

    if (!(await this.exists(key))) {
      throw new Error(`Invoice not found for order: ${orderId}`);
    }

    return this.getSignedUrl(key, 86400); // 24 hours
  }
}

export const s3Storage = new S3StorageService();
