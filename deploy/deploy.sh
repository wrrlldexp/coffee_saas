#!/bin/bash
set -e

echo "=== takt-saas deploy ==="

APP_DIR="/opt/takt-saas"

# 1. Install Redis if not present
if ! command -v redis-server &>/dev/null; then
  echo ">>> Installing Redis..."
  apt install -y redis-server
  systemctl enable redis-server
  systemctl start redis-server
fi

# 2. Install Nginx if not present
if ! command -v nginx &>/dev/null; then
  echo ">>> Installing Nginx..."
  apt install -y nginx
  systemctl enable nginx
fi

# 3. Copy app files
echo ">>> Deploying app to $APP_DIR..."
mkdir -p "$APP_DIR/uploads"
cp -r dist/ "$APP_DIR/dist/"
cp -r public/ "$APP_DIR/public/"
cp -r prisma/ "$APP_DIR/prisma/"
cp -r node_modules/ "$APP_DIR/node_modules/"
cp package.json "$APP_DIR/"
cp package-lock.json "$APP_DIR/"
cp prisma.config.ts "$APP_DIR/"
cp .env.production "$APP_DIR/.env.production"

# 4. Run migrations
echo ">>> Running database migrations..."
cd "$APP_DIR"
npx prisma migrate deploy

# 5. Run seed (only first time)
if [ ! -f "$APP_DIR/.seeded" ]; then
  echo ">>> Seeding database..."
  npx tsx prisma/seed.ts
  touch "$APP_DIR/.seeded"
fi

# 6. Setup systemd service
echo ">>> Setting up systemd service..."
cp /opt/takt-saas/deploy/takt-saas.service /etc/systemd/system/takt-saas.service
systemctl daemon-reload
systemctl enable takt-saas
systemctl restart takt-saas

# 7. Setup Nginx
echo ">>> Configuring Nginx..."
cp /opt/takt-saas/deploy/nginx-takt.conf /etc/nginx/sites-available/takt
ln -sf /etc/nginx/sites-available/takt /etc/nginx/sites-enabled/takt
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "=== Deploy complete! ==="
echo "App: http://72.56.234.44"
echo "Health: http://72.56.234.44/api/health"
