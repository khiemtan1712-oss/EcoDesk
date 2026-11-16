const { execSync } = require('child_process');
const fs = require('fs');

const raw = execSync('docker exec ecodesk-mysql mysql -uroot -proot -N -e "USE ecodesk_db; SELECT id, name, email, role, phone, created_at, spend_total, tier, note, email_verified, permissions_json FROM users;"', { encoding: 'utf8' });

const users = raw.trim().split('\n').map(line => {
  const [id, name, email, role, phone, created_at, spend_total, tier, note, email_verified, permissions_json] = line.split('\t');
  let perms = [];
  try {
    if (permissions_json && permissions_json !== 'NULL') {
      perms = JSON.parse(permissions_json);
    }
  } catch (e) {}
  return {
    id: id || '',
    name: name || '',
    email: email || '',
    role: role || 'customer',
    phone: phone && phone !== 'NULL' ? phone : '',
    createdAt: created_at && created_at !== 'NULL' ? created_at : new Date().toISOString(),
    spendTotal: Number(spend_total) || 0,
    tier: tier && tier !== 'NULL' ? tier : 'Đồng',
    note: note && note !== 'NULL' ? note : null,
    emailVerified: email_verified === '1',
    permissions: perms
  };
});

fs.writeFileSync('users.json', JSON.stringify(users, null, 2), 'utf8');
console.log('users.json written successfully. Count:', users.length);

