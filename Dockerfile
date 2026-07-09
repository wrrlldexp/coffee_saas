FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY prisma ./prisma
COPY schema.zmodel ./
COPY prisma.config.ts ./
RUN npm install prisma@7.8.0 --save-optional --ignore-scripts && DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

COPY dist ./dist
COPY public ./public

RUN mkdir -p uploads

EXPOSE 3010

CMD ["node", "dist/index.js"]
