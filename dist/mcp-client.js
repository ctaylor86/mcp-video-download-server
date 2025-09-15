#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
// Get server URL from environment
const SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3000';
// Define available tools
const tools = [
    {
        name: 'download_video_to_cloud',
        description: 'Download a video from a URL and store it in cloud storage, returning a public URL',
        inputSchema: {
            type: 'object',
            properties: {
                url: {
                    type: 'string',
                    description: 'URL of the video to download (YouTube, Facebook, Instagram, TikTok, etc.)',
                },
                quality: {
                    type: 'string',
                    description: 'Video quality preference (best, worst, 720p, 1080p, etc.)',
                    default: 'best',
                },
            },
            required: ['url'],
        },
    },
    {
        name: 'download_audio_to_cloud',
        description: 'Extract and download audio from a video URL, store in cloud storage, and return a public URL',
        inputSchema: {
            type: 'object',
            properties: {
                url: {
                    type: 'string',
                    description: 'URL of the video to extract audio from',
                },
            },
            required: ['url'],
        },
    },
    {
        name: 'extract_transcript_to_cloud',
        description: 'Extract or generate transcript from a video and store it in cloud storage, returning a public URL',
        inputSchema: {
            type: 'object',
            properties: {
                url: {
                    type: 'string',
                    description: 'URL of the video to extract transcript from',
                },
                language: {
                    type: 'string',
                    description: 'Language code for subtitles (e.g., en, es, fr, de)',
                    default: 'en',
                },
            },
            required: ['url'],
        },
    },
    {
        name: 'extract_thumbnail_to_cloud',
        description: 'Extract thumbnail from a video and store it in cloud storage, returning a public URL',
        inputSchema: {
            type: 'object',
            properties: {
                url: {
                    type: 'string',
                    description: 'URL of the video to extract thumbnail from',
                },
            },
            required: ['url'],
        },
    },
    {
        name: 'get_video_metadata',
        description: 'Get comprehensive metadata about a video without downloading it',
        inputSchema: {
            type: 'object',
            properties: {
                url: {
                    type: 'string',
                    description: 'URL of the video to get metadata for',
                },
            },
            required: ['url'],
        },
    },
];
// HTTP request helper
async function makeRequest(endpoint, data) {
    const response = await fetch(`${SERVER_URL}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
}
// Create MCP server (acts as a proxy to the HTTP API)
const server = new Server({
    name: 'mcp-video-cloud-client',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
});
// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        let result;
        switch (name) {
            case 'download_video_to_cloud': {
                const { url, quality = 'best' } = args;
                result = await makeRequest('/download-video', { url, quality });
                break;
            }
            case 'download_audio_to_cloud': {
                const { url } = args;
                result = await makeRequest('/download-audio', { url });
                break;
            }
            case 'extract_transcript_to_cloud': {
                const { url, language = 'en' } = args;
                result = await makeRequest('/extract-transcript', { url, language });
                break;
            }
            case 'extract_thumbnail_to_cloud': {
                const { url } = args;
                result = await makeRequest('/extract-thumbnail', { url });
                break;
            }
            case 'get_video_metadata': {
                const { url } = args;
                result = await makeRequest('/get-metadata', { url });
                break;
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
        // Format response based on the result
        if (result.success) {
            let text = '';
            if (name === 'download_video_to_cloud') {
                text = `Video downloaded successfully!\n\nPublic URL: ${result.publicUrl}\nFilename: ${result.filename}\nFile Size: ${result.fileSize ? Math.round(result.fileSize / 1024 / 1024 * 100) / 100 : 'Unknown'} MB\n\nMetadata:\nTitle: ${result.metadata?.title}\nUploader: ${result.metadata?.uploader}\nDuration: ${result.metadata?.duration ? Math.round(result.metadata.duration / 60 * 100) / 100 : 'Unknown'} minutes`;
            }
            else if (name === 'download_audio_to_cloud') {
                text = `Audio extracted successfully!\n\nPublic URL: ${result.publicUrl}\nFilename: ${result.filename}\nFile Size: ${result.fileSize ? Math.round(result.fileSize / 1024 / 1024 * 100) / 100 : 'Unknown'} MB\n\nMetadata:\nTitle: ${result.metadata?.title}\nUploader: ${result.metadata?.uploader}\nDuration: ${result.metadata?.duration ? Math.round(result.metadata.duration / 60 * 100) / 100 : 'Unknown'} minutes`;
            }
            else if (name === 'extract_transcript_to_cloud') {
                text = `Transcript extracted successfully!\n\nPublic URL: ${result.publicUrl}\nFilename: ${result.filename}\nLanguage: ${result.language}\n\nTranscript Preview:\n${result.transcript?.substring(0, 500)}${result.transcript && result.transcript.length > 500 ? '...' : ''}`;
            }
            else if (name === 'extract_thumbnail_to_cloud') {
                text = `Thumbnail extracted successfully!\n\nPublic URL: ${result.publicUrl}\nFilename: ${result.filename}`;
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: text,
                    },
                ],
            };
        }
        else if (name === 'get_video_metadata') {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Video Metadata:\n\nTitle: ${result.title}\nUploader: ${result.uploader || 'Unknown'}\nDuration: ${result.duration ? Math.round(result.duration / 60 * 100) / 100 : 'Unknown'} minutes\nViews: ${result.viewCount?.toLocaleString() || 'Unknown'}\nLikes: ${result.likeCount?.toLocaleString() || 'Unknown'}\nUpload Date: ${result.uploadDate || 'Unknown'}\nExtractor: ${result.extractor}\nURL: ${result.webpage_url}\n\nDescription:\n${result.description?.substring(0, 500)}${result.description && result.description.length > 500 ? '...' : ''}`,
                    },
                ],
            };
        }
        else {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed: ${result.error}`,
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
                    text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
                },
            ],
            isError: true,
        };
    }
});
// Start server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`MCP Video Cloud Client connected to ${SERVER_URL}`);
}
main().catch((error) => {
    console.error('Client error:', error);
    process.exit(1);
});
//# sourceMappingURL=mcp-client.js.map