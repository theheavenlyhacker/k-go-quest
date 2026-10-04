# Build from this folder:  docker build -t kgo-backend backend
#
# The image carries no secrets and no CA certificate. Both arrive at run time:
#
#   docker run --rm -p 3000:3000 \
#     --env-file backend/.env \
#     -v "$PWD/backend/certs/aiven-ca.pem:/app/certs/aiven-ca.pem:ro" \
#     -e DATABASE_CA_PATH=/app/certs/aiven-ca.pem \
#     kgo-backend
#
# Migrations are not run here. They are a separate, deliberate step with a
# different database user; see docs/deployment.md.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
USER node
EXPOSE 3000
# The readiness probe is /api/v1/health/ready: 503 until the schema is complete.
CMD ["node", "dist/main.js"]
