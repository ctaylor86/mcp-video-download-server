import type { VideoMetadata, DownloadResult, TranscriptResult, ThumbnailResult } from './types.js';
import { CloudStorageService } from './storage.js';
export declare class VideoDownloaderService {
    private storageService;
    private tempDir;
    constructor(storageService: CloudStorageService);
    ensureTempDir(): Promise<void>;
    private runYtDlp;
    getVideoMetadata(url: string): Promise<VideoMetadata>;
    downloadVideo(url: string, quality?: string): Promise<DownloadResult>;
    downloadAudio(url: string): Promise<DownloadResult>;
    extractTranscript(url: string, language?: string): Promise<TranscriptResult>;
    extractThumbnail(url: string): Promise<ThumbnailResult>;
    private cleanSubtitles;
}
//# sourceMappingURL=downloader.d.ts.map