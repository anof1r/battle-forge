FROM node:24-bookworm-slim AS client-build
WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci

COPY angular.json tsconfig.json tsconfig.app.json ngsw-config.json ./
COPY src ./src
COPY public ./public
RUN npm run build -- --configuration production --base-href /

FROM node:24-bookworm-slim AS server-build
WORKDIR /workspace/server

COPY server/package.json server/package-lock.json ./
RUN npm ci

COPY server/nest-cli.json server/tsconfig.json server/tsconfig.build.json ./
COPY server/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV STATIC_ROOT=/app/public

COPY --from=server-build --chown=node:node /workspace/server/node_modules ./node_modules
COPY --from=server-build --chown=node:node /workspace/server/dist ./dist
COPY --from=client-build --chown=node:node /workspace/dist/battle-forge/browser ./public

USER node
EXPOSE 8080
CMD ["node", "dist/main.js"]
