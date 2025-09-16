import { spawn } from 'child_process';
import * as fs from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import type { VideoMetadata, DownloadResult, TranscriptResult, ThumbnailResult, YtDlpOutput } from './types.js';
import { CloudStorageService } from './storage.js';

export class VideoDownloaderService {
  private storageService: CloudStorageService;
  private tempDir: string;
  private ytDlpChecked: boolean = false;
  private ytDlpAvailable: boolean = false;
  private installationAttempted: boolean = false;

  constructor(storageService: CloudStorageService) {
    this.storageService = storageService;
    this.tempDir = join(tmpdir(), 'mcp-video-downloader');
  }

  async ensureTempDir(): Promise<void> {
    try {
      await fs.promises.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  private async installYtDlp(): Promise<boolean> {
    if (this.installationAttempted) {
      return this.ytDlpAvailable;
    }

    this.installationAttempted = true;
    console.log('Attempting to install yt-dlp...');

    return new Promise((resolve) => {
      // Try installing yt-dlp via pip
      const installProcess = spawn('pip', ['install', 'yt-dlp'], { stdio: 'pipe' });
      
      installProcess.on('close', async (code) => {
        if (code === 0) {
          console.log('yt-dlp installation completed, checking availability...');
          // Check if installation was successful
          const available = await this.checkYtDlp();
          resolve(available);
        } else {
          console.error('Failed to install yt-dlp via pip');
          resolve(false);
        }
      });
      
      installProcess.on('error', (error) => {
        console.error('Error installing yt-dlp:', error);
        resolve(false);
      });
      
      // Timeout after 60 seconds
      setTimeout(() => {
        installProcess.kill();
        console.error('yt-dlp installation timed out');
        resolve(false);
      }, 60000);
    });
  }

  private async checkYtDlp(): Promise<boolean> {
    if (this.ytDlpChecked && this.ytDlpAvailable) {
      return true;
    }

    return new Promise((resolve) => {
      const process = spawn('yt-dlp', ['--version'], { stdio: 'pipe' });
      
      process.on('close', (code) => {
        this.ytDlpAvailable = code === 0;
        this.ytDlpChecked = true;
        if (this.ytDlpAvailable) {
          console.log('yt-dlp is available and working');
        }
        resolve(this.ytDlpAvailable);
      });
      
      process.on('error', () => {
        this.ytDlpAvailable = false;
        this.ytDlpChecked = true;
        resolve(false);
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        process.kill();
        this.ytDlpAvailable = false;
        this.ytDlpChecked = true;
        resolve(false);
      }, 10000);
    });
  }

  private async ensureYtDlp(): Promise<boolean> {
    // First check if yt-dlp is available
    const available = await this.checkYtDlp();
    if (available) {
      return true;
    }

    // If not available, try to install it
    console.log('yt-dlp not found, attempting installation...');
    return await this.installYtDlp();
  }

  private async runYtDlp(args: string[], timeout: number = 300000): Promise<{ success: boolean; output?: string; error?: string }> {
    return new Promise((resolve) => {
      const childProcess = spawn('yt-dlp', args, { 
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: this.tempDir
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      childProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      childProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({ success: false, error: stderr || `Process exited with code ${code}` });
        }
      });

      childProcess.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });

      // Set timeout
      setTimeout(() => {
        childProcess.kill();
        resolve({ success: false, error: 'Operation timed out' });
      }, timeout);
    });
  }

  async downloadVideo(url: string, quality: string = 'best'): Promise<DownloadResult> {
    try {
      await this.ensureTempDir();
      
      // Ensure yt-dlp is available
      const ytDlpReady = await this.ensureYtDlp();
      if (!ytDlpReady) {
        return {
          success: false,
          error: 'Failed to install or access yt-dlp. This may be due to system restrictions in the deployment environment. yt-dlp is required for video downloading functionality.'
        };
      }

      const outputTemplate = join(this.tempDir, `video_${uuidv4()}.%(ext)s`);
      const args = [
        '--format', quality,
        '--output', outputTemplate,
        '--write-info-json',
        '--no-playlist',
        url
      ];

      const result = await this.runYtDlp(args);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Unknown error occurred during download'
        };
      }

      // Find downloaded files
      const files = await fs.promises.readdir(this.tempDir);
      const videoFile = files.find(f => f.startsWith('video_') && !f.endsWith('.info.json'));
      const infoFile = files.find(f => f.startsWith('video_') && f.endsWith('.info.json'));

      if (!videoFile) {
        return {
          success: false,
          error: 'Video file not found after download'
        };
      }

      const videoPath = join(this.tempDir, videoFile);
      const stats = await fs.promises.stat(videoPath);
      
      // Parse metadata if available
      let metadata: VideoMetadata | undefined;
      if (infoFile) {
        try {
          const infoPath = join(this.tempDir, infoFile);
          const infoContent = await fs.promises.readFile(infoPath, 'utf-8');
          const ytDlpOutput: YtDlpOutput = JSON.parse(infoContent);
          
          metadata = {
            id: ytDlpOutput.id,
            title: ytDlpOutput.title,
            description: ytDlpOutput.description,
            duration: ytDlpOutput.duration,
            uploader: ytDlpOutput.uploader,
            uploadDate: ytDlpOutput.upload_date,
            viewCount: ytDlpOutput.view_count,
            likeCount: ytDlpOutput.like_count,
            thumbnail: ytDlpOutput.thumbnail,
            webpage_url: ytDlpOutput.webpage_url,
            extractor: ytDlpOutput.extractor,
          };
        } catch (error) {
          console.warn('Failed to parse video metadata:', error);
        }
      }

      // Upload to cloud storage
      const publicUrl = await this.storageService.uploadFile(videoPath, 'videos/');

      return {
        success: true,
        publicUrl,
        filename: videoFile,
        fileSize: stats.size,
        metadata
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async downloadAudio(url: string): Promise<DownloadResult> {
    try {
      await this.ensureTempDir();
      
      // Ensure yt-dlp is available
      const ytDlpReady = await this.ensureYtDlp();
      if (!ytDlpReady) {
        return {
          success: false,
          error: 'Failed to install or access yt-dlp. This may be due to system restrictions in the deployment environment. yt-dlp is required for audio extraction functionality.'
        };
      }

      const outputTemplate = join(this.tempDir, `audio_${uuidv4()}.%(ext)s`);
      const args = [
        '--extract-audio',
        '--audio-format', 'mp3',
        '--output', outputTemplate,
        '--write-info-json',
        '--no-playlist',
        url
      ];

      const result = await this.runYtDlp(args);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Unknown error occurred during audio extraction'
        };
      }

      // Find downloaded files
      const files = await fs.promises.readdir(this.tempDir);
      const audioFile = files.find(f => f.startsWith('audio_') && f.endsWith('.mp3'));
      const infoFile = files.find(f => f.startsWith('audio_') && f.endsWith('.info.json'));

      if (!audioFile) {
        return {
          success: false,
          error: 'Audio file not found after extraction'
        };
      }

      const audioPath = join(this.tempDir, audioFile);
      const stats = await fs.promises.stat(audioPath);
      
      // Parse metadata if available
      let metadata: VideoMetadata | undefined;
      if (infoFile) {
        try {
          const infoPath = join(this.tempDir, infoFile);
          const infoContent = await fs.promises.readFile(infoPath, 'utf-8');
          const ytDlpOutput: YtDlpOutput = JSON.parse(infoContent);
          
          metadata = {
            id: ytDlpOutput.id,
            title: ytDlpOutput.title,
            description: ytDlpOutput.description,
            duration: ytDlpOutput.duration,
            uploader: ytDlpOutput.uploader,
            uploadDate: ytDlpOutput.upload_date,
            viewCount: ytDlpOutput.view_count,
            likeCount: ytDlpOutput.like_count,
            thumbnail: ytDlpOutput.thumbnail,
            webpage_url: ytDlpOutput.webpage_url,
            extractor: ytDlpOutput.extractor,
          };
        } catch (error) {
          console.warn('Failed to parse video metadata:', error);
        }
      }

      // Upload to cloud storage
      const publicUrl = await this.storageService.uploadFile(audioPath, 'audio/');

      return {
        success: true,
        publicUrl,
        filename: audioFile,
        fileSize: stats.size,
        metadata
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async extractTranscript(url: string, language: string = 'en'): Promise<TranscriptResult> {
    try {
      await this.ensureTempDir();
      
      // Ensure yt-dlp is available
      const ytDlpReady = await this.ensureYtDlp();
      if (!ytDlpReady) {
        return {
          success: false,
          error: 'Failed to install or access yt-dlp. This may be due to system restrictions in the deployment environment. yt-dlp is required for transcript extraction functionality.'
        };
      }

      const outputTemplate = join(this.tempDir, `transcript_${uuidv4()}`);
      const args = [
        '--write-subs',
        '--write-auto-subs',
        '--sub-lang', language,
        '--skip-download',
        '--output', outputTemplate,
        url
      ];

      const result = await this.runYtDlp(args);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Unknown error occurred during transcript extraction'
        };
      }

      // Find subtitle files
      const files = await fs.promises.readdir(this.tempDir);
      const subFile = files.find(f => f.startsWith('transcript_') && (f.endsWith('.vtt') || f.endsWith('.srt')));

      if (!subFile) {
        return {
          success: false,
          error: `No subtitles found for language '${language}'. The video may not have subtitles available.`
        };
      }

      const subPath = join(this.tempDir, subFile);
      let transcript = await fs.promises.readFile(subPath, 'utf-8');
      
      // Clean up subtitle formatting (basic cleanup)
      transcript = transcript
        .replace(/^\d+$/gm, '') // Remove subtitle numbers
        .replace(/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/g, '') // Remove timestamps
        .replace(/^WEBVTT$/gm, '') // Remove WEBVTT header
        .replace(/^\s*$/gm, '') // Remove empty lines
        .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
        .trim();

      // Create clean text file
      const cleanFileName = `transcript_${uuidv4()}.txt`;
      const cleanPath = join(this.tempDir, cleanFileName);
      await fs.promises.writeFile(cleanPath, transcript, 'utf-8');

      // Upload to cloud storage
      const publicUrl = await this.storageService.uploadFile(cleanPath, 'transcripts/');

      return {
        success: true,
        publicUrl,
        filename: cleanFileName,
        transcript,
        language
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async extractThumbnail(url: string): Promise<ThumbnailResult> {
    try {
      await this.ensureTempDir();
      
      // Ensure yt-dlp is available
      const ytDlpReady = await this.ensureYtDlp();
      if (!ytDlpReady) {
        return {
          success: false,
          error: 'Failed to install or access yt-dlp. This may be due to system restrictions in the deployment environment. yt-dlp is required for thumbnail extraction functionality.'
        };
      }

      const outputTemplate = join(this.tempDir, `thumbnail_${uuidv4()}.%(ext)s`);
      const args = [
        '--write-thumbnail',
        '--skip-download',
        '--output', outputTemplate,
        url
      ];

      const result = await this.runYtDlp(args);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Unknown error occurred during thumbnail extraction'
        };
      }

      // Find thumbnail file
      const files = await fs.promises.readdir(this.tempDir);
      const thumbnailFile = files.find(f => f.startsWith('thumbnail_') && (f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.webp')));

      if (!thumbnailFile) {
        return {
          success: false,
          error: 'Thumbnail file not found after extraction'
        };
      }

      const thumbnailPath = join(this.tempDir, thumbnailFile);

      // Upload to cloud storage
      const publicUrl = await this.storageService.uploadFile(thumbnailPath, 'thumbnails/');

      return {
        success: true,
        publicUrl,
        filename: thumbnailFile
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async getVideoMetadata(url: string): Promise<VideoMetadata> {
    try {
      await this.ensureTempDir();
      
      // Ensure yt-dlp is available
      const ytDlpReady = await this.ensureYtDlp();
      if (!ytDlpReady) {
        throw new Error('Failed to install or access yt-dlp. This may be due to system restrictions in the deployment environment. yt-dlp is required for metadata extraction functionality.');
      }

      const args = [
        '--dump-json',
        '--no-playlist',
        url
      ];

      const result = await this.runYtDlp(args, 60000); // 1 minute timeout for metadata
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get video metadata');
      }

      const ytDlpOutput: YtDlpOutput = JSON.parse(result.output || '{}');
      
      return {
        id: ytDlpOutput.id,
        title: ytDlpOutput.title,
        description: ytDlpOutput.description,
        duration: ytDlpOutput.duration,
        uploader: ytDlpOutput.uploader,
        uploadDate: ytDlpOutput.upload_date,
        viewCount: ytDlpOutput.view_count,
        likeCount: ytDlpOutput.like_count,
        thumbnail: ytDlpOutput.thumbnail,
        webpage_url: ytDlpOutput.webpage_url,
        extractor: ytDlpOutput.extractor,
        formats: ytDlpOutput.formats
      };

    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Unknown error occurred while getting metadata');
    }
  }
}

