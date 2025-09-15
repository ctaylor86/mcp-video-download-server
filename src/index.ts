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
  // Initialize services with config (lazy initialization)
  const storageConfig: CloudStorageConfig = {
    endpoint: config.s3Endpoint,
    region: config.s3Region,
    accessKeyId: config.s3AccessKeyId,
    secretAccessKey: config.s3SecretAccessKey,
    bucketName: config.s3BucketName,
    publicUrlBase: config.s3PublicUrlBase,
  };

  // Don't initialize services during server creation to avoid startup delays
  let storageService: CloudStorageService | null = null;
  let downloaderService: VideoDownloaderService | null = null;

  function getServices() {
    if (!storageService) {
      storageService = new CloudStorageService(storageConfig);
    }
    if (!downloaderService) {
      downloaderService = new VideoDownloaderService(storageService);
    }
    return { storageService, downloaderService };
  }

  // Create MCP server
  const server = new McpServer({
    name: 'MCP Video Cloud Server',
    version: '1.0.0',
  });

  // Register test connection tool (no dependencies needed)
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
        config: {
          endpoint: config.s3Endpoint,
          region: config.s3Region,
          bucket: config.s3BucketName,
        }
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
        const { downloaderService } = getServices();
        const result = await downloaderService.downloadVideo(url, quality);
        return result;
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
        const { downloaderService } = getServices();
        const result = await downloaderService.downloadAudio(url);
        return result;
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
        const { downloaderService } = getServices();
        const result = await downloaderService.extractTranscript(url, language);
        return result;
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
        const { downloaderService } = getServices();
        const result = await downloaderService.extractThumbnail(url);
        return result;
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
        const { downloaderService } = getServices();
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

// STDIO support for backward compatibility and local development ONLY
async function main() {
  // This function is ONLY for local development with STDIO
  // Smithery uses the createServer function directly, not this main function
  
  console.error('Starting MCP Video Cloud Server in STDIO mode (local development)');
  
  // Get configuration from environment variables (local development only)
  const config = {
    s3Endpoint: process.env.S3_ENDPOINT!,
    s3Region: process.env.S3_REGION!,
    s3AccessKeyId: process.env.S3_ACCESS_KEY_ID!,
    s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    s3BucketName: process.env.S3_BUCKET_NAME!,
    s3PublicUrlBase: process.env.S3_PUBLIC_URL_BASE,
  };

  // Validate required environment variables (local development only)
  const requiredEnvVars = [
    'S3_ENDPOINT',
    'S3_REGION', 
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'S3_BUCKET_NAME'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.error('Missing required environment variables for local development:', missingVars.join(', '));
    console.error('Note: When deployed to Smithery, configuration is passed directly to createServer()');
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
    
    console.error('MCP Video Cloud Server running on stdio (local development mode)');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run main function if this file is executed directly (local development only)
// Smithery calls createServer() directly, not this main function
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

