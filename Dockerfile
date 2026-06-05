FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json ./

COPY package.json pnpm-lock.yaml ./

RUN corepack prepare pnpm@10.5.2 --activate

# RUN npm install -g pnpm@10.5.2

RUN pnpm install

COPY . .

EXPOSE 4000

CMD ["pnpm", "start"]