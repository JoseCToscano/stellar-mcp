FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Compile TypeScript
RUN pnpm build

# Long-polling mode — no port needed (bot polls Telegram's servers)
CMD ["pnpm", "start"]
