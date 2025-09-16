import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Configuration schema for session
export const configSchema = z.object({
  s3Endpoint: z.string().describe('S3-compatible endpoint URL'),
  s3Region: z.string().describe('S3 region'),
  s3AccessKeyId: z.string().describe('S3 access key ID'),
  s3SecretAccessKey: z.string().describe('S3 secret access key'),
  s3BucketName: z.string().describe('S3 bucket name'),
  s3PublicUrlBase: z.string().optional().describe('Custom public URL base for files'),
});

export default function createServer({ config }) {
  const server = new McpServer({
    name: "MCP Video Cloud Server",
    version: "1.0.0",
  });

  // Add a tool - using exact Smithery format
  server.registerTool("test_connection", { 
    title: "Test Connection", 
    description: "Test if the MCP server is working", 
    inputSchema: { message: z.string().optional().describe("Optional test message") }, 
  }, async ({ message }) => ({ 
    content: [{ type: "text", text: `✅ Server is working! Config endpoint: ${config.s3Endpoint}. Message: ${message || 'No message'}` }], 
  })); 

  // Add another tool
  server.registerTool("echo", { 
    title: "Echo Tool", 
    description: "Echo back a message", 
    inputSchema: { text: z.string().describe("Text to echo back") }, 
  }, async ({ text }) => ({ 
    content: [{ type: "text", text: `Echo: ${text}` }], 
  })); 

  // Add a third tool
  server.registerTool("get_info", { 
    title: "Get Server Info", 
    description: "Get basic server information", 
    inputSchema: {}, 
  }, async () => ({ 
    content: [{ type: "text", text: `Server: MCP Video Cloud Server v1.0.0\nNode: ${process.version}\nUptime: ${Math.round(process.uptime())}s` }], 
  })); 

  return server.server;
}

