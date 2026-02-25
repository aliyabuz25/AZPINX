FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN mkdir -p public/uploads/receipts public/uploads/products public/uploads/categories public/uploads/sliders public/uploads/avatars
EXPOSE 3000
ENV HOST=0.0.0.0
CMD ["node", "server.js"]
