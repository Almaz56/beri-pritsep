# Multi-stage build for production
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci && npm cache clean --force

# Copy Prisma schema
COPY prisma/ ./prisma/

# Copy source code
COPY src/ ./src/

# Generate Prisma client
RUN npx prisma generate

# Build only production server
RUN npx tsc src/production-server.ts --outDir dist --target es2020 --module commonjs --esModuleInterop --allowSyntheticDefaultImports --skipLibCheck

# Production stage
FROM node:18-alpine AS production

# Install system certs and OpenSSL for Prisma and HTTPS fetch
RUN apk add --no-cache openssl ca-certificates && update-ca-certificates

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S beripritsep -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy Prisma schema and generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create uploads and logs directories and set correct ownership
RUN mkdir -p uploads logs && chown -R beripritsep:nodejs uploads logs

# Switch to non-root user
USER beripritsep

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "dist/production-server.js"]
