FROM node:22-alpine

LABEL coolify.managed="true"

RUN apk add --no-cache tini curl

RUN addgroup -g 1000 instauser && \
    adduser -u 1000 -G instauser -s /bin/sh -D instauser

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --chown=instauser:instauser . .

USER instauser

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node healthcheck.js || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "index.js"]
