#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { CloudStorageService } from './storage.js';
import { VideoDownloaderService } from './downloader.js';
import type { CloudStorageConfig } from './types.js';

// Define session configuration schema for Smithery
export const configSchema = z.object({
  s3Endpoint: z.string().describe('S3-compatible endpoint URL'),
  s3Region: z.string().describe('S3 region'),
  s3AccessKeyId: z.string().describe('S3 access key ID'),
  s3SecretAccessKey: z.string().describe('S3 secret access key'),
  s3BucketName: z.string().describe('S3 bucket name'),
  s3PublicUrlBase: z.string().optional().describe('Custom public URL base for files'),
});

// Export server function for Smithery CLI
export default function createServer({
  config,
}: {
  config: z.infer<typeof configSchema>;
}) {
  // Initialize services with config
  const storageConfig: CloudStorageConfig = {
    endpoint: config.s3Endpoint,
    region: config.s3Region,
    accessKeyId: config.s3AccessKeyId,
    secretAccessKey: config.s3SecretAccessKey,
    bucketName: config.s3BucketName,
    publicUrlBase: config.s3PublicUrlBase,
  };

  const storageService = new CloudStorageService(storageConfig);
  const downloaderService = new VideoDownloaderService(storageService);

  // Create MCP server
  const server = new McpServer({
    name: 'MCP Video Cloud Server',
    version: '1.0.0',
  });

  // Register test connection tool
  server.registerTool(
    'test_connection',
    {
      title: 'Test Connection',
      description: 'Test if the MCP server is working',
      inputSchema: z.object({}),
    },
    async () => {
      return {
        success: true,
        message: 'MCP Video Cloud Server is working!',
        timestamp: new Date().toISOString(),
      };
    }
  );

  // Register download video tool
  server.registerTool(
    'download_video_to_cloud',
    {
      title: 'Download Video to Cloud',
      description: 'Download a video from a URL and store it in cloud storage, returning a public URL',
      inputSchema: z.object({
        url: z.string().describe('URL of the video to download (YouTube, Facebook, Instagram, TikTok, etc.)'),
        quality: z.string().optional().default('best').describe('Video quality preference (best, worst, 720p, 1080p, etc.)'),
      }),
    },
    async ({ url, quality = 'best' }) => {
      try {
        const result = await downloaderService.downloadVideo(url, quality);
        return {
          success: true,
          url: result.url,
          filename: result.filename,
          size: result.size,
          metadata: result.metadata,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
      }
    }
  );

  // Register download audio tool
  server.registerTool(
    'download_audio_to_cloud',
    {
      title: 'Download Audio to Cloud',
      description: 'Extract audio from a video and store it in cloud storage as MP3',
      inputSchema: z.object({
        url: z.string().describe('URL of the video to extract audio from'),
      }),
    },
    async ({ url }) => {
      try {
        const result = await downloaderService.downloadAudio(url);
        return {
          success: true,
          url: result.url,
          filename: result.filename,
          size: result.size,
          metadata: result.metadata,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
      }
    }
  );

  // Register extract transcript tool
  server.registerTool(
    'extract_transcript_to_cloud',
    {
      title: 'Extract Transcript to Cloud',
      description: 'Extract subtitles/transcript from a video and store as clean text in cloud storage',
      inputSchema: z.object({
        url: z.string().describe('URL of the video to extract transcript from'),
        language: z.string().optional().default('en').describe('Language code for subtitles (e.g., en, es, fr)'),
      }),
    },
    async ({ url, language = 'en' }) => {
      try {
        const result = await downloaderService.extractTranscript(url, language);
        return {
          success: true,
          url: result.url,
          filename: result.filename,
          preview: result.content,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
      }
    }
  );

  // Register extract thumbnail tool
  server.registerTool(
    'extract_thumbnail_to_cloud',
    {
      title: 'Extract Thumbnail to Cloud',
      description: 'Extract video thumbnail and store it in cloud storage',
      inputSchema: z.object({
        url: z.string().describe('URL of the video to extract thumbnail from'),
      }),
    },
    async ({ url }) => {
      try {
        const result = await downloaderService.extractThumbnail(url);
        return {
          success: true,
          url: result.url,
          filename: result.filename,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
      }
    }
  );

  // Register get video metadata tool
  server.registerTool(
    'get_video_metadata',
    {
      title: 'Get Video Metadata',
      description: 'Get comprehensive video information without downloading',
      inputSchema: z.object({
        url: z.string().describe('URL of the video to get metadata for'),
      }),
    },
    async ({ url }) => {
      try {
        const metadata = await downloaderService.getVideoMetadata(url);
        return {
          success: true,
          metadata,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
      }
    }
  );

  return server.server;
}

// STDIO support for backward compatibility and local development
async function main() {
  // Get configuration from environment variables
  const config = {
    s3Endpoint: process.env.S3_ENDPOINT!,
    s3Region: process.env.S3_REGION!,
    s3AccessKeyId: process.env.S3_ACCESS_KEY_ID!,
    s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    s3BucketName: process.env.S3_BUCKET_NAME!,
    s3PublicUrlBase: process.env.S3_PUBLIC_URL_BASE,
  };

  // Validate required environment variables
  const requiredEnvVars = [
    'S3_ENDPOINT',
    'S3_REGION', 
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'S3_BUCKET_NAME'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars.join(', '));
    process.exit(1);
  }

  try {
    // Validate config against schema
    const validatedConfig = configSchema.parse(config);
    
    // Create server instance
    const serverInstance = createServer({ config: validatedConfig });
    
    // Create transport
    const transport = new StdioServerTransport();
    
    // Connect server to transport
    await serverInstance.connect(transport);
    
    console.error('MCP Video Cloud Server running on stdio');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run main function if this file is executed directly (CommonJS compatible)
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}
