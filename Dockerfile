# Dashy - Production Dockerfile
# Multi-stage build for optimized image size

# Stage 1: Build
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile --production=false

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Stage 2: Production
FROM oven/bun:1-slim AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 dashy \
    && adduser --system --uid 1001 --ingroup dashy dashy

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy built application from builder
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./
COPY --from=builder /app/bun.lock* ./

# Install only production dependencies
RUN bun install --frozen-lockfile --production

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R dashy:dashy /app/data

# Switch to non-root user
USER dashy

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
CMD ["bun", "run", ".output/server/index.mjs"]
