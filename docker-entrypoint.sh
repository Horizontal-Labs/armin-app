#!/bin/sh
set -e

# Default API URL if not provided
API_URL="${VITE_API_BASE_URL:-http://localhost:8000}"

echo "Configuring API URL: $API_URL"

# Find and replace the placeholder in all JavaScript files
find /usr/share/nginx/html -type f \( -name "*.js" -o -name "*.mjs" \) -exec sed -i "s|__RUNTIME_API_URL__|$API_URL|g" {} +

# Also replace in any HTML files that might contain inline scripts
find /usr/share/nginx/html -type f -name "*.html" -exec sed -i "s|__RUNTIME_API_URL__|$API_URL|g" {} +

echo "API URL configuration complete"

# Execute the original command
exec "$@"