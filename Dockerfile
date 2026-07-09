# ── Frontend build stage ──
FROM node:22-alpine AS frontend

WORKDIR /web

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ .
RUN npm run build

# ── Backend build stage ──
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY prisma ./prisma
COPY schema.zmodel ./
COPY prisma.config.ts ./
COPY tsconfig.json ./
COPY src ./src

RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate
RUN npx tsc

# ── Production stage ──
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY prisma ./prisma
COPY schema.zmodel ./
COPY prisma.config.ts ./
RUN npm install prisma@7.8.0 --save-optional --ignore-scripts && DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

COPY --from=builder /app/dist ./dist
COPY --from=frontend /web/dist ./web/dist
COPY public ./public

RUN mkdir -p uploads

EXPOSE 3010

CMD ["node", "dist/index.js"]
