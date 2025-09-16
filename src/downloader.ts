import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { CloudStorageService } from './storage.js';
import type { VideoMetadata, DownloadResult, TranscriptResult, ThumbnailResult } from './types.js';

export class VideoDownloaderService {
  private storage: CloudStorageService;
  private tempDir: string;

  constructor(storage: CloudStorageService) {
    this.storage = storage;
    this.tempDir = '/tmp/video-downloads';
  }

  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  private async runYtDlp(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve) => {
      // Add common arguments to avoid bot detection
      const commonArgs = [
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        '--add-header', 'Accept-Language:en-us,en;q=0.5',
        '--add-header', 'Sec-Fetch-Mode:navigate',
        '--no-check-certificates',
        '--prefer-free-formats',
        '--no-warnings',
        ...args
      ];

      const process = spawn('yt-dlp', commonArgs);
      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        resolve({ stdout, stderr, code: code || 0 });
      });

      process.on('error', (error) => {
        resolve({ stdout, stderr: error.message, code: 1 });
      });
    });
  }

  async downloadVideo(url: string, quality: string = 'best'): Promise<DownloadResult> {
    await this.ensureTempDir();
    
    const filename = `video_${Date.now()}_%(title)s.%(ext)s`;
    const outputPath = path.join(this.tempDir, filename);

    try {
      // Try different quality options to avoid bot detection
      const qualityOptions = quality === 'best' 
        ? ['best[height<=1080]', 'best[height<=720]', 'best[height<=480]', 'worst']
        : [quality, 'best[height<=720]', 'worst'];

      let lastError = '';
      
      for (const qualityOption of qualityOptions) {
        const result = await this.runYtDlp([
          '-f', qualityOption,
          '-o', outputPath,
          '--print', 'filename',
          url
        ]);

        if (result.code === 0) {
          const actualFilename = result.stdout.trim().split('\n').pop() || '';
          const actualPath = path.join(this.tempDir, path.basename(actualFilename));
          
          // Check if file exists
          try {
            const stats = await fs.stat(actualPath);
            const uploadResult = await this.storage.uploadFile(actualPath, `videos/${path.basename(actualPath)}`);
            
            // Clean up local file
            await fs.unlink(actualPath).catch(() => {});
            
            // Get metadata
            const metadata = await this.getVideoMetadata(url);
            
            return {
              success: true,
              filename: path.basename(actualPath),
              publicUrl: uploadResult.publicUrl,
              fileSize: stats.size,
              metadata
            };
          } catch (fileError) {
            lastError = `File not found after download: ${fileError}`;
            continue;
          }
        } else {
          lastError = result.stderr;
          // If it's a bot detection error, try next quality
          if (result.stderr.includes('Sign in to confirm') || result.stderr.includes('bot')) {
            continue;
          }
          // For other errors, break immediately
          break;
        }
      }

      return {
        success: false,
        error: `yt-dlp failed with all quality options. Last error: ${lastError}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async downloadAudio(url: string): Promise<DownloadResult> {
    await this.ensureTempDir();
    
    const filename = `audio_${Date.now()}_%(title)s.%(ext)s`;
    const outputPath = path.join(this.tempDir, filename);

    try {
      // Try multiple audio extraction strategies
      const strategies = [
        // Strategy 1: Best audio with fallback
        ['-f', 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio', '--extract-audio', '--audio-format', 'mp3'],
        // Strategy 2: Lower quality audio
        ['-f', 'worstaudio', '--extract-audio', '--audio-format', 'mp3'],
        // Strategy 3: Any available audio
        ['-x', '--audio-format', 'mp3', '--audio-quality', '5']
      ];

      let lastError = '';

      for (const strategy of strategies) {
        const result = await this.runYtDlp([
          ...strategy,
          '-o', outputPath,
          '--print', 'filename',
          url
        ]);

        if (result.code === 0) {
          // Find the actual output file (yt-dlp might change extension)
          const files = await fs.readdir(this.tempDir);
          const audioFile = files.find(f => f.startsWith(`audio_${Date.now().toString().slice(0, -3)}`));
          
          if (audioFile) {
            const actualPath = path.join(this.tempDir, audioFile);
            const stats = await fs.stat(actualPath);
            const uploadResult = await this.storage.uploadFile(actualPath, `audio/${audioFile}`);
            
            // Clean up local file
            await fs.unlink(actualPath).catch(() => {});
            
            // Get metadata
            const metadata = await this.getVideoMetadata(url);
            
            return {
              success: true,
              filename: audioFile,
              publicUrl: uploadResult.publicUrl,
              fileSize: stats.size,
              metadata
            };
          }
        }
        
        lastError = result.stderr;
        // If it's a bot detection error, try next strategy
        if (result.stderr.includes('Sign in to confirm') || result.stderr.includes('bot')) {
          continue;
        }
        // For other errors, break immediately
        break;
      }

      return {
        success: false,
        error: `Audio extraction failed with all strategies. Last error: ${lastError}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Audio extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async extractTranscript(url: string, language: string = 'en'): Promise<TranscriptResult> {
    await this.ensureTempDir();
    
    const filename = `transcript_${Date.now()}.txt`;
    const outputPath = path.join(this.tempDir, filename);

    try {
      const result = await this.runYtDlp([
        '--write-subs',
        '--write-auto-subs',
        '--sub-lang', language,
        '--sub-format', 'txt',
        '--skip-download',
        '-o', outputPath.replace('.txt', '.%(ext)s'),
        url
      ]);

      if (result.code === 0) {
        // Find the subtitle file
        const files = await fs.readdir(this.tempDir);
        const subFile = files.find(f => f.includes('transcript_') && f.endsWith('.txt'));
        
        if (subFile) {
          const actualPath = path.join(this.tempDir, subFile);
          const transcript = await fs.readFile(actualPath, 'utf-8');
          const uploadResult = await this.storage.uploadFile(actualPath, `transcripts/${subFile}`);
          
          // Clean up local file
          await fs.unlink(actualPath).catch(() => {});
          
          return {
            success: true,
            filename: subFile,
            publicUrl: uploadResult.publicUrl,
            transcript,
            language
          };
        }
      }

      return {
        success: false,
        error: `Transcript extraction failed: ${result.stderr}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Transcript extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async extractThumbnail(url: string): Promise<ThumbnailResult> {
    await this.ensureTempDir();
    
    const filename = `thumbnail_${Date.now()}.jpg`;
    const outputPath = path.join(this.tempDir, filename);

    try {
      const result = await this.runYtDlp([
        '--write-thumbnail',
        '--skip-download',
        '-o', outputPath.replace('.jpg', '.%(ext)s'),
        url
      ]);

      if (result.code === 0) {
        // Find the thumbnail file
        const files = await fs.readdir(this.tempDir);
        const thumbFile = files.find(f => f.includes('thumbnail_') && (f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.webp')));
        
        if (thumbFile) {
          const actualPath = path.join(this.tempDir, thumbFile);
          const uploadResult = await this.storage.uploadFile(actualPath, `thumbnails/${thumbFile}`);
          
          // Clean up local file
          await fs.unlink(actualPath).catch(() => {});
          
          return {
            success: true,
            filename: thumbFile,
            publicUrl: uploadResult.publicUrl
          };
        }
      }

      return {
        success: false,
        error: `Thumbnail extraction failed: ${result.stderr}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Thumbnail extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async getVideoMetadata(url: string): Promise<VideoMetadata> {
    try {
      const result = await this.runYtDlp([
        '--dump-json',
        '--no-download',
        url
      ]);

      if (result.code === 0) {
        const metadata = JSON.parse(result.stdout);
        return {
          id: metadata.id,
          title: metadata.title,
          description: metadata.description,
          duration: metadata.duration,
          uploader: metadata.uploader,
          uploadDate: metadata.upload_date,
          viewCount: metadata.view_count,
          extractor: metadata.extractor
        };
      } else {
        throw new Error(`Failed to get metadata: ${result.stderr}`);
      }
    } catch (error) {
      throw new Error(`Failed to get video metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

