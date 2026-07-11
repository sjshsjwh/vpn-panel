FROM node:20-slim

# ---- system deps + xray-core binary ----
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl unzip ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Check https://github.com/XTLS/Xray-core/releases for the latest tag and
# bump this if you want a newer Xray-core version.
RUN curl -fsSL https://api.github.com/repos/XTLS/Xray-core/releases/latest \
      | grep -o '"browser_download_url": *"[^"]*Xray-linux-64.zip"' \
      | cut -d'"' -f4 \
      | xargs curl -fL -o /tmp/xray.zip && \
    unzip -o /tmp/xray.zip -d /usr/local/bin && \
    chmod +x /usr/local/bin/xray && \
    rm /tmp/xray.zip

# ---- app ----
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN mkdir -p /app/data

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "src/server.js"]
