# Multi-stage build for production
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY tsconfig.node.json ./

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY index.html ./
COPY public/ ./public/

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
