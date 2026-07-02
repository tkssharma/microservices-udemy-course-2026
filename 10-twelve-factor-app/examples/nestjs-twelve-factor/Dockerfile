# Factor V: Build, Release, Run - Multi-stage build
FROM node:20-alpine AS builder

WORKDIR /app

# Factor II: Dependencies - Copy dependency files first for layer caching
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY --from=builder /app/dist ./dist

# Run as non-root user
USER node

# Factor VII: Port Binding - Expose the service port
EXPOSE 3000

# Factor XI: Logs - Output to stdout
CMD ["node", "dist/main.js"]
