# Use Node.js 20 with Alpine Linux as base image (required for package.json engines)
FROM node:20-alpine

# Install Python, pip, and other dependencies needed for yt-dlp
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    && ln -sf python3 /usr/bin/python

# Install yt-dlp via pip with --break-system-packages flag
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy application code
COPY . .

# Build the TypeScript application using regular TypeScript compiler
RUN npx tsc

# Expose port (Smithery will handle port mapping)
EXPOSE 3000

# Start the MCP server
CMD ["node", "dist/index.js"]

