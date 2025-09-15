export interface CloudStorageConfig {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    publicUrlBase?: string;
}
export interface VideoMetadata {
    id: string;
    title: string;
    description?: string;
    duration?: number;
    uploader?: string;
    uploadDate?: string;
    viewCount?: number;
    likeCount?: number;
    thumbnail?: string;
    webpage_url: string;
    extractor: string;
    formats?: VideoFormat[];
}
export interface VideoFormat {
    format_id: string;
    ext: string;
    resolution?: string;
    filesize?: number;
    url: string;
    quality?: number;
}
export interface DownloadResult {
    success: boolean;
    publicUrl?: string;
    filename?: string;
    fileSize?: number;
    error?: string;
    metadata?: VideoMetadata;
}
export interface TranscriptResult {
    success: boolean;
    publicUrl?: string;
    filename?: string;
    transcript?: string;
    language?: string;
    error?: string;
}
export interface ThumbnailResult {
    success: boolean;
    publicUrl?: string;
    filename?: string;
    error?: string;
}
export interface YtDlpOutput {
    id: string;
    title: string;
    description?: string;
    duration?: number;
    uploader?: string;
    upload_date?: string;
    view_count?: number;
    like_count?: number;
    thumbnail?: string;
    webpage_url: string;
    extractor: string;
    formats?: any[];
    requested_subtitles?: any;
    automatic_captions?: any;
    subtitles?: any;
}
//# sourceMappingURL=types.d.ts.map