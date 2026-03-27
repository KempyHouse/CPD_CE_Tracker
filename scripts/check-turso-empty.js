'use strict';
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://cpd-ce-tracker-cpd-ce-tracker.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1MTkwMjcsImlkIjoiMDE5ZDI5OTMtM2IwMS03Y2ZjLThhYTEtZDM5NmIwM2ZlMjE0IiwicmlkIjoiZDcyNDMxYWUtY2FhYy00OGYxLWEwZWUtNmU4MDhmYTZlMzJmIn0.uMP7ZZdPO6iPkPKxG4pLGOXhk_UEA8Wu5DGcKbyXkkYXzBcWkHgl3CPg8I-wniL1dWDb_7EuPKaKBwHTlhZRDg'
});

async function main() {
  // Count empty roles in Turso
  const res = await client.execute(`
    SELECT r.role_key, r.role_name, a.authority_key
    FROM professional_roles r
    JOIN registration_authorities a ON r.authority_id = a.authority_id
    WHERE r.role_id NOT IN (SELECT role_id FROM cpd_requirement_rules)
    ORDER BY a.authority_key, r.role_key
    LIMIT 60
  `);
  console.log('Turso empty roles count:', res.rows.length);
  const fs = require('fs');
  fs.writeFileSync('c:/tmp/turso_empty_roles.json', JSON.stringify(res.rows.map(r=>({role_key:r.role_key,role_name:r.role_name,authority_key:r.authority_key})), null, 2));
  res.rows.forEach(r => console.log(' ', r.authority_key, '/', r.role_key, '—', r.role_name));
}
main().catch(console.error);
