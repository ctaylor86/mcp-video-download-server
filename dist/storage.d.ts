import type { CloudStorageConfig } from './types.js';
export declare class CloudStorageService {
    private s3Client;
    private config;
    constructor(config: CloudStorageConfig);
    uploadFile(localPath: string, keyPrefix?: string): Promise<string>;
    uploadBuffer(buffer: Buffer, fileName: string, keyPrefix?: string): Promise<string>;
}
//# sourceMappingURL=storage.d.ts.map