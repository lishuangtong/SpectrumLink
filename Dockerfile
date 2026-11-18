FROM node:22-bookworm-slim

LABEL org.opencontainers.image.title="SpectrumLink" \
      org.opencontainers.image.description="UV-K1 RSSI spectrum dashboard and ADS-B visualization" \
      org.opencontainers.image.source="https://github.com/lishuangtong/SpectrumLink" \
      org.opencontainers.image.licenses="GPL-2.0-or-later"

ENV NODE_ENV=production \
    SPECTRUMLINK_HOST=0.0.0.0 \
    SPECTRUMLINK_PORT=8765

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node scripts/serve.mjs ./scripts/serve.mjs
COPY --chown=node:node web ./web
COPY LICENSE NOTICE /licenses/

USER node
EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8765/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

STOPSIGNAL SIGTERM
CMD ["node", "scripts/serve.mjs"]
