FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package + workspace package manifests
COPY package.json package-lock.json ./
COPY services/api/package.json services/api/package.json
COPY libs/common/package.json libs/common/package.json
COPY libs/db-orm/package.json libs/db-orm/package.json

# Install dependencies for all workspaces
RUN npm install

# Copy the rest of the monorepo
COPY . .

# Build API (and its dependencies)
RUN npx nest build --project api || npm run build --workspace=api

# ----------------- Runtime image -----------------
FROM node:20-alpine

WORKDIR /app

# Copy node_modules + dist from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/api/dist ./services/api/dist
COPY --from=builder /app/libs ./libs
COPY package.json ./

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "services/api/dist/main.js"]
