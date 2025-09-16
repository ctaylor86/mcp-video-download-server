import { createServer } from '@modelcontextprotocol/sdk/server/http.js';
import { z } from 'zod';
import { VideoDownloaderService } from './downloader.js';
import { CloudStorageService } from './storage.js';

// Configuration schema for container runtime
const configSchema = z.object({
  s3Endpoint: z.string(),
  s3Region: z.string(),
  s3AccessKeyId: z.string(),
  s3SecretAccessKey: z.string(),
  s3BucketName: z.string(),
  s3PublicUrlBase: z.string().optional(),
});

type Config = z.infer<typeof configSchema>;

// Lazy initialization of services
let services: {
  storage: CloudStorageService;
  downloader: VideoDownloaderService;
} | null = null;

function getServices(config: Config) {
  if (!services) {
    const storageConfig = {
      endpoint: config.s3Endpoint,
      region: config.s3Region,
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey,
      bucketName: config.s3BucketName,
      publicUrlBase: config.s3PublicUrlBase,
    };

    const storageService = new CloudStorageService(storageConfig);
    const downloaderService = new VideoDownloaderService(storageService);

    services = {
      storage: storageService,
      downloader: downloaderService,
    };
  }
  return services;
}

// Create the HTTP server
const server = createServer({
  name: 'mcp-video-download-server',
  version: '1.0.0',
  configSchema,
});

// Register tools
server.registerTool("test_connection", {
  title: "Test Connection",
  description: "Test the S3 connection and display configuration",
  inputSchema: {}
}, async (_, config) => {
  try {
    const { storage } = getServices(config);
    const result = await storage.testConnection();
    
    if (result.success) {
      return {
        content: [
          {
            type: "text",
            text: `✅ S3 Connection Test Successful!

📋 Configuration:
- Endpoint: ${config.s3Endpoint}
- Region: ${config.s3Region}
- Bucket: ${config.s3BucketName}
- Public URL Base: ${config.s3PublicUrlBase || 'Not set (using presigned URLs)'}

🔗 Connection Details:
- Status: Connected
- Access: Read/Write permissions verified
- Upload Test: ${result.message}

🚀 Your MCP Video Download Server is ready to use!`
          }
        ]
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: `❌ S3 Connection Test Failed

📋 Configuration:
- Endpoint: ${config.s3Endpoint}
- Region: ${config.s3Region}
- Bucket: ${config.s3BucketName}

🔍 Error Details:
${result.error}

🔧 Please check your S3 credentials and bucket configuration.`
          }
        ]
      };
    }
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

server.registerTool("download_video_to_cloud", {
  title: "Download Video to Cloud",
  description: "Download a video from a URL and upload it to cloud storage",
  inputSchema: {
    url: z.string().describe('Video URL to download'),
    quality: z.string().optional().describe('Video quality preference (best, worst, 720p, 1080p, etc.)')
  }
}, async ({ url, quality }, config) => {
  try {
    const { downloader } = getServices(config);
    const result = await downloader.downloadVideo(url, quality || 'best');
    
    if (result.success) {
      return {
        content: [
          {
            type: "text",
            text: `✅ Video Downloaded Successfully!

📁 File Information:
- Filename: ${result.filename}
- File Size: ${(result.fileSize! / (1024 * 1024)).toFixed(2)} MB
- Quality: ${quality || 'best'}

🔗 Public URL:
${result.publicUrl}

${result.metadata ? `📊 Video Metadata:
- Title: ${result.metadata.title}
- Duration: ${result.metadata.duration ? Math.floor(result.metadata.duration / 60) + ':' + (result.metadata.duration % 60).toString().padStart(2, '0') : 'Unknown'}
- Uploader: ${result.metadata.uploader}
- Platform: ${result.metadata.extractor}` : ''}

🎯 The video has been successfully downloaded and uploaded to your cloud storage!`
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

server.registerTool("download_audio_to_cloud", {
  title: "Download Audio to Cloud",
  description: "Extract audio from a video URL and upload it to cloud storage as MP3",
  inputSchema: {
    url: z.string().describe('Video URL to extract audio from')
  }
}, async ({ url }, config) => {
  try {
    const { downloader } = getServices(config);
    const result = await downloader.downloadAudio(url);
    
    if (result.success) {
      return {
        content: [
          {
            type: "text",
            text: `✅ Audio Extracted Successfully!

📁 File Information:
- Filename: ${result.filename}
- File Size: ${(result.fileSize! / (1024 * 1024)).toFixed(2)} MB
- Format: MP3

🔗 Public URL:
${result.publicUrl}

${result.metadata ? `📊 Audio Metadata:
- Title: ${result.metadata.title}
- Duration: ${result.metadata.duration ? Math.floor(result.metadata.duration / 60) + ':' + (result.metadata.duration % 60).toString().padStart(2, '0') : 'Unknown'}
- Uploader: ${result.metadata.uploader}
- Platform: ${result.metadata.extractor}` : ''}

🎵 The audio has been successfully extracted and uploaded to your cloud storage!`
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

server.registerTool("extract_transcript_to_cloud", {
  title: "Extract Transcript to Cloud",
  description: "Extract subtitles/transcript from a video and upload to cloud storage",
  inputSchema: {
    url: z.string().describe('Video URL to extract transcript from'),
    language: z.string().optional().describe('Language code for subtitles (e.g., en, es, fr)')
  }
}, async ({ url, language }, config) => {
  try {
    const { downloader } = getServices(config);
    const result = await downloader.extractTranscript(url, language || 'en');
    
    if (result.success) {
      return {
        content: [
          {
            type: "text",
            text: `✅ Transcript Extracted Successfully!

📁 File Information:
- Filename: ${result.filename}
- Language: ${result.language}

🔗 Public URL:
${result.publicUrl}

📝 Transcript Preview:
${result.transcript!.substring(0, 500)}${result.transcript!.length > 500 ? '...' : ''}

📋 The complete transcript has been uploaded to your cloud storage!`
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

server.registerTool("extract_thumbnail_to_cloud", {
  title: "Extract Thumbnail to Cloud",
  description: "Extract thumbnail from a video and upload to cloud storage",
  inputSchema: {
    url: z.string().describe('Video URL to extract thumbnail from')
  }
}, async ({ url }, config) => {
  try {
    const { downloader } = getServices(config);
    const result = await downloader.extractThumbnail(url);
    
    if (result.success) {
      return {
        content: [
          {
            type: "text",
            text: `✅ Thumbnail Extracted Successfully!

📁 File Information:
- Filename: ${result.filename}

🔗 Public URL:
${result.publicUrl}

🖼️ The thumbnail has been successfully extracted and uploaded to your cloud storage!`
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

server.registerTool("get_video_metadata", {
  title: "Get Video Metadata",
  description: "Get comprehensive metadata about a video without downloading it",
  inputSchema: {
    url: z.string().describe('Video URL to get metadata for')
  }
}, async ({ url }, config) => {
  try {
    const { downloader } = getServices(config);
    const metadata = await downloader.getVideoMetadata(url);
    
    return {
      content: [
        {
          type: "text",
          text: `📊 Video Metadata Retrieved Successfully!

📋 Basic Information:
- Title: ${metadata.title}
- ID: ${metadata.id}
- Platform: ${metadata.extractor}
- Uploader: ${metadata.uploader}

⏱️ Duration & Stats:
- Duration: ${metadata.duration ? Math.floor(metadata.duration / 60) + ':' + (metadata.duration % 60).toString().padStart(2, '0') : 'Unknown'}
- View Count: ${metadata.viewCount ? metadata.viewCount.toLocaleString() : 'Unknown'}
- Like Count: ${metadata.likeCount ? metadata.likeCount.toLocaleString() : 'Unknown'}

📅 Upload Information:
- Upload Date: ${metadata.uploadDate || 'Unknown'}

🔗 URLs:
- Original URL: ${metadata.webpage_url}
- Thumbnail: ${metadata.thumbnail || 'Not available'}

📝 Description:
${metadata.description ? metadata.description.substring(0, 500) + (metadata.description.length > 500 ? '...' : '') : 'No description available'}

${metadata.formats && metadata.formats.length > 0 ? `🎥 Available Formats: ${metadata.formats.length} formats detected` : ''}`
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

// Start the server
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
server.listen(port, () => {
  console.log(`MCP Video Download Server running on port ${port}`);
});

export default server;

