# Portal Viva Bem — imagem de produção
FROM node:22-slim

ENV NODE_ENV=production \
    TZ=America/Sao_Paulo \
    PORT=3000 \
    DB_PATH=/dados/portal.db \
    UPLOAD_DIR=/dados/uploads \
    BACKUP_DIR=/backups

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY public ./public

# roda sem privilégios de root; dados e backups ficam em volumes
RUN mkdir -p /dados /backups && chown -R node:node /dados /backups
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/saude').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.js"]
