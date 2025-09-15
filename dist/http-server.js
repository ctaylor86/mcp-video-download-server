#!/usr/bin/env node
import { createServer } from 'http';
import { CloudStorageService } from './storage.js';
import { VideoDownloaderService } from './downloader.js';
// Environment variables for configuration
const getConfig = () => {
    const requiredEnvVars = [
        'S3_ENDPOINT',
        'S3_REGION',
        'S3_ACCESS_KEY_ID',
        'S3_SECRET_ACCESS_KEY',
        'S3_BUCKET_NAME'
    ];
    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            throw new Error(`Missing required environment variable: ${envVar}`);
        }
    }
    return {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION,
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        bucketName: process.env.S3_BUCKET_NAME,
        publicUrlBase: process.env.S3_PUBLIC_URL_BASE,
    };
};
// Initialize services
let storageService;
let downloaderService;
try {
    const config = getConfig();
    storageService = new CloudStorageService(config);
    downloaderService = new VideoDownloaderService(storageService);
}
catch (error) {
    console.error('Failed to initialize services:', error);
    process.exit(1);
}
// CORS headers
const setCORSHeaders = (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};
// JSON response helper
const sendJSON = (res, data, status = 200) => {
    setCORSHeaders(res);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
};
// Parse JSON body
const parseJSON = (req) => {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            }
            catch (error) {
                reject(error);
            }
        });
    });
};
// Create HTTP server
const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        setCORSHeaders(res);
        res.writeHead(200);
        res.end();
        return;
    }
    // Health check
    if (url.pathname === '/health') {
        sendJSON(res, {
            status: 'healthy',
            service: 'mcp-video-cloud-server',
            timestamp: new Date().toISOString()
        });
        return;
    }
    // API endpoints
    if (req.method === 'POST') {
        try {
            const body = await parseJSON(req);
            switch (url.pathname) {
                case '/download-video': {
                    const { url: videoUrl, quality = 'best' } = body;
                    if (!videoUrl) {
                        sendJSON(res, { error: 'URL is required' }, 400);
                        return;
                    }
                    const result = await downloaderService.downloadVideo(videoUrl, quality);
                    sendJSON(res, result);
                    break;
                }
                case '/download-audio': {
                    const { url: videoUrl } = body;
                    if (!videoUrl) {
                        sendJSON(res, { error: 'URL is required' }, 400);
                        return;
                    }
                    const result = await downloaderService.downloadAudio(videoUrl);
                    sendJSON(res, result);
                    break;
                }
                case '/extract-transcript': {
                    const { url: videoUrl, language = 'en' } = body;
                    if (!videoUrl) {
                        sendJSON(res, { error: 'URL is required' }, 400);
                        return;
                    }
                    const result = await downloaderService.extractTranscript(videoUrl, language);
                    sendJSON(res, result);
                    break;
                }
                case '/extract-thumbnail': {
                    const { url: videoUrl } = body;
                    if (!videoUrl) {
                        sendJSON(res, { error: 'URL is required' }, 400);
                        return;
                    }
                    const result = await downloaderService.extractThumbnail(videoUrl);
                    sendJSON(res, result);
                    break;
                }
                case '/get-metadata': {
                    const { url: videoUrl } = body;
                    if (!videoUrl) {
                        sendJSON(res, { error: 'URL is required' }, 400);
                        return;
                    }
                    const metadata = await downloaderService.getVideoMetadata(videoUrl);
                    sendJSON(res, metadata);
                    break;
                }
                default:
                    sendJSON(res, { error: 'Endpoint not found' }, 404);
            }
        }
        catch (error) {
            console.error('Request error:', error);
            sendJSON(res, {
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            }, 500);
        }
    }
    else if (req.method === 'GET' && url.pathname === '/') {
        // API documentation
        setCORSHeaders(res);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>MCP Video Cloud Server</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .endpoint { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .method { background: #007acc; color: white; padding: 3px 8px; border-radius: 3px; font-size: 12px; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>MCP Video Cloud Server</h1>
    <p>A remote server for downloading videos from social media platforms and storing them in S3-compatible cloud storage.</p>
    
    <h2>API Endpoints</h2>
    
    <div class="endpoint">
        <h3><span class="method">POST</span> /download-video</h3>
        <p>Download a video and store it in cloud storage.</p>
        <pre>{"url": "https://youtube.com/watch?v=...", "quality": "best"}</pre>
    </div>
    
    <div class="endpoint">
        <h3><span class="method">POST</span> /download-audio</h3>
        <p>Extract audio from a video and store it in cloud storage.</p>
        <pre>{"url": "https://youtube.com/watch?v=..."}</pre>
    </div>
    
    <div class="endpoint">
        <h3><span class="method">POST</span> /extract-transcript</h3>
        <p>Extract transcript from a video and store it in cloud storage.</p>
        <pre>{"url": "https://youtube.com/watch?v=...", "language": "en"}</pre>
    </div>
    
    <div class="endpoint">
        <h3><span class="method">POST</span> /extract-thumbnail</h3>
        <p>Extract thumbnail from a video and store it in cloud storage.</p>
        <pre>{"url": "https://youtube.com/watch?v=..."}</pre>
    </div>
    
    <div class="endpoint">
        <h3><span class="method">POST</span> /get-metadata</h3>
        <p>Get comprehensive video metadata without downloading.</p>
        <pre>{"url": "https://youtube.com/watch?v=..."}</pre>
    </div>
    
    <div class="endpoint">
        <h3><span class="method">GET</span> /health</h3>
        <p>Health check endpoint.</p>
    </div>
    
    <h2>Usage with MCP</h2>
    <p>This server can be used as a remote API for MCP clients. Each endpoint returns structured data with public URLs for downloaded files.</p>
</body>
</html>
    `);
    }
    else {
        sendJSON(res, { error: 'Method not allowed' }, 405);
    }
});
// Start server
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
server.listen(port, '0.0.0.0', () => {
    console.error(`MCP Video Cloud Server running on HTTP port ${port}`);
    console.error(`API documentation: http://your-server-host:${port}/`);
    console.error(`Health check: http://your-server-host:${port}/health`);
});
// Graceful shutdown
process.on('SIGTERM', () => {
    console.error('Received SIGTERM, shutting down gracefully');
    server.close(() => {
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    console.error('Received SIGINT, shutting down gracefully');
    server.close(() => {
        process.exit(0);
    });
});
//# sourceMappingURL=http-server.js.map