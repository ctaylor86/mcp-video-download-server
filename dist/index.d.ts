#!/usr/bin/env node
import { z } from 'zod';
export declare const configSchema: z.ZodObject<{
    s3Endpoint: z.ZodString;
    s3Region: z.ZodString;
    s3AccessKeyId: z.ZodString;
    s3SecretAccessKey: z.ZodString;
    s3BucketName: z.ZodString;
    s3PublicUrlBase: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    s3Endpoint: string;
    s3Region: string;
    s3AccessKeyId: string;
    s3SecretAccessKey: string;
    s3BucketName: string;
    s3PublicUrlBase?: string | undefined;
}, {
    s3Endpoint: string;
    s3Region: string;
    s3AccessKeyId: string;
    s3SecretAccessKey: string;
    s3BucketName: string;
    s3PublicUrlBase?: string | undefined;
}>;
export default function createServer({ config, }: {
    config: z.infer<typeof configSchema>;
}): import("@modelcontextprotocol/sdk/server/index.js").Server<{
    method: string;
    params?: {
        [x: string]: unknown;
        _meta?: {
            [x: string]: unknown;
            progressToken?: string | number | undefined;
        } | undefined;
    } | undefined;
}, {
    method: string;
    params?: {
        [x: string]: unknown;
        _meta?: {
            [x: string]: unknown;
        } | undefined;
    } | undefined;
}, {
    [x: string]: unknown;
    _meta?: {
        [x: string]: unknown;
    } | undefined;
}>;
//# sourceMappingURL=index.d.ts.map