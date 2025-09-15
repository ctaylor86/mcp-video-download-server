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

  constructor(storageService: CloudStorageService) {
    this.storageService = storageService;
    this.tempDir = join(tmpdir(), 'mcp-video-downloader');
    // Don't check yt-dlp during construction to avoid startup delays
  }

  async ensureTempDir(): Promise<void> {
    try {
      await fs.promises.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  private async checkYtDlp(): Promise<boolean> {
    if (this.ytDlpChecked) {
      return this.ytDlpAvailable;
    }

    return new Promise((resolve) => {
      const process = spawn('yt-dlp', ['--version'], { stdio: 'pipe' });
      
      process.on('close', (code) => {
        this.ytDlpAvailable = code === 0;
        this.ytDlpChecked = true;
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

  private async runYtDlp(args: string[]): Promise<{ stdout: string; stderr: string }> {
    // Check yt-dlp availability first
    const available = await this.checkYtDlp();
    if (!available) {
      throw new Error('yt-dlp is not available or not working. Please ensure yt-dlp is installed and accessible.');
    }

    return new Promise((resolve, reject) => {
      const childProcess = spawn('yt-dlp', args, { 
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      childProcess.on('close', (code: number | null) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
        }
      });

      childProcess.on('error', (error: Error) => {
        reject(error);
      });

      // Add timeout for individual operations
      setTimeout(() => {
        childProcess.kill();
        reject(new Error('yt-dlp operation timed out'));
      }, 300000); // 5 minute timeout
    });
  }

  async getVideoMetadata(url: string): Promise<VideoMetadata> {
    try {
      const args = [
        '--dump-json',
        '--no-download',
        url
      ];

      const { stdout } = await this.runYtDlp(args);
      const metadata: YtDlpOutput = JSON.parse(stdout.trim());

      return {
        id: metadata.id,
        title: metadata.title,
        description: metadata.description,
        duration: metadata.duration,
        uploader: metadata.uploader,
        uploadDate: metadata.upload_date,
        viewCount: metadata.view_count,
        likeCount: metadata.like_count,
        thumbnail: metadata.thumbnail,
        webpage_url: metadata.webpage_url,
        extractor: metadata.extractor,
        formats: metadata.formats?.map(f => ({
          format_id: f.format_id,
          ext: f.ext,
          resolution: f.resolution,
          filesize: f.filesize,
          url: f.url,
          quality: f.quality
        }))
      };
    } catch (error) {
      throw new Error(`Failed to get video metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async downloadVideo(url: string, quality: string = 'best'): Promise<DownloadResult> {
    await this.ensureTempDir();
    
    const sessionId = uuidv4();
    const outputTemplate = join(this.tempDir, `video_${sessionId}.%(ext)s`);

    try {
      // Get metadata first (this will also check yt-dlp availability)
      const metadata = await this.getVideoMetadata(url);

      const args = [
        '--format', quality,
        '--output', outputTemplate,
        url
      ];

      await this.runYtDlp(args);

      // Find the downloaded file
      const files = await fs.promises.readdir(this.tempDir);
      const videoFile = files.find(f => f.startsWith(`video_${sessionId}.`));
      
      if (!videoFile) {
        throw new Error('Downloaded video file not found');
      }

      const localPath = join(this.tempDir, videoFile);
      const stats = await fs.promises.stat(localPath);
      
      // Upload to cloud storage
      const publicUrl = await this.storageService.uploadFile(localPath, 'videos/');

      // Clean up local file
      await fs.promises.unlink(localPath);

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
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async downloadAudio(url: string): Promise<DownloadResult> {
    await this.ensureTempDir();
    
    const sessionId = uuidv4();
    const outputTemplate = join(this.tempDir, `audio_${sessionId}.%(ext)s`);

    try {
      // Get metadata first
      const metadata = await this.getVideoMetadata(url);

      const args = [
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '0', // Best quality
        '--output', outputTemplate,
        url
      ];

      await this.runYtDlp(args);

      // Find the downloaded file
      const files = await fs.promises.readdir(this.tempDir);
      const audioFile = files.find(f => f.startsWith(`audio_${sessionId}.`));
      
      if (!audioFile) {
        throw new Error('Downloaded audio file not found');
      }

      const localPath = join(this.tempDir, audioFile);
      const stats = await fs.promises.stat(localPath);
      
      // Upload to cloud storage
      const publicUrl = await this.storageService.uploadFile(localPath, 'audio/');

      // Clean up local file
      await fs.promises.unlink(localPath);

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
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async extractTranscript(url: string, language: string = 'en'): Promise<TranscriptResult> {
    await this.ensureTempDir();
    
    const sessionId = uuidv4();
    const outputTemplate = join(this.tempDir, `transcript_${sessionId}`);

    try {
      const args = [
        '--write-subs',
        '--write-auto-subs',
        '--sub-lang', language,
        '--sub-format', 'srt',
        '--skip-download',
        '--output', outputTemplate,
        url
      ];

      await this.runYtDlp(args);

      // Find the subtitle file
      const files = await fs.promises.readdir(this.tempDir);
      const subtitleFile = files.find(f => f.startsWith(`transcript_${sessionId}`) && f.endsWith('.srt'));
      
      if (!subtitleFile) {
        throw new Error('Subtitle file not found');
      }

      const localPath = join(this.tempDir, subtitleFile);
      const subtitleContent = await fs.promises.readFile(localPath, 'utf-8');
      
      // Clean transcript (remove timestamps and formatting)
      const cleanTranscript = this.cleanSubtitles(subtitleContent);
      
      // Create clean transcript file
      const transcriptFileName = `transcript_${sessionId}.txt`;
      const transcriptPath = join(this.tempDir, transcriptFileName);
      await fs.promises.writeFile(transcriptPath, cleanTranscript, 'utf-8');
      
      // Upload to cloud storage
      const publicUrl = await this.storageService.uploadFile(transcriptPath, 'transcripts/');

      // Clean up local files
      await fs.promises.unlink(localPath);
      await fs.promises.unlink(transcriptPath);

      return {
        success: true,
        publicUrl,
        filename: transcriptFileName,
        transcript: cleanTranscript,
        language
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async extractThumbnail(url: string): Promise<ThumbnailResult> {
    await this.ensureTempDir();
    
    const sessionId = uuidv4();
    const outputTemplate = join(this.tempDir, `thumbnail_${sessionId}.%(ext)s`);

    try {
      const args = [
        '--write-thumbnail',
        '--skip-download',
        '--output', outputTemplate,
        url
      ];

      await this.runYtDlp(args);

      // Find the thumbnail file
      const files = await fs.promises.readdir(this.tempDir);
      const thumbnailFile = files.find(f => f.startsWith(`thumbnail_${sessionId}.`));
      
      if (!thumbnailFile) {
        throw new Error('Thumbnail file not found');
      }

      const localPath = join(this.tempDir, thumbnailFile);
      
      // Upload to cloud storage
      const publicUrl = await this.storageService.uploadFile(localPath, 'thumbnails/');

      // Clean up local file
      await fs.promises.unlink(localPath);

      return {
        success: true,
        publicUrl,
        filename: thumbnailFile
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private cleanSubtitles(srtContent: string): string {
    // Remove SRT formatting (timestamps, sequence numbers)
    const lines = srtContent.split('\n');
    const textLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines, sequence numbers, and timestamp lines
      if (line === '' || /^\d+$/.test(line) || /^\d{2}:\d{2}:\d{2}/.test(line)) {
        continue;
      }
      
      // Clean HTML tags and formatting
      const cleanLine = line
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .trim();
      
      if (cleanLine) {
        textLines.push(cleanLine);
      }
    }
    
    return textLines.join(' ').replace(/\s+/g, ' ').trim();
  }
}
