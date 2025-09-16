import * as fs from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import type { VideoMetadata, DownloadResult, TranscriptResult, ThumbnailResult, YtDlpOutput } from './types.js';
import { CloudStorageService } from './storage.js';

export class VideoDownloaderService {
  private storageService: CloudStorageService;
  private tempDir: string;

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

  private async runYtDlp(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn('yt-dlp', args, {
        cwd: this.tempDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`yt-dlp failed with code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to spawn yt-dlp: ${error.message}`));
      });
    });
  }

  async downloadVideo(url: string, quality: string = 'best'): Promise<DownloadResult> {
    try {
      await this.ensureTempDir();
      
      const outputTemplate = join(this.tempDir, `video_${uuidv4()}.%(ext)s`);
      
      await this.runYtDlp([
        '--format', quality,
        '--output', outputTemplate,
        '--write-info-json',
        '--no-playlist',
        url
      ]);

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

      // Clean up local files
      try {
        await fs.promises.unlink(videoPath);
        if (infoFile) {
          await fs.promises.unlink(join(this.tempDir, infoFile));
        }
      } catch (error) {
        console.warn('Failed to clean up local files:', error);
      }

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
        error: error instanceof Error ? error.message : 'Unknown error occurred during video download'
      };
    }
  }

  async downloadAudio(url: string): Promise<DownloadResult> {
    try {
      await this.ensureTempDir();
      
      const outputTemplate = join(this.tempDir, `audio_${uuidv4()}.%(ext)s`);
      
      await this.runYtDlp([
        '--extract-audio',
        '--audio-format', 'mp3',
        '--output', outputTemplate,
        '--write-info-json',
        '--no-playlist',
        url
      ]);

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

      // Clean up local files
      try {
        await fs.promises.unlink(audioPath);
        if (infoFile) {
          await fs.promises.unlink(join(this.tempDir, infoFile));
        }
      } catch (error) {
        console.warn('Failed to clean up local files:', error);
      }

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
        error: error instanceof Error ? error.message : 'Unknown error occurred during audio extraction'
      };
    }
  }

  async extractTranscript(url: string, language: string = 'en'): Promise<TranscriptResult> {
    try {
      await this.ensureTempDir();
      
      const outputTemplate = join(this.tempDir, `transcript_${uuidv4()}`);
      
      await this.runYtDlp([
        '--write-subs',
        '--write-auto-subs',
        '--sub-lang', language,
        '--skip-download',
        '--output', outputTemplate,
        url
      ]);

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

      // Clean up local files
      try {
        await fs.promises.unlink(subPath);
        await fs.promises.unlink(cleanPath);
      } catch (error) {
        console.warn('Failed to clean up local files:', error);
      }

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
        error: error instanceof Error ? error.message : 'Unknown error occurred during transcript extraction'
      };
    }
  }

  async extractThumbnail(url: string): Promise<ThumbnailResult> {
    try {
      await this.ensureTempDir();
      
      const outputTemplate = join(this.tempDir, `thumbnail_${uuidv4()}.%(ext)s`);
      
      await this.runYtDlp([
        '--write-thumbnail',
        '--skip-download',
        '--output', outputTemplate,
        url
      ]);

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

      // Clean up local files
      try {
        await fs.promises.unlink(thumbnailPath);
      } catch (error) {
        console.warn('Failed to clean up local files:', error);
      }

      return {
        success: true,
        publicUrl,
        filename: thumbnailFile
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred during thumbnail extraction'
      };
    }
  }

  async getVideoMetadata(url: string): Promise<VideoMetadata> {
    try {
      await this.ensureTempDir();
      
      const result = await this.runYtDlp([
        '--dump-json',
        '--no-playlist',
        url
      ]);

      const ytDlpOutput: YtDlpOutput = JSON.parse(result);
      
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

