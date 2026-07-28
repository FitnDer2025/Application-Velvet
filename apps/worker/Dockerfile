FROM node:24.18.0-alpine
WORKDIR /app
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/api-client/package.json packages/api-client/package.json
RUN npm install --omit=dev
COPY apps/worker apps/worker
USER node
CMD ["node", "apps/worker/src/worker.mjs"]
