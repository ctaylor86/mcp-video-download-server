#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { CloudStorageService } from './storage.js';
import { VideoDownloaderService } from './downloader.js';
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
export default function createServer({ config, }) {
    // Initialize services with config
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
    // Create MCP server
    const server = new McpServer({
        name: 'MCP Video Cloud Server',
        version: '1.0.0',
    });
    // Register download video tool
    server.registerTool('download_video_to_cloud', {
        title: 'Download Video to Cloud',
        description: 'Download a video from a URL and store it in cloud storage, returning a public URL',
        inputSchema: {
            url: z.string().describe('URL of the video to download (YouTube, Facebook, Instagram, TikTok, etc.)'),
            quality: z.string().optional().default('best').describe('Video quality preference (best, worst, 720p, 1080p, etc.)'),
        },
    }, async ({ url, quality = 'best' }) => {
        try {
            const result = await downloaderService.downloadVideo(url, quality);
            if (result.success) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Video downloaded successfully!\n\nPublic URL: ${result.publicUrl}\nFilename: ${result.filename}\nFile Size: ${result.fileSize ? Math.round(result.fileSize / 1024 / 1024 * 100) / 100 : 'Unknown'} MB\n\nMetadata:\nTitle: ${result.metadata?.title}\nUploader: ${result.metadata?.uploader}\nDuration: ${result.metadata?.duration ? Math.round(result.metadata.duration / 60 * 100) / 100 : 'Unknown'} minutes`,
                        },
                    ],
                };
            }
            else {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Failed to download video: ${result.error}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error downloading video: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    },
                ],
                isError: true,
            };
        }
    });
    // Register download audio tool
    server.registerTool('download_audio_to_cloud', {
        title: 'Download Audio to Cloud',
        description: 'Extract and download audio from a video URL, store in cloud storage, and return a public URL',
        inputSchema: {
            url: z.string().describe('URL of the video to extract audio from'),
        },
    }, async ({ url }) => {
        try {
            const result = await downloaderService.downloadAudio(url);
            if (result.success) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Audio extracted successfully!\n\nPublic URL: ${result.publicUrl}\nFilename: ${result.filename}\nFile Size: ${result.fileSize ? Math.round(result.fileSize / 1024 / 1024 * 100) / 100 : 'Unknown'} MB\n\nMetadata:\nTitle: ${result.metadata?.title}\nUploader: ${result.metadata?.uploader}\nDuration: ${result.metadata?.duration ? Math.round(result.metadata.duration / 60 * 100) / 100 : 'Unknown'} minutes`,
                        },
                    ],
                };
            }
            else {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Failed to extract audio: ${result.error}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error extracting audio: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    },
                ],
                isError: true,
            };
        }
    });
    // Register extract transcript tool
    server.registerTool('extract_transcript_to_cloud', {
        title: 'Extract Transcript to Cloud',
        description: 'Extract or generate transcript from a video and store it in cloud storage, returning a public URL',
        inputSchema: {
            url: z.string().describe('URL of the video to extract transcript from'),
            language: z.string().optional().default('en').describe('Language code for subtitles (e.g., en, es, fr, de)'),
        },
    }, async ({ url, language = 'en' }) => {
        try {
            const result = await downloaderService.extractTranscript(url, language);
            if (result.success) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Transcript extracted successfully!\n\nPublic URL: ${result.publicUrl}\nFilename: ${result.filename}\nLanguage: ${result.language}\n\nTranscript Preview:\n${result.transcript?.substring(0, 500)}${result.transcript && result.transcript.length > 500 ? '...' : ''}`,
                        },
                    ],
                };
            }
            else {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Failed to extract transcript: ${result.error}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error extracting transcript: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    },
                ],
                isError: true,
            };
        }
    });
    // Register extract thumbnail tool
    server.registerTool('extract_thumbnail_to_cloud', {
        title: 'Extract Thumbnail to Cloud',
        description: 'Extract thumbnail from a video and store it in cloud storage, returning a public URL',
        inputSchema: {
            url: z.string().describe('URL of the video to extract thumbnail from'),
        },
    }, async ({ url }) => {
        try {
            const result = await downloaderService.extractThumbnail(url);
            if (result.success) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Thumbnail extracted successfully!\n\nPublic URL: ${result.publicUrl}\nFilename: ${result.filename}`,
                        },
                    ],
                };
            }
            else {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Failed to extract thumbnail: ${result.error}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error extracting thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    },
                ],
                isError: true,
            };
        }
    });
    // Register get metadata tool
    server.registerTool('get_video_metadata', {
        title: 'Get Video Metadata',
        description: 'Get comprehensive metadata about a video without downloading it',
        inputSchema: {
            url: z.string().describe('URL of the video to get metadata for'),
        },
    }, async ({ url }) => {
        try {
            const metadata = await downloaderService.getVideoMetadata(url);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Video Metadata:\n\nTitle: ${metadata.title}\nUploader: ${metadata.uploader || 'Unknown'}\nDuration: ${metadata.duration ? Math.round(metadata.duration / 60 * 100) / 100 : 'Unknown'} minutes\nViews: ${metadata.viewCount?.toLocaleString() || 'Unknown'}\nLikes: ${metadata.likeCount?.toLocaleString() || 'Unknown'}\nUpload Date: ${metadata.uploadDate || 'Unknown'}\nExtractor: ${metadata.extractor}\nURL: ${metadata.webpage_url}\n\nDescription:\n${metadata.description?.substring(0, 500)}${metadata.description && metadata.description.length > 500 ? '...' : ''}`,
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error getting metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    },
                ],
                isError: true,
            };
        }
    });
    return server.server;
}
// STDIO support for backward compatibility and local development
async function main() {
    // Get configuration from environment variables
    const config = {
        s3Endpoint: process.env.S3_ENDPOINT,
        s3Region: process.env.S3_REGION,
        s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
        s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        s3BucketName: process.env.S3_BUCKET_NAME,
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
    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            console.error(`Missing required environment variable: ${envVar}`);
            process.exit(1);
        }
    }
    // Create server with configuration
    const server = createServer({ config });
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP Video Cloud Server running in stdio mode');
}
// By default run the server with stdio transport
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error('Server error:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map