# STATIC TEMPLATE — copy verbatim. (operational-excellence)
# node:22-slim, not the template's default node:20-slim: this package uses the
# built-in node:sqlite module (needs Node >=22.5) instead of better-sqlite3 —
# see api/connection.ts for why.
FROM node:22-slim
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev && npm install tsx

COPY . .

ENV PORT=8080
ENV DATA_DIR=/data
EXPOSE 8080

CMD ["npm", "run", "start"]
