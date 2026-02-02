FROM node:22-alpine

LABEL coolify.managed="true"

RUN apk add --no-cache tini curl

RUN addgroup -g 1000 botuser && \
    adduser -u 1000 -G botuser -s /bin/sh -D botuser

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --chown=botuser:botuser . .

USER botuser

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node healthcheck.js || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "index.js"]
