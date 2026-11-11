FROM node:20-alpine AS frontend
WORKDIR /fe
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY api/package*.json ./
RUN npm ci --omit=dev
COPY api/src ./src
COPY --from=frontend /fe/dist ./public
USER node
EXPOSE 8080
CMD ["node", "src/server.js"]