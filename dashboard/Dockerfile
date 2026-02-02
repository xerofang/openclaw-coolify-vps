FROM node:22-alpine

LABEL coolify.managed="true"

RUN apk add --no-cache tini wget

RUN addgroup -g 1000 dashboard && \
    adduser -u 1000 -G dashboard -s /bin/sh -D dashboard

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --chown=dashboard:dashboard . .

USER dashboard

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
