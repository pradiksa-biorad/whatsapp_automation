# ---- Stage 1: Build React frontend ----
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

# ---- Stage 2: Production image ----
FROM node:20-alpine
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/ backend/
COPY index.js .

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/frontend/dist frontend/dist

# Persistent data directories (mount as volumes on EC2)
RUN mkdir -p data auth_sessions

EXPOSE 3001
ENV NODE_ENV=production

CMD ["node", "backend/server.js"]
