#!/bin/bash
set -e

SERVER="root@72.56.234.44"
PROJECT_DIR="/opt/takt-saas"
IMAGE_NAME="takt-saas"

echo "=== TAKT Docker Deploy ==="
cd "$(dirname "$0")/.."

# 1. Build TypeScript
echo "[1/5] Building TypeScript..."
node node_modules/typescript/lib/tsc.js

# 2. Build Docker image for linux/amd64
echo "[2/5] Building Docker image (linux/amd64)..."
docker build --platform linux/amd64 -t $IMAGE_NAME:latest .

# 3. Save and compress image
echo "[3/5] Saving image..."
docker save $IMAGE_NAME:latest | gzip > /tmp/takt-image.tar.gz
echo "Image size: $(du -h /tmp/takt-image.tar.gz | cut -f1)"

# 4. Upload to server
echo "[4/5] Uploading to server..."
ssh $SERVER "mkdir -p $PROJECT_DIR/deploy"
scp /tmp/takt-image.tar.gz "$SERVER:/tmp/takt-image.tar.gz"
scp docker-compose.prod.yml "$SERVER:$PROJECT_DIR/docker-compose.prod.yml"
scp deploy/nginx-docker.conf "$SERVER:$PROJECT_DIR/deploy/nginx-docker.conf"
scp deploy/.env.docker "$SERVER:$PROJECT_DIR/.env"

# 5. Deploy on server
echo "[5/5] Deploying..."
ssh $SERVER "
  cd $PROJECT_DIR

  # Load image
  echo 'Loading Docker image...'
  docker load < /tmp/takt-image.tar.gz
  rm /tmp/takt-image.tar.gz

  # Start/restart services
  docker compose -f docker-compose.prod.yml up -d

  # Wait for DB to be healthy
  echo 'Waiting for database...'
  sleep 5

  # Run migrations
  docker compose -f docker-compose.prod.yml exec -T app npx prisma migrate deploy

  # Status
  echo ''
  echo '=== Container Status ==='
  docker compose -f docker-compose.prod.yml ps

  echo ''
  echo '=== DEPLOY COMPLETE ==='
"

rm -f /tmp/takt-image.tar.gz
echo "Done! App: http://72.56.234.44"
