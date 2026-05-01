# Use official Node.js slim image
FROM node:22-slim

# Install tini for proper signal handling
RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		ca-certificates \
		tini \
	&& rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files first (layer caching)
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy source code (node_modules and .env are excluded by .dockerignore)
COPY . .

# Cloud Run injects PORT at runtime (default 8080) — app already reads process.env.PORT
EXPOSE 8080

# Start server
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "index.js"]
