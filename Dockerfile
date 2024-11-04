# Use the official Node.js 21 Bookworm image. The LTS somehow causes a crash?
FROM node:21-bookworm

# Set working directory inside the container
WORKDIR /app

# Install TypeScript globally
RUN npm install -g typescript

# We already have yarn installed in the base image v 1.22.22

# Run the app in development mode
CMD ["yarn", "run", "start:dev"]
