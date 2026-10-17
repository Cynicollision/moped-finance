# STAGE 1: Build the Angular Frontend
# This stage builds the Angular application. It copies over the client and shared
# source code, installs dependencies, and runs the production build.
FROM node:24-alpine AS client-builder

ARG BUILD_CONFIG=production

WORKDIR /app

# Copy dependency definitions and install (leverages Docker cache)
COPY client/package*.json client/package-lock.json ./client/
RUN npm ci --prefix client

# Copy source code
COPY client ./client
COPY shared ./shared

# Build the Angular app
RUN npm run build --prefix client -- --configuration=$BUILD_CONFIG


# STAGE 2: Build the TypeScript Backend
# 2a: Install dependencies (Target this stage for Development)
FROM node:24-alpine AS server-deps

WORKDIR /app

# Copy dependency definitions and install (leverages Docker cache)
COPY server/package*.json server/package-lock.json ./server/
RUN npm ci --prefix server

# 2b: Copy source and build (Target this stage for Production Build)
FROM server-deps AS server-builder

# Copy source code
COPY server ./server
COPY shared ./shared

# Build the TypeScript server (production config: no source maps, no test files)
RUN npm run build:prod --prefix server


# STAGE 3: Final Production Image
# This stage creates the final, lean production image. It installs only the
# production dependencies for the server and copies in the build artifacts
# from the previous two stages.
FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install production-only backend dependencies
COPY server/package*.json server/package-lock.json ./server/
RUN npm ci --prefix server --omit=dev

# Copy compiled backend from the server-builder stage
COPY --from=server-builder /app/server/dist ./server/dist

# Copy the database migrations next to the compiled index.js (dist/server/migrations). The server
# applies any pending ones on startup.
COPY server/migrations ./server/dist/server/migrations

# Copy the default categories a new instance can start with (CAT-6.2), also next to index.js.
COPY server/default-data ./server/dist/server/default-data

# Copy the built frontend from the client-builder stage. Express serves static files from
# 'public' next to the compiled index.js (dist/server/public).
COPY --from=client-builder /app/client/dist/moped-finance/browser ./server/dist/server/public

# Expose the API port
EXPOSE 3000

# Switch to non-root user
USER appuser

# The command to start the server. tsc emits to dist/server and dist/shared because the
# server imports ../shared.
WORKDIR /app/server
CMD ["node", "dist/server/index.js"]