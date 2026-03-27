'use strict';
/**
 * Sync professional_roles and cpd_requirement_rules to Turso.
 * Authorities are already synced. Roles use INSERT OR IGNORE on role_id.
 * Rules use key-based mapping (authority_key + role_key).
 */
const { createClient } = require('@libsql/client');
const betterSqlite = require('better-sqlite3');
const { randomUUID } = require('crypto');
const path = require('path');

const local = betterSqlite(path.join(__dirname, '..', 'database', 'cpd_tracker.db'), { readonly: true });
const turso = createClient({
  url: 'libsql://cpd-ce-tracker-cpd-ce-tracker.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1MTkwMjcsImlkIjoiMDE5ZDI5OTMtM2IwMS03Y2ZjLThhYTEtZDM5NmIwM2ZlMjE0IiwicmlkIjoiZDcyNDMxYWUtY2FhYy00OGYxLWEwZWUtNmU4MDhmYTZlMzJmIn0.uMP7ZZdPO6iPkPKxG4pLGOXhk_UEA8Wu5DGcKbyXkkYXzBcWkHgl3CPg8I-wniL1dWDb_7EuPKaKBwHTlhZRDg'
});

async function main() {
  console.log('\n=== Sync Roles + Rules to Turso ===\n');

  // ── 1. Roles ──────────────────────────────────────────────────────────────
  const localRoles = local.prepare('SELECT * FROM professional_roles').all();
  const existingRoles = await turso.execute('SELECT role_id FROM professional_roles');
  const existingRoleIds = new Set(existingRoles.rows.map(r => r.role_id));
  const toInsertRoles = localRoles.filter(r => !existingRoleIds.has(r.role_id));
  console.log(`Roles: ${localRoles.length} local, ${existingRoleIds.size} in Turso, ${toInsertRoles.length} to insert`);

  if (toInsertRoles.length > 0) {
    const cols = Object.keys(toInsertRoles[0]);
    const sql = `INSERT OR IGNORE INTO professional_roles (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`;
    let ins = 0, fail = 0;
    for (const role of toInsertRoles) {
      try {
        const r = await turso.execute({ sql, args: cols.map(c => role[c] ?? null) });
        if (r.rowsAffected > 0) { ins++; process.stdout.write(`  ✓ ${role.role_key}\n`); }
      } catch (e) {
        console.error(`  FAIL ${role.role_key}: ${e.message.slice(0, 80)}`);
        fail++;
      }
    }
    console.log(`  → inserted ${ins}, failed ${fail}`);
  }

  // ── 2. Rules (key-based) ─────────────────────────────────────────────────
  const localRules = local.prepare(`
    SELECT r.*, ro.role_key, a.authority_key
    FROM cpd_requirement_rules r
    JOIN professional_roles ro ON r.role_id = ro.role_id
    JOIN registration_authorities a ON r.authority_id = a.authority_id
  `).all();
  console.log(`\nRules: ${localRules.length} local`);

  // Build Turso lookup maps (after roles were just inserted)
  const authRes = await turso.execute('SELECT authority_id, authority_key FROM registration_authorities');
  const authMap = {};
  authRes.rows.forEach(r => { authMap[r.authority_key] = r.authority_id; });

  const roleRes = await turso.execute(`
    SELECT ro.role_id, ro.role_key, a.authority_key
    FROM professional_roles ro JOIN registration_authorities a ON ro.authority_id = a.authority_id
  `);
  const roleMap = {};
  roleRes.rows.forEach(r => { roleMap[`${r.authority_key}::${r.role_key}`] = r.role_id; });

  const existingRuleRoles = await turso.execute('SELECT DISTINCT role_id FROM cpd_requirement_rules');
  const hasRule = new Set(existingRuleRoles.rows.map(r => r.role_id));

  const skipCols = new Set(['rule_id','authority_id','role_id','role_key','authority_key']);
  const dataCols = Object.keys(localRules[0]).filter(c => !skipCols.has(c));

  let rIns = 0, rSkip = 0, rMissing = 0;
  for (const rule of localRules) {
    const mapKey = `${rule.authority_key}::${rule.role_key}`;
    const tRoleId = roleMap[mapKey];
    const tAuthId = authMap[rule.authority_key];
    if (!tRoleId || !tAuthId) { rMissing++; continue; }
    if (hasRule.has(tRoleId)) { rSkip++; continue; }

    const newId = randomUUID();
    const cols = ['rule_id','authority_id','role_id',...dataCols];
    const vals = [newId, tAuthId, tRoleId, ...dataCols.map(c => rule[c] ?? null)];
    try {
      await turso.execute({ sql: `INSERT INTO cpd_requirement_rules (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`, args: vals });
      hasRule.add(tRoleId);
      rIns++;
      process.stdout.write(`  ✓ rule: ${mapKey}\n`);
    } catch (e) {
      console.error(`  FAIL rule ${mapKey}: ${e.message.slice(0, 80)}`);
    }
  }
  console.log(`\nRules: inserted ${rIns}, skipped(had rule) ${rSkip}, not-in-turso ${rMissing}`);
  console.log('\n=== Done ===');
  local.close();
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
