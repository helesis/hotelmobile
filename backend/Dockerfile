FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
COPY ../frontend/public ./frontend/public
EXPOSE 3000
CMD ["node", "server.js"]
