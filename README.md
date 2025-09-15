# MCP Video Cloud Server

A **Remote** Model Context Protocol (MCP) server that downloads videos from social media platforms (YouTube, Facebook, Instagram, TikTok, etc.) and stores them in S3-compatible cloud storage, returning publicly accessible URLs. 

**✨ Optimized for Smithery.ai deployment** - Deploy in minutes with one-click setup!

## 🚀 Quick Deploy to Smithery.ai

1. **Fork this repository** to your GitHub account
2. **Set up Cloudflare R2** (or AWS S3) storage
3. **Deploy on Smithery.ai** - Click "Deploy" and connect your GitHub repo
4. **Configure your S3 credentials** in Smithery's interface
5. **Start using** - Connect to Claude Desktop and download videos!

👉 **[See detailed deployment instructions](DEPLOYMENT.md)**

## ✨ Features

- **Multi-Platform Support**: Download from 1000+ sites via yt-dlp
- **Cloud Storage**: Automatic upload to S3/R2 with public URLs
- **Transcript Extraction**: Get clean text transcripts
- **Thumbnail Extraction**: Extract video thumbnails
- **Audio Extraction**: Extract audio in MP3 format
- **Metadata Retrieval**: Get comprehensive video information
- **Remote Access**: Runs in the cloud, no local setup needed
- **Smithery Integration**: One-click deployment and scaling

## 🎯 Supported Platforms

- YouTube
- Facebook
- Instagram
- TikTok
- Twitter/X
- Vimeo
- Twitch
- And 1000+ other sites

## 🛠️ Available Tools

### `download_video_to_cloud`
Download a video and store it in cloud storage.
- **Input**: Video URL, quality preference
- **Output**: Public URL, filename, file size, metadata

### `download_audio_to_cloud`
Extract audio from a video and store it in cloud storage.
- **Input**: Video URL
- **Output**: Public URL, filename, file size, metadata

### `extract_transcript_to_cloud`
Extract subtitles/transcript and store as clean text.
- **Input**: Video URL, language code
- **Output**: Public URL, filename, transcript preview

### `extract_thumbnail_to_cloud`
Extract video thumbnail and store it in cloud storage.
- **Input**: Video URL
- **Output**: Public URL, filename

### `get_video_metadata`
Get comprehensive video information without downloading.
- **Input**: Video URL
- **Output**: Title, uploader, duration, views, description, etc.

## 🔧 Configuration

The server requires S3-compatible storage configuration:

```yaml
s3Endpoint: https://your-account.r2.cloudflarestorage.com
s3Region: auto
s3AccessKeyId: your-access-key
s3SecretAccessKey: your-secret-key
s3BucketName: your-bucket-name
s3PublicUrlBase: https://your-custom-domain.com  # Optional
```

## 📁 File Organization

Files are organized in your S3 bucket:
- `videos/` - Downloaded video files
- `audio/` - Extracted audio files
- `transcripts/` - Transcript text files
- `thumbnails/` - Thumbnail images

## 🔒 Security & Privacy

- All files stored in **your own** S3 bucket
- No data permanently stored on the server
- Temporary files automatically cleaned up
- Credentials securely managed by Smithery
- Server runs in isolated containers

## 💰 Cost Considerations

- **Smithery Hosting**: Check current pricing plans
- **Cloudflare R2**: ~$0.015/GB/month storage + bandwidth
- **Processing**: Included in Smithery hosting

## 🏃‍♂️ Local Development

If you want to run locally for development:

### Prerequisites
- Node.js 20+
- yt-dlp installed
- S3 credentials

### Setup
```bash
git clone <your-fork>
cd mcp-video-cloud-server
npm install
npm run build:stdio
```

### Environment Variables
```bash
S3_ENDPOINT=your-endpoint
S3_REGION=auto
S3_ACCESS_KEY_ID=your-key
S3_SECRET_ACCESS_KEY=your-secret
S3_BUCKET_NAME=your-bucket
```

### Run
```bash
npm run start:stdio
```

## 🧪 Testing with Smithery

Use Smithery's development environment:

```bash
npm run dev
```

This starts a development server with the Smithery playground for testing.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with `npm run dev`
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Deployment Issues**: Check [DEPLOYMENT.md](DEPLOYMENT.md)
- **Smithery Support**: Visit https://smithery.ai/support
- **Bug Reports**: Create a GitHub issue
- **Feature Requests**: Create a GitHub issue

---

**Ready to deploy?** 👉 **[Follow the deployment guide](DEPLOYMENT.md)**

