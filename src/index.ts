import express, { Request, Response } from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { parseAndValidateConfig } from "@smithery/sdk";
import { CloudStorageService } from './storage.js';
import { VideoDownloaderService } from './downloader.js';
import type { S3Config } from './types.js';

const app = express();
const PORT = process.env.PORT || 8081;

// CORS configuration for browser-based MCP clients
app.use(cors({
  origin: '*', // Configure appropriately for production
  exposedHeaders: ['Mcp-Session-Id', 'mcp-protocol-version'],
  allowedHeaders: ['Content-Type', 'mcp-session-id'],
}));

app.use(express.json());

// Define session configuration schema
export const configSchema = z.object({
  s3Endpoint: z.string().describe('S3-compatible endpoint URL'),
  s3Region: z.string().describe('S3 region'),
  s3AccessKeyId: z.string().describe('S3 access key ID'),
  s3SecretAccessKey: z.string().describe('S3 secret access key'),
  s3BucketName: z.string().describe('S3 bucket name'),
  s3PublicUrlBase: z.string().optional().describe('Public URL base for S3 files (optional)')
});

type Config = z.infer<typeof configSchema>;

// Lazy initialization of services
let services: {
  storage: CloudStorageService;
  downloader: VideoDownloaderService;
} | null = null;

function getServices(config: Config) {
  if (!services) {
    const storageConfig: S3Config = {
      endpoint: config.s3Endpoint,
      region: config.s3Region,
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey,
      bucketName: config.s3BucketName,
      publicUrlBase: config.s3PublicUrlBase
    };

    const storage = new CloudStorageService(storageConfig);
    const downloader = new VideoDownloaderService(storage);

    services = { storage, downloader };
  }
  return services;
}

// Create MCP server with your tools
export default function createServer({
  config,
}: {
  config: z.infer<typeof configSchema>;
}) {
  const server = new McpServer({
    name: "mcp-video-download-server",
    version: "1.0.0",
  });

  // Test connection tool
  server.registerTool("test_connection", {
    title: "Test Connection",
    description: "Test S3 connectivity and show configuration",
    inputSchema: {}
  }, async () => {
    try {
      const { storage } = getServices(config);
      const result = await storage.testConnection();
      
      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `✅ S3 Connection Test Successful!\n\n📋 Configuration:\n• Endpoint: ${config.s3Endpoint}\n• Region: ${config.s3Region}\n• Bucket: ${config.s3BucketName}\n• Access Key: ${config.s3AccessKeyId.substring(0, 8)}...\n\n🔗 Connection Details:\n${result.details}`
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `❌ S3 Connection Test Failed!\n\nError: ${result.error}\n\n📋 Configuration:\n• Endpoint: ${config.s3Endpoint}\n• Region: ${config.s3Region}\n• Bucket: ${config.s3BucketName}`
            }
          ]
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  });

  // Download video to cloud tool
  server.registerTool("download_video_to_cloud", {
    title: "Download Video to Cloud",
    description: "Download a video from a URL and upload it to cloud storage",
    inputSchema: {
      url: z.string().describe('Video URL to download'),
      quality: z.string().optional().describe('Video quality preference (e.g., "best", "worst", "720p")')
    }
  }, async ({ url, quality }: { url: string; quality?: string }) => {
    try {
      const { downloader } = getServices(config);
      const result = await downloader.downloadVideo(url, quality);
      
      if (result.success && result.data) {
        return {
          content: [
            {
              type: 'text',
              text: `✅ Video downloaded successfully!\n\n📁 File Details:\n• Filename: ${result.data.filename}\n• Size: ${result.data.size} bytes\n• Format: ${result.data.format}\n\n🔗 Cloud Storage:\n• URL: ${result.data.url}\n• Path: ${result.data.path}`
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Video download failed: ${result.error}`
            }
          ]
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error downloading video: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  });

  // Download audio to cloud tool
  server.registerTool("download_audio_to_cloud", {
    title: "Download Audio to Cloud",
    description: "Extract audio from a video URL and upload it to cloud storage",
    inputSchema: {
      url: z.string().describe('Video URL to extract audio from'),
      format: z.string().optional().describe('Audio format (default: mp3)')
    }
  }, async ({ url, format }: { url: string; format?: string }) => {
    try {
      const { downloader } = getServices(config);
      const result = await downloader.downloadAudio(url, format);
      
      if (result.success && result.data) {
        return {
          content: [
            {
              type: 'text',
              text: `✅ Audio extracted successfully!\n\n📁 File Details:\n• Filename: ${result.data.filename}\n• Size: ${result.data.size} bytes\n• Format: ${result.data.format}\n\n🔗 Cloud Storage:\n• URL: ${result.data.url}\n• Path: ${result.data.path}`
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Audio extraction failed: ${result.error}`
            }
          ]
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error extracting audio: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  });

  // Extract transcript to cloud tool
  server.registerTool("extract_transcript_to_cloud", {
    title: "Extract Transcript to Cloud",
    description: "Extract transcript/subtitles from a video URL and upload to cloud storage",
    inputSchema: {
      url: z.string().describe('Video URL to extract transcript from'),
      language: z.string().optional().describe('Language code for subtitles (e.g., "en", "es")')
    }
  }, async ({ url, language }: { url: string; language?: string }) => {
    try {
      const { downloader } = getServices(config);
      const result = await downloader.extractTranscript(url, language);
      
      if (result.success && result.data) {
        return {
          content: [
            {
              type: 'text',
              text: `✅ Transcript extracted successfully!\n\n📁 File Details:\n• Filename: ${result.data.filename}\n• Size: ${result.data.size} bytes\n• Language: ${result.data.language || 'auto-detected'}\n\n🔗 Cloud Storage:\n• URL: ${result.data.url}\n• Path: ${result.data.path}`
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Transcript extraction failed: ${result.error}`
            }
          ]
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error extracting transcript: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  });

  // Extract thumbnail to cloud tool
  server.registerTool("extract_thumbnail_to_cloud", {
    title: "Extract Thumbnail to Cloud",
    description: "Extract thumbnail from a video URL and upload to cloud storage",
    inputSchema: {
      url: z.string().describe('Video URL to extract thumbnail from')
    }
  }, async ({ url }: { url: string }) => {
    try {
      const { downloader } = getServices(config);
      const result = await downloader.extractThumbnail(url);
      
      if (result.success && result.data) {
        return {
          content: [
            {
              type: 'text',
              text: `✅ Thumbnail extracted successfully!\n\n📁 File Details:\n• Filename: ${result.data.filename}\n• Size: ${result.data.size} bytes\n• Format: ${result.data.format}\n\n🔗 Cloud Storage:\n• URL: ${result.data.url}\n• Path: ${result.data.path}`
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Thumbnail extraction failed: ${result.error}`
            }
          ]
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error extracting thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  });

  // Get video metadata tool
  server.registerTool("get_video_metadata", {
    title: "Get Video Metadata",
    description: "Get metadata information about a video without downloading it",
    inputSchema: {
      url: z.string().describe('Video URL to get metadata for')
    }
  }, async ({ url }: { url: string }) => {
    try {
      const { downloader } = getServices(config);
      const result = await downloader.getVideoMetadata(url);
      
      if (result.success && result.data) {
        const metadata = result.data;
        return {
          content: [
            {
              type: 'text',
              text: `📊 Video Metadata:\n\n📹 Basic Info:\n• Title: ${metadata.title}\n• Duration: ${metadata.duration} seconds\n• Uploader: ${metadata.uploader}\n• View Count: ${metadata.viewCount?.toLocaleString() || 'N/A'}\n\n🎥 Technical Details:\n• Resolution: ${metadata.width}x${metadata.height}\n• Format: ${metadata.format}\n• File Size: ${metadata.filesize ? `${(metadata.filesize / 1024 / 1024).toFixed(2)} MB` : 'N/A'}\n\n📝 Description:\n${metadata.description ? metadata.description.substring(0, 200) + '...' : 'No description available'}`
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Failed to get video metadata: ${result.error}`
            }
          ]
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error getting video metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  });

  return server.server;
}

// Handle MCP requests at /mcp endpoint
app.all('/mcp', async (req: Request, res: Response) => {
  try {
    const result = parseAndValidateConfig(req, configSchema);
    if (result.error) {
      return res.status(result.value.status).json(result.value);
    }

    const server = createServer({ config: result.value });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    // Clean up on request close
    res.on('close', () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

// Main function to start the server in the appropriate mode
async function main() {
  const transport = process.env.TRANSPORT || 'stdio';
  
  if (transport === 'http') {
    // Run in HTTP mode
    app.listen(PORT, () => {
      console.log(`MCP HTTP Server listening on port ${PORT}`);
    });
  } else {
    // STDIO mode for local development
    console.error("STDIO mode not supported in container deployment");
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});

