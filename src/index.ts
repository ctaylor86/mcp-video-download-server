import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export const configSchema = z.object({
      s3Endpoint: z.string().describe('S3 endpoint'),
      s3Region: z.string().describe('S3 region'),
      s3AccessKeyId: z.string().describe('S3 access key'),
      s3SecretAccessKey: z.string().describe('S3 secret'),
      s3BucketName: z.string().describe('S3 bucket'),
});

export default function createServer({ config }: { config: z.infer<typeof configSchema> }) {
      const server = new McpServer({
              name: 'MCP Video Cloud Server',
              version: '1.0.0',
      });

  server.registerTool(
          'test_connection',
      {
                title: 'Test Connection',
                description: 'Test if the MCP server is working',
                inputSchema: {
                            message: z.string().describe('Test message'),
                },
      },
          async ({ message }) => {
                    return {
                                success: true,
                                message: `Server is working! You said: ${message}`,
                                config_status: 'Configuration received successfully'
                    };
          }
        );

  return server;
}
