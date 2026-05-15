FROM node:20-alpine
WORKDIR /usr/src/app

# Outils natifs pour compiler better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .

CMD ["npm", "start"]
