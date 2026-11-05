FROM node:22-bookworm-slim
WORKDIR /app

# Alat kompilasi hanya dipakai jika modul database tidak punya versi siap pakai untuk mesin ini
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY client/package*.json client/
RUN cd client && npm install --no-audit --no-fund

COPY . .
RUN cd client && npm run build && rm -rf node_modules

ENV NODE_ENV=production PORT=8080 DATA_DIR=/data
EXPOSE 8080
CMD ["node", "server/index.js"]
