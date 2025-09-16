# Use Node.js 18 with Alpine Linux as base image
FROM node:18-alpine

# Install Python, pip, and other dependencies needed for yt-dlp
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    && ln -sf python3 /usr/bin/python

# Install yt-dlp via pip
RUN pip3 install --no-cache-dir yt-dlp

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy application code
COPY . .

# Build the TypeScript application
RUN npm run build

# Expose port (Smithery will handle port mapping)
EXPOSE 3000

# Start the MCP server
CMD ["node", "dist/index.js"]

