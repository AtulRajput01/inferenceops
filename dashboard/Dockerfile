# Static web server for InferenceOps Dashboard UI
FROM nginx:alpine

# Remove default Nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy Nginx custom site configuration to enforce text/css MIME types
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static dashboard web assets
COPY . /usr/share/nginx/html

# Expose HTTP port 80
EXPOSE 80

# Run Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
