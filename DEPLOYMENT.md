# Deployment Instructions for Smithery.ai

This MCP Video Cloud Server is ready for deployment on Smithery.ai. Follow these steps:

## Prerequisites

1. **S3-Compatible Storage**: Set up Cloudflare R2 or AWS S3
2. **GitHub Account**: For repository hosting
3. **Smithery Account**: Sign up at https://smithery.ai

## Step 1: Set Up S3 Storage (Recommended: Cloudflare R2)

### Cloudflare R2 Setup:
1. Go to Cloudflare Dashboard → R2 Object Storage
2. Create a new bucket (e.g., `my-video-bucket`)
3. Go to "Manage R2 API tokens"
4. Create a new API token with R2 permissions
5. Note down:
   - Account ID (for endpoint URL)
   - Access Key ID
   - Secret Access Key
   - Bucket name

Your endpoint will be: `https://<account-id>.r2.cloudflarestorage.com`

## Step 2: Push to GitHub

1. Create a new repository on GitHub
2. Add the remote and push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/mcp-video-cloud-server.git
git branch -M main
git push -u origin main
```

## Step 3: Deploy on Smithery

1. Go to https://smithery.ai
2. Click "Deploy" 
3. Connect your GitHub repository
4. Configure the following environment variables:

### Required Configuration:

- **s3Endpoint**: `https://your-account-id.r2.cloudflarestorage.com`
- **s3Region**: `auto` (for Cloudflare R2)
- **s3AccessKeyId**: Your R2 access key ID
- **s3SecretAccessKey**: Your R2 secret access key
- **s3BucketName**: Your bucket name (e.g., `my-video-bucket`)
- **s3PublicUrlBase**: (Optional) Custom domain for public URLs

### Example Configuration:
```yaml
s3Endpoint: https://abc123.r2.cloudflarestorage.com
s3Region: auto
s3AccessKeyId: your-access-key-here
s3SecretAccessKey: your-secret-key-here
s3BucketName: my-video-bucket
s3PublicUrlBase: https://files.yourdomain.com
```

## Step 4: Test the Deployment

1. Once deployed, Smithery will provide a server URL
2. Test using the Smithery playground
3. Try commands like:
   - "Download this YouTube video: https://youtube.com/watch?v=..."
   - "Extract audio from this video: ..."
   - "Get metadata for this video: ..."

## Step 5: Connect to Claude Desktop

Add to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "video-cloud-downloader": {
      "command": "smithery",
      "args": ["connect", "YOUR_DEPLOYED_SERVER_ID"]
    }
  }
}
```

Or use the Smithery connection URL provided after deployment.

## Available Tools

Once deployed, your server will provide these tools:

1. **download_video_to_cloud** - Download videos and get public URLs
2. **download_audio_to_cloud** - Extract audio and get public URLs  
3. **extract_transcript_to_cloud** - Extract transcripts and get public URLs
4. **extract_thumbnail_to_cloud** - Extract thumbnails and get public URLs
5. **get_video_metadata** - Get video information without downloading

## Supported Platforms

- YouTube
- Facebook  
- Instagram
- TikTok
- Twitter/X
- Vimeo
- Twitch
- 1000+ other sites via yt-dlp

## Troubleshooting

### Common Issues:

**"S3 upload failed"**
- Verify your S3 credentials are correct
- Check bucket permissions allow read/write
- Ensure the bucket exists

**"yt-dlp not found"**
- This should be handled automatically by Smithery's containerization
- If issues persist, check the deployment logs

**"Video download failed"**
- Some videos may be geo-restricted or private
- Try different quality settings
- Check if the URL is valid and accessible

### Getting Help:

1. Check Smithery deployment logs
2. Test with simple YouTube videos first
3. Verify S3 bucket permissions
4. Contact Smithery support if deployment issues persist

## Cost Considerations

- **Smithery Hosting**: Check Smithery pricing plans
- **Storage**: R2 storage costs (~$0.015/GB/month)
- **Bandwidth**: R2 egress costs (~$0.36/GB for first 10TB)
- **Compute**: Included in Smithery hosting

## Security Notes

- All credentials are stored securely in Smithery
- Files are stored in your own S3 bucket
- No data is permanently stored on the MCP server
- Temporary files are automatically cleaned up

