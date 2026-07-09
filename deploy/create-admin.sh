#!/bin/bash
cd /opt/takt-saas

# Create admin account via API
RESULT=$(curl -s -X POST http://localhost:3010/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"name":"Магомед Куриев","email":"magomed@takt24.ru","password":"Takt2024Admin!"}')

echo "Signup result: $RESULT"

# Extract user ID
USER_ID=$(echo "$RESULT" | node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d);console.log(j.user?.id||'FAIL')}catch(e){console.log('PARSE_ERROR: '+d)}})")
echo "User ID: $USER_ID"

if [ "$USER_ID" = "FAIL" ] || [ "$USER_ID" = "" ]; then
  echo "ERROR: Could not create user"
  exit 1
fi

# Create org + member with owner role via node
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');
const cuid = () => crypto.randomUUID().replace(/-/g,'').slice(0,25);

(async () => {
  const userId = '$USER_ID';
  const orgId = cuid();
  const now = new Date();

  await prisma.organization.create({
    data: {
      id: orgId,
      name: 'takt24',
      slug: 'takt24',
      timezone: 'Europe/Moscow',
      plan: 'TRIAL',
      trialEndsAt: new Date(Date.now() + 30*24*60*60*1000),
      updatedAt: now,
    }
  });

  await prisma.member.create({
    data: {
      id: cuid(),
      organizationId: orgId,
      userId: userId,
      role: 'owner',
      taktRole: 'OWNER',
    }
  });

  console.log('ORG_ID=' + orgId);
  console.log('DONE: owner account created');
  await prisma.\$disconnect();
})();
" 2>&1

echo "=== ADMIN ACCOUNT READY ==="
echo "Email: magomed@takt24.ru"
echo "Password: Takt2024Admin!"
echo "Role: owner (full access)"
