# Build from the repository root: docker build -f backend/Dockerfile .
FROM node:24-alpine AS prune
WORKDIR /app
COPY . .
RUN npx turbo@^2 prune khan-go-quests-backend --docker

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=prune /app/out/json/ ./
RUN npm ci
COPY --from=prune /app/out/full/ ./
RUN npx turbo run build --filter=khan-go-quests-backend && npm prune --omit=dev

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/backend/dist ./backend/dist
COPY --from=build --chown=node:node /app/backend/package.json ./backend/package.json
WORKDIR /app/backend
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
