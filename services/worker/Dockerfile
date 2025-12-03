FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY services/worker/package.json services/worker/package.json
COPY libs/common/package.json libs/common/package.json
COPY libs/db-orm/package.json libs/db-orm/package.json

RUN npm install

COPY . .

RUN npx nest build --project worker || npm run build --workspace=worker

# ----------------- Runtime image -----------------
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/worker/dist ./services/worker/dist
COPY --from=builder /app/libs ./libs
COPY package.json ./

ENV NODE_ENV=production

CMD ["node", "services/worker/dist/main.js"]
