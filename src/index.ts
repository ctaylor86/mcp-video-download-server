import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CloudStorageService } from './storage.js';
import { VideoDownloaderService } from './downloader.js';
import type { CloudStorageConfig } from './types.js';

// Configuration schema for session
export const configSchema = z.object({
  s3Endpoint: z.string().describe('S3-compatible endpoint URL'),
  s3Region: z.string().describe('S3 region'),
  s3AccessKeyId: z.string().describe('S3 access key ID'),
  s3SecretAccessKey: z.string().describe('S3 secret access key'),
  s3BucketName: z.string().describe('S3 bucket name'),
  s3PublicUrlBase: z.string().optional().describe('Custom public URL base for files'),
});

export default function createServer({ config }) {
  const server = new McpServer({
    name: "MCP Video Cloud Server",
    version: "1.0.0",
  });

  // Initialize services with config (lazy initialization)
  const storageConfig: CloudStorageConfig = {
    endpoint: config.s3Endpoint,
    region: config.s3Region,
    accessKeyId: config.s3AccessKeyId,
    secretAccessKey: config.s3SecretAccessKey,
    bucketName: config.s3BucketName,
    publicUrlBase: config.s3PublicUrlBase,
  };

  // Lazy initialization to prevent startup delays
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

  // Test connection tool
  server.registerTool("test_connection", {
    title: "Test Connection",
    description: "Test if the MCP server is working and verify S3 configuration",
    inputSchema: {},
  }, async () => {
    try {
      const { storageService } = getServices();
      await storageService.testConnection();
      
      return {
        content: [
          {
            type: "text",
            text: `✅ MCP Video Cloud Server is working!\n\nConfiguration:\n- Endpoint: ${config.s3Endpoint}\n- Region: ${config.s3Region}\n- Bucket: ${config.s3BucketName}\n- Status: Connected\n- Timestamp: ${new Date().toISOString()}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  });

  // Download video tool
  server.registerTool("download_video_to_cloud", {
    title: "Download Video to Cloud",
    description: "Download a video from a URL and store it in cloud storage, returning a public URL",
    inputSchema: {
      url: z.string().describe('URL of the video to download (YouTube, Facebook, Instagram, TikTok, etc.)'),
      quality: z.string().optional().default('best').describe('Video quality preference (best, worst, 720p, 1080p, etc.)'),
    },
  }, async ({ url, quality = 'best' }) => {
    try {
      const { downloaderService } = getServices();
      const result = await downloaderService.downloadVideo(url, quality);
      
      if (result.success) {
        return {
          content: [
            {
              type: "text",
              text: `✅ Video downloaded successfully!\n\n📁 File: ${result.filename}\n🔗 Public URL: ${result.publicUrl}\n📊 Size: ${Math.round((result.fileSize || 0) / 1024 / 1024 * 100) / 100} MB\n\n📋 Video Info:\n- Title: ${result.metadata?.title || 'Unknown'}\n- Duration: ${result.metadata?.duration ? Math.round(result.metadata.duration / 60 * 100) / 100 + ' minutes' : 'Unknown'}\n- Uploader: ${result.metadata?.uploader || 'Unknown'}`
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `❌ Video download failed: ${result.error}`
            }
          ]
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Error downloading video: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  });

  // Download audio tool
  server.registerTool("download_audio_to_cloud", {
    title: "Download Audio to Cloud",
    description: "Extract audio from a video and store it in cloud storage as MP3",
    inputSchema: {
      url: z.string().describe('URL of the video to extract audio from'),
    },
  }, async ({ url }) => {
    try {
      const { downloaderService } = getServices();
      const result = await downloaderService.downloadAudio(url);
      
      if (result.success) {
        return {
          content: [
            {
              type: "text",
              text: `✅ Audio extracted successfully!\n\n🎵 File: ${result.filename}\n🔗 Public URL: ${result.publicUrl}\n📊 Size: ${Math.round((result.fileSize || 0) / 1024 / 1024 * 100) / 100} MB\n\n📋 Source Video:\n- Title: ${result.metadata?.title || 'Unknown'}\n- Duration: ${result.metadata?.duration ? Math.round(result.metadata.duration / 60 * 100) / 100 + ' minutes' : 'Unknown'}\n- Uploader: ${result.metadata?.uploader || 'Unknown'}`
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `❌ Audio extraction failed: ${result.error}`
            }
          ]
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Error extracting audio: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  });

  // Extract transcript tool
  server.registerTool("extract_transcript_to_cloud", {
    title: "Extract Transcript to Cloud",
    description: "Extract subtitles/transcript from a video and store as clean text in cloud storage",
    inputSchema: {
      url: z.string().describe('URL of the video to extract transcript from'),
      language: z.string().optional().default('en').describe('Language code for subtitles (e.g., en, es, fr)'),
    },
  }, async ({ url, language = 'en' }) => {
    try {
      const { downloaderService } = getServices();
      const result = await downloaderService.extractTranscript(url, language);
      
      if (result.success) {
        const preview = result.transcript && result.transcript.length > 200 
          ? result.transcript.substring(0, 200) + '...' 
          : result.transcript || '';
          
        return {
          content: [
            {
              type: "text",
              text: `✅ Transcript extracted successfully!\n\n📄 File: ${result.filename}\n🔗 Public URL: ${result.publicUrl}\n🌐 Language: ${result.language}\n📝 Length: ${result.transcript?.length || 0} characters\n\n📋 Preview:\n${preview}`
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `❌ Transcript extraction failed: ${result.error}`
            }
          ]
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Error extracting transcript: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  });

  // Extract thumbnail tool
  server.registerTool("extract_thumbnail_to_cloud", {
    title: "Extract Thumbnail to Cloud",
    description: "Extract video thumbnail and store it in cloud storage",
    inputSchema: {
      url: z.string().describe('URL of the video to extract thumbnail from'),
    },
  }, async ({ url }) => {
    try {
      const { downloaderService } = getServices();
      const result = await downloaderService.extractThumbnail(url);
      
      if (result.success) {
        return {
          content: [
            {
              type: "text",
              text: `✅ Thumbnail extracted successfully!\n\n🖼️ File: ${result.filename}\n🔗 Public URL: ${result.publicUrl}\n\nYou can view the thumbnail at the public URL above.`
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `❌ Thumbnail extraction failed: ${result.error}`
            }
          ]
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Error extracting thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  });

  // Get video metadata tool
  server.registerTool("get_video_metadata", {
    title: "Get Video Metadata",
    description: "Get comprehensive video information without downloading",
    inputSchema: {
      url: z.string().describe('URL of the video to get metadata for'),
    },
  }, async ({ url }) => {
    try {
      const { downloaderService } = getServices();
      const metadata = await downloaderService.getVideoMetadata(url);
      
      const formatInfo = metadata.formats && metadata.formats.length > 0 
        ? `\n\n📊 Available Formats:\n${metadata.formats.slice(0, 5).map(f => 
            `- ${f.format_id}: ${f.ext} (${f.resolution || 'unknown'}) ${f.filesize ? Math.round(f.filesize / 1024 / 1024) + 'MB' : ''}`
          ).join('\n')}${metadata.formats.length > 5 ? `\n... and ${metadata.formats.length - 5} more formats` : ''}`
        : '';
      
      return {
        content: [
          {
            type: "text",
            text: `✅ Video metadata retrieved successfully!\n\n📋 Video Information:\n- Title: ${metadata.title || 'Unknown'}\n- Duration: ${metadata.duration ? Math.round(metadata.duration / 60 * 100) / 100 + ' minutes' : 'Unknown'}\n- Uploader: ${metadata.uploader || 'Unknown'}\n- Upload Date: ${metadata.uploadDate || 'Unknown'}\n- Views: ${metadata.viewCount?.toLocaleString() || 'Unknown'}\n- Likes: ${metadata.likeCount?.toLocaleString() || 'Unknown'}\n- Platform: ${metadata.extractor || 'Unknown'}\n- Video ID: ${metadata.id || 'Unknown'}\n- URL: ${metadata.webpage_url || url}${formatInfo}\n\n📝 Description:\n${metadata.description ? (metadata.description.length > 300 ? metadata.description.substring(0, 300) + '...' : metadata.description) : 'No description available'}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Error getting video metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  });

  return server.server;
}

