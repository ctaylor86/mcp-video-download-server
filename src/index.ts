import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Configuration schema for Smithery session configuration
export const configSchema = z.object({
  s3Endpoint: z.string().describe('S3-compatible endpoint URL'),
  s3Region: z.string().describe('S3 region'),
  s3AccessKeyId: z.string().describe('S3 access key ID'),
  s3SecretAccessKey: z.string().describe('S3 secret access key'),
  s3BucketName: z.string().describe('S3 bucket name'),
  s3PublicUrlBase: z.string().optional().describe('Custom public URL base for files'),
});

export default function createServer({ config }: { config: z.infer<typeof configSchema> }) {
  const server = new McpServer({
    name: "MCP Video Cloud Server",
    version: "1.0.0",
  });

  // Simple test tool that doesn't require any dependencies
  server.registerTool(
    "test_connection",
    {
      title: "Test Connection",
      description: "Test if the MCP server is working and verify S3 configuration",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        return {
          content: [
            {
              type: "text",
              text: `✅ MCP Video Cloud Server is working!\n\nConfiguration received:\n- Endpoint: ${config.s3Endpoint}\n- Region: ${config.s3Region}\n- Bucket: ${config.s3BucketName}\n- Status: Server responding\n- Timestamp: ${new Date().toISOString()}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          ]
        };
      }
    }
  );

  // Simple metadata tool (no external dependencies)
  server.registerTool(
    "get_server_info",
    {
      title: "Get Server Info",
      description: "Get basic server information",
      inputSchema: z.object({}),
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: `📋 Server Information:\n- Name: MCP Video Cloud Server\n- Version: 1.0.0\n- Runtime: Node.js ${process.version}\n- Platform: ${process.platform}\n- Architecture: ${process.arch}\n- Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB\n- Uptime: ${Math.round(process.uptime())} seconds`
          }
        ]
      };
    }
  );

  // Simple echo tool for testing
  server.registerTool(
    "echo",
    {
      title: "Echo Tool",
      description: "Echo back the input message",
      inputSchema: z.object({
        message: z.string().describe('Message to echo back'),
      }),
    },
    async ({ message }) => {
      return {
        content: [
          {
            type: "text",
            text: `Echo: ${message}`
          }
        ]
      };
    }
  );

  return server.server;
}

