'use strict';
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://cpd-ce-tracker-cpd-ce-tracker.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1MTkwMjcsImlkIjoiMDE5ZDI5OTMtM2IwMS03Y2ZjLThhYTEtZDM5NmIwM2ZlMjE0IiwicmlkIjoiZDcyNDMxYWUtY2FhYy00OGYxLWEwZWUtNmU4MDhmYTZlMzJmIn0.uMP7ZZdPO6iPkPKxG4pLGOXhk_UEA8Wu5DGcKbyXkkYXzBcWkHgl3CPg8I-wniL1dWDb_7EuPKaKBwHTlhZRDg'
});

async function main() {
  const fs = require('fs');

  // Check total authority count
  const total = await client.execute('SELECT COUNT(*) as c FROM registration_authorities');
  console.log('Total authorities in Turso:', total.rows[0].c);

  // Find duplicates by authority_key
  const dups = await client.execute(`
    SELECT authority_key, COUNT(*) as cnt
    FROM registration_authorities
    GROUP BY authority_key
    HAVING cnt > 1
    ORDER BY cnt DESC
  `);
  console.log('Duplicate authority_keys:', dups.rows.length);
  dups.rows.forEach(r => console.log(`  ${r.authority_key}: ${r.cnt} copies`));

  // For each duplicate, keep the one that has linked roles/rules, delete the rest
  let deleted = 0;
  for (const dup of dups.rows) {
    const copies = await client.execute({
      sql: `SELECT authority_id,
                   (SELECT COUNT(*) FROM professional_roles WHERE authority_id=a.authority_id) as role_cnt,
                   (SELECT COUNT(*) FROM cpd_requirement_rules WHERE authority_id=a.authority_id) as rule_cnt,
                   created_at
            FROM registration_authorities a WHERE authority_key=? ORDER BY role_cnt DESC, rule_cnt DESC`,
      args: [dup.authority_key]
    });
    const rows = copies.rows;
    // Keep first (most roles/rules), delete the rest
    const toDelete = rows.slice(1);
    for (const row of toDelete) {
      await client.execute({ sql: 'DELETE FROM registration_authorities WHERE authority_id=?', args: [row.authority_id] });
      deleted++;
      process.stdout.write(`  Deleted dup: ${dup.authority_key} / ${row.authority_id} (roles:${row.role_cnt}, rules:${row.rule_cnt})\n`);
    }
  }

  // Final count
  const after = await client.execute('SELECT COUNT(*) as c FROM registration_authorities');
  console.log(`\nCleaned up ${deleted} duplicate authorities. Now: ${after.rows[0].c} authorities`);
}
main().catch(e => { console.error('Error:', e.message); process.exit(1); });
