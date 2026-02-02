FROM node:22-alpine

LABEL coolify.managed="true"

RUN apk add --no-cache tini wget

# Use existing 'node' user (UID 1000 already exists in node:alpine)
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --chown=node:node . .

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
