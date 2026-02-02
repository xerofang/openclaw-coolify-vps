# OpenClaw - VPS/Coolify Optimized Dockerfile
# Multi-stage build for smaller image size and faster deployments

# ================================
# Stage 1: Build dependencies
# ================================
FROM node:22-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Install OpenClaw and dependencies
RUN npm install -g pnpm && \
    npm pack openclaw && \
    tar -xzf openclaw-*.tgz && \
    cd package && \
    pnpm install --prod

# ================================
# Stage 2: Production image
# ================================
FROM node:22-slim AS production

# Labels for Coolify
LABEL org.opencontainers.image.title="OpenClaw"
LABEL org.opencontainers.image.description="AI Assistant with Telegram & Instagram integration"
LABEL org.opencontainers.image.vendor="OpenClaw"
LABEL coolify.managed="true"

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    chromium \
    chromium-sandbox \
    fonts-liberation \
    fonts-noto-color-emoji \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    dumb-init \
    tini \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    && rm -rf /tmp/* /var/tmp/*

# Create non-root user
ARG UID=1000
ARG GID=1000
RUN groupadd -g ${GID} openclaw && \
    useradd -m -u ${UID} -g openclaw -s /bin/bash openclaw

# Create directories with proper permissions
RUN mkdir -p \
    /home/openclaw/.openclaw \
    /home/openclaw/.local/bin \
    /home/openclaw/.npm-global \
    /home/openclaw/workspace \
    /home/openclaw/data \
    /home/openclaw/approval-queue/pending \
    /home/openclaw/approval-queue/processed \
    && chown -R openclaw:openclaw /home/openclaw

# Set environment
ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    CHROME_PATH=/usr/bin/chromium \
    CHROMIUM_FLAGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu" \
    PATH="/home/openclaw/.npm-global/bin:/home/openclaw/.local/bin:${PATH}" \
    NPM_CONFIG_PREFIX="/home/openclaw/.npm-global"

# Switch to non-root user
USER openclaw
WORKDIR /home/openclaw

# Install OpenClaw globally for user
RUN npm config set prefix '/home/openclaw/.npm-global' && \
    npm install -g openclaw

# Copy configuration
COPY --chown=openclaw:openclaw ./config/ /home/openclaw/config/
COPY --chown=openclaw:openclaw ./scripts/ /home/openclaw/scripts/

# Health check script
COPY --chown=openclaw:openclaw ./healthcheck.sh /home/openclaw/healthcheck.sh
RUN chmod +x /home/openclaw/healthcheck.sh

# Expose any needed ports (optional, for future API)
EXPOSE 8080

# Health check for Coolify
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD /home/openclaw/healthcheck.sh || exit 1

# Use tini for proper signal handling
ENTRYPOINT ["/usr/bin/tini", "--"]

# Default command
CMD ["openclaw"]
