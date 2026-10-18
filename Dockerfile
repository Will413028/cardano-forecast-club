FROM node:24-slim
RUN npm install -g pnpm@11.2.2
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && mkdir -p var && chown node:node var
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3318
EXPOSE 3318
CMD ["pnpm", "exec", "tsx", "apps/server/main.ts"]
