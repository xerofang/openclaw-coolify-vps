FROM node:22-alpine

LABEL coolify.managed="true"

RUN apk add --no-cache tini curl

# Use existing 'node' user (UID 1000 already exists in node:alpine)
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY --chown=node:node . .

USER node

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node healthcheck.js || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "index.js"]
