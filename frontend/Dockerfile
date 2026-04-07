FROM node:20-alpine AS base

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
