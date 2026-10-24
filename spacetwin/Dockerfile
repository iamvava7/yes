# One container: the VerifiCasa website, its backend and the 3D tours.
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-numpy python3-opencv \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY site/package.json site/package-lock.json site/.npmrc ./site/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev && rm -rf site/node_modules
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
VOLUME /data
EXPOSE 3000
CMD ["node", "server/index.js"]
