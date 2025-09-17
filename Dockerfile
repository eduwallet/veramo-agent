FROM node:20-alpine
WORKDIR /app

RUN yarn add -D typescript tslib

COPY package.json yarn.lock ./

RUN yarn install

COPY . .

# Run the app when the container launches
CMD ["yarn", "start:dev"]
