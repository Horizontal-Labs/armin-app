# Build stage
FROM node:22-alpine as build-stage

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy project files
COPY . .

# Build with a placeholder that will be replaced at runtime
ENV VITE_API_BASE_URL=__RUNTIME_API_URL__

# Build the application
RUN npm run build

# Production stage
FROM nginx:stable-alpine as production-stage

# Install envsubst (part of gettext package)
RUN apk add --no-cache gettext

# Copy built application from build stage
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Copy nginx configuration
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port 80
EXPOSE 80

# Use the entrypoint script to replace the placeholder at runtime
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]