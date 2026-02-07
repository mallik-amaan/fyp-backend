# Use official Node.js slim image (latest stable)
FROM node:22-slim

# Install common system dependencies for Node.js servers
RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		ca-certificates \
		curl \
		tini \
	&& rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files first (for better caching)
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy rest of the code
COPY . .

# Copy .env file
COPY .env ./

# Expose Hugging Face Spaces port
EXPOSE 7860


# Set environment variables
ENV HOST=0.0.0.0 \
	PORT=7860

# Start your server
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "index.js"]
