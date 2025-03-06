# Use the official Node.js 18 Bookworm image. to use TSX
FROM node:18-bookworm

WORKDIR /app

COPY package.json ./

RUN yarn install

COPY . .

# Run the app when the container launches
CMD ["yarn", "start:dev"]
