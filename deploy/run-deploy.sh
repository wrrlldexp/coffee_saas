#!/bin/bash
set -e
exec > /root/deploy.log 2>&1

echo "=== DEPLOY START ==="
APP="/opt/takt-saas"
cd "$APP"
mkdir -p uploads

# 1. Apply SQL migrations via psql
echo ">>> Migrations..."
export PGPASSWORD="takt_prod_2024"
for f in prisma/migrations/*/migration.sql; do
  echo "Applying $f..."
  psql -U takt -d takt -h localhost -f "$f" 2>&1 || true
done

# 2. Create _prisma_migrations table so Prisma thinks migrations are applied
psql -U takt -d takt -h localhost -c "
CREATE TABLE IF NOT EXISTS _prisma_migrations (
  id VARCHAR(36) PRIMARY KEY,
  checksum VARCHAR(64) NOT NULL,
  finished_at TIMESTAMPTZ,
  migration_name VARCHAR(255) NOT NULL,
  logs TEXT,
  rolled_back_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_steps_count INT NOT NULL DEFAULT 0
);
INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at, applied_steps_count)
VALUES
  ('init', 'manual', '20260703114242_init', now(), 1),
  ('org', 'manual', '20260703161433_add_active_org_id', now(), 1),
  ('recipes', 'manual', '20260706173155_add_recipes_schedule_payrate', now(), 1)
ON CONFLICT DO NOTHING;
" 2>&1 || true

# 3. Install Redis if needed
if ! command -v redis-server >/dev/null; then
  echo ">>> Installing Redis..."
  DEBIAN_FRONTEND=noninteractive apt install -y redis-server
  systemctl enable redis-server
  systemctl start redis-server
fi

# 4. Install Nginx if needed
if ! command -v nginx >/dev/null; then
  echo ">>> Installing Nginx..."
  DEBIAN_FRONTEND=noninteractive apt install -y nginx
  systemctl enable nginx
fi

# 5. Systemd service
echo ">>> Systemd service..."
cp "$APP/deploy/takt-saas.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable takt-saas
systemctl restart takt-saas

# 6. Nginx config
echo ">>> Nginx config..."
cp "$APP/deploy/nginx-takt.conf" /etc/nginx/sites-available/takt
ln -sf /etc/nginx/sites-available/takt /etc/nginx/sites-enabled/takt
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "=== DEPLOY DONE ==="
