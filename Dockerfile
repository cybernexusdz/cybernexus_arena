# --- build the React client ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm install
COPY shared shared
COPY client client
RUN npm run build -w client

# --- runtime: one process serves API, Socket.IO and the built client ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY server/package.json server/
RUN npm install --omit=dev -w server
COPY shared shared
COPY server server
COPY --from=build /app/client/dist client/dist
RUN mkdir -p /app/server/data && chown -R node:node /app/server/data
USER node
WORKDIR /app/server
EXPOSE 3001
CMD ["node", "src/index.js"]
