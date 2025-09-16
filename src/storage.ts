import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { readFile, unlink } from 'fs/promises';
import { basename, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { lookup } from 'mime-types';
import type { CloudStorageConfig } from './types.js';

export class CloudStorageService {
  private s3Client: S3Client;
  private config: CloudStorageConfig;

  constructor(config: CloudStorageConfig) {
    this.config = config;
    this.s3Client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true, // Required for some S3-compatible services like Cloudflare R2
    });
  }

  async testConnection(): Promise<void> {
    try {
      const command = new HeadBucketCommand({ Bucket: this.config.bucketName });
      await this.s3Client.send(command);
    } catch (error) {
      throw new Error(`S3 connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async uploadFile(localPath: string, keyPrefix: string = ''): Promise<string> {
    try {
      const fileBuffer = await readFile(localPath);
      const fileName = basename(localPath);
      const fileExtension = extname(fileName);
      const uniqueKey = `${keyPrefix}${uuidv4()}${fileExtension}`;
      
      const contentType = lookup(fileName) || 'application/octet-stream';

      const command = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: uniqueKey,
        Body: fileBuffer,
        ContentType: contentType,
      });

      await this.s3Client.send(command);

      // Clean up local file
      try {
        await unlink(localPath);
      } catch (error) {
        console.warn(`Failed to delete local file ${localPath}:`, error);
      }

      // Return public URL
      if (this.config.publicUrlBase) {
        return `${this.config.publicUrlBase}/${uniqueKey}`;
      } else {
        // Generate a presigned URL that expires in 1 year for "permanent" access
        const getCommand = new GetObjectCommand({
          Bucket: this.config.bucketName,
          Key: uniqueKey,
        });
        return await getSignedUrl(this.s3Client, getCommand, { expiresIn: 31536000 }); // 1 year
      }
    } catch (error) {
      console.error('Failed to upload file to cloud storage:', error);
      throw new Error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async uploadBuffer(buffer: Buffer, fileName: string, keyPrefix: string = ''): Promise<string> {
    try {
      const fileExtension = extname(fileName);
      const uniqueKey = `${keyPrefix}${uuidv4()}${fileExtension}`;
      
      const contentType = lookup(fileName) || 'application/octet-stream';

      const command = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: uniqueKey,
        Body: buffer,
        ContentType: contentType,
      });

      await this.s3Client.send(command);

      // Return public URL
      if (this.config.publicUrlBase) {
        return `${this.config.publicUrlBase}/${uniqueKey}`;
      } else {
        // Generate a presigned URL that expires in 1 year for "permanent" access
        const getCommand = new GetObjectCommand({
          Bucket: this.config.bucketName,
          Key: uniqueKey,
        });
        return await getSignedUrl(this.s3Client, getCommand, { expiresIn: 31536000 }); // 1 year
      }
    } catch (error) {
      console.error('Failed to upload buffer to cloud storage:', error);
      throw new Error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

