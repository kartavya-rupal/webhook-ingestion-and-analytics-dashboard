FROM node:22-alpine

WORKDIR /app

COPY . .

RUN npm install

WORKDIR /app/apps/dashboard

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]