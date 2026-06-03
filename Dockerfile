FROM node:22-alpine

WORKDIR /app

COPY package.json ./

COPY package.json pnpm-lock.yaml ./

RUN npm install -g pnpm@10.5.2

RUN pnpm install

COPY . .

EXPOSE 4000

CMD ["pnpm", "start"]