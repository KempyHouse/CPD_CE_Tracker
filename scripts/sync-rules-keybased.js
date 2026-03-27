'use strict';
/**
 * Key-based CE rule sync: map rules by (authority_key, role_key) not by UUID.
 * For each local rule, finds the corresponding Turso authority_id and role_id,
 * then inserts the rule with Turso's IDs if no rule already exists for that role.
 */
const { createClient } = require('@libsql/client');
const betterSqlite = require('better-sqlite3');
const { randomUUID } = require('crypto');
const path = require('path');

const localDb = betterSqlite(path.join(__dirname, '..', 'database', 'cpd_tracker.db'));
const turso = createClient({
  url: 'libsql://cpd-ce-tracker-cpd-ce-tracker.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1MTkwMjcsImlkIjoiMDE5ZDI5OTMtM2IwMS03Y2ZjLThhYTEtZDM5NmIwM2ZlMjE0IiwicmlkIjoiZDcyNDMxYWUtY2FhYy00OGYxLWEwZWUtNmU4MDhmYTZlMzJmIn0.uMP7ZZdPO6iPkPKxG4pLGOXhk_UEA8Wu5DGcKbyXkkYXzBcWkHgl3CPg8I-wniL1dWDb_7EuPKaKBwHTlhZRDg'
});

async function main() {
  // 1. Get all local rules with their role_key and authority_key
  const localRules = localDb.prepare(`
    SELECT r.*, ro.role_key, a.authority_key
    FROM cpd_requirement_rules r
    JOIN professional_roles ro ON r.role_id = ro.role_id
    JOIN registration_authorities a ON r.authority_id = a.authority_id
    ORDER BY a.authority_key, ro.role_key
  `).all();
  console.log(`Local rules: ${localRules.length}`);

  // 2. Get Turso lookup maps: authority_key→id, role_key+authority_key→id
  const authRes = await turso.execute('SELECT authority_id, authority_key FROM registration_authorities');
  const authMap = {}; // authority_key → authority_id (Turso)
  authRes.rows.forEach(r => { authMap[r.authority_key] = r.authority_id; });

  const roleRes = await turso.execute(`
    SELECT ro.role_id, ro.role_key, a.authority_key
    FROM professional_roles ro
    JOIN registration_authorities a ON ro.authority_id = a.authority_id
  `);
  const roleMap = {}; // `${authority_key}::${role_key}` → role_id (Turso)
  roleRes.rows.forEach(r => { roleMap[`${r.authority_key}::${r.role_key}`] = r.role_id; });

  // 3. Check which roles already have rules in Turso
  const existingRes = await turso.execute('SELECT DISTINCT role_id FROM cpd_requirement_rules');
  const hasRule = new Set(existingRes.rows.map(r => r.role_id));

  console.log(`Turso: ${authRes.rows.length} authorities, ${roleRes.rows.length} roles`);
  console.log(`Turso roles with existing rules: ${hasRule.size}`);

  // 4. Get all column names from local DB (minus the UUIDs we'll replace)
  const sample = localRules[0];
  const skipCols = new Set(['rule_id', 'authority_id', 'role_id']);
  const dataCols = Object.keys(sample).filter(c => !skipCols.has(c) && c !== 'role_key' && c !== 'authority_key');

  let inserted = 0, skipped = 0, notFound = 0;

  for (const rule of localRules) {
    const mapKey = `${rule.authority_key}::${rule.role_key}`;
    const tursoRoleId = roleMap[mapKey];
    const tursoAuthId = authMap[rule.authority_key];

    if (!tursoRoleId || !tursoAuthId) {
      console.log(`  MISSING in Turso: ${mapKey}`);
      notFound++;
      continue;
    }

    if (hasRule.has(tursoRoleId)) {
      skipped++;
      continue; // already has at least one rule
    }

    // Insert with Turso's IDs and a fresh UUID
    const newId = randomUUID();
    const cols = ['rule_id', 'authority_id', 'role_id', ...dataCols];
    const vals = [newId, tursoAuthId, tursoRoleId, ...dataCols.map(c => rule[c] ?? null)];
    const placeholders = cols.map(() => '?').join(', ');

    try {
      await turso.execute({
        sql: `INSERT INTO cpd_requirement_rules (${cols.join(', ')}) VALUES (${placeholders})`,
        args: vals
      });
      hasRule.add(tursoRoleId); // prevent duplicates if role has multiple rules
      inserted++;
      console.log(`  ✓ ${rule.authority_key}/${rule.role_key}`);
    } catch (e) {
      console.error(`  FAIL ${mapKey}: ${e.message.slice(0, 80)}`);
    }
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} already had rules, ${notFound} not found in Turso`);
  localDb.close();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
