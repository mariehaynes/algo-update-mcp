FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/data ./data
COPY --from=builder /app/src/data ./dist/data
COPY --from=builder /app/sample-okf ./sample-okf

EXPOSE 8080

CMD ["node", "dist/server.js"]
