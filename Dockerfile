# pin the base image; "latest" makes builds non-reproducible
FROM oven/bun:1.2-slim

WORKDIR /app

# copy lockfile too and freeze it -> reproducible installs
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY . .

ENV NODE_ENV=production
# app listens on PORT (default 3000) — keep EXPOSE in sync
ENV PORT=3000
EXPOSE 3000

# don't run as root; `bun` user ships with the base image
USER bun

CMD ["bun", "run", "src/index.ts"]
