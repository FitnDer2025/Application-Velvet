FROM node:24.18.0-alpine
WORKDIR /app
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/api-client/package.json packages/api-client/package.json
RUN npm install --omit=dev
COPY apps/api apps/api
COPY infra infra
USER node
EXPOSE 8080
CMD ["node", "apps/api/src/server.mjs"]
