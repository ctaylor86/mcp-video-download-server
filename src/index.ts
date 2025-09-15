#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

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
    // Create MCP server
  const server = new McpServer({
        name: 'MCP Video Cloud Server',
        version: '1.0.0',
  });

  // Register a simple test tool first
  server.registerTool(
        'get_video_metadata',
    {
            title: 'Get Video Metadata',
            description: 'Get basic metadata about a video URL (test tool)',
            inputSchema: {
                      url: z.string().describe('URL of the video'),
            },
    },
        async ({ url }) => {
                try {
                          return {
                                      success: true,
                                      url: url,
                                      message: 'Video metadata extraction will be implemented with yt-dlp',
                                      config_received: {
                                                    s3Endpoint: config.s3Endpoint,
                                                    s3Region: config.s3Region,
                                                    s3BucketName: config.s3BucketName,
                                      }
                          };
                } catch (error) {
                          return {
                                      success: false,
                                      error: error instanceof Error ? error.message : 'Unknown error',
                          };
                }
        }
      );

  return server;
}

// Main function for stdio transport (local development)
async function main() {
    // For local development, use environment variables
  const config = {
        s3Endpoint: process.env.S3_ENDPOINT || 'https://example.r2.cloudflarestorage.com',
        s3Region: process.env.S3_REGION || 'auto',
        s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || 'test-key',
        s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'test-secret',
        s3BucketName: process.env.S3_BUCKET_NAME || 'test-bucket',
        s3PublicUrlBase: process.env.S3_PUBLIC_URL_BASE,
  };

  const server = createServer({ config });
    const transport = new StdioServerTransport();

  await server.connect(transport);
    console.error('MCP Video Cloud Server running on stdio');
}

// Run main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
          console.error('Server error:', error);
          process.exit(1);
    });
}
