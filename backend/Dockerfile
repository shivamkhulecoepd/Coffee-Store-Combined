# ============================================
# Bean & Brew OS - Production Dockerfile
# Multi-stage build for optimized image size
# ============================================

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (needed for Prisma)
RUN npm ci --only=production=false

# ============================================
# Stage 2: Prisma Generate
# ============================================
FROM node:20-alpine AS prisma

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files and lockfile
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy prisma schema
COPY prisma ./prisma

# Generate Prisma client (downloads engines)
RUN npx prisma generate

# ============================================
# Stage 3: Builder (compile TypeScript)
# ============================================
FROM node:20-alpine AS builder

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl openssl-dev

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci --only=production=false

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Compile TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# ============================================
# Stage 4: Production
# ============================================
FROM node:20-alpine AS production

# Install OpenSSL and curl for health checks
RUN apk add --no-cache openssl curl

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files for production dependencies
COPY package*.json ./

# Install production dependencies + tsx for seeding
RUN npm install tsx && npm cache clean --force

# Copy Prisma schema and migrations (needed for migrations)
COPY prisma ./prisma

# Copy Prisma client from builder stage
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=prisma /app/node_modules/@prisma ./node_modules/@prisma

# Copy built application
COPY --from=builder /app/dist ./dist

# Create uploads directory with proper permissions
RUN mkdir -p /app/uploads && chown -R nodejs:nodejs /app/uploads

# Set ownership
USER nodejs

# Expose port
EXPOSE 3000

# Health check using curl
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/v1/health || exit 1

# Start command: run migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
