FROM node:20-alpine AS base

<<<<<<< HEAD
# --- deps ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- runner ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

USER nextjs

EXPOSE 3000

CMD ["npm", "start"]
=======
WORKDIR /app

# 루트의 Next.js 프로젝트를 복사 (docker-compose에서 context를 ..로 설정)
COPY package*.json ./
RUN npm ci

COPY . .

# --- dev ---
FROM base AS dev
CMD ["npm", "run", "dev"]

# --- prod ---
FROM base AS prod
RUN npm run build
CMD ["npm", "run", "start"]
>>>>>>> origin/main
