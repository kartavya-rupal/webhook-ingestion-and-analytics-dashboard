FROM node:22-alpine

WORKDIR /app

COPY . .

RUN npm install

RUN npx prisma generate --schema packages/db/prisma/schema.prisma

CMD ["npx", "tsx", "apps/worker/src/index.ts"]