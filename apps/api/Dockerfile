FROM node:22-alpine

WORKDIR /app

COPY . .

RUN npm install

RUN npx prisma generate --schema packages/db/prisma/schema.prisma

EXPOSE 4000

CMD ["npx", "tsx", "apps/api/src/index.ts"]